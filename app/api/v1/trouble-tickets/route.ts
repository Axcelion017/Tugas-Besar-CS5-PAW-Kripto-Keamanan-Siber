import { NextRequest } from "next/server";
import { Prisma, TicketCategory, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { TroubleTicketSchema } from "@/lib/validations/patient";
import { safeRevalidate } from "@/lib/utils/revalidate";

const VALID_TICKET_STATUSES = new Set<string>(Object.values(TicketStatus));
const VALID_TICKET_CATEGORIES = new Set<string>(Object.values(TicketCategory));

const ROLE_MAP: Record<string, UserRole> = {
  pasien: UserRole.pasien,
  nakes: UserRole.nakes,
  staf: UserRole.staf,
  admin: UserRole.admin,
};

/**
 * GET /api/v1/trouble-tickets
 * Daftar tiket kendala sistem/sengketa data (Non-admin hanya melihat miliknya — UR-P08, UR-A05).
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    "GET /api/v1/trouble-tickets"
  );
  if (!auth.ok) return auth.response;

  const statusParam = request.nextUrl.searchParams.get("status")?.trim();
  const kategoriParam = request.nextUrl.searchParams.get("kategori")?.trim();

  if (statusParam && !VALID_TICKET_STATUSES.has(statusParam)) {
    return problemResponse({
      slug: "validation-error",
      title: "Invalid Query Parameter",
      status: 422,
      detail: `Status tiket '${statusParam}' tidak dikenal (OPEN, INVESTIGATING, atau RESOLVED).`,
      instance,
      errors: [{ field: "status", message: "Status tiket tidak dikenal.", code: "invalid_value" }],
    });
  }

  if (kategoriParam && !VALID_TICKET_CATEGORIES.has(kategoriParam)) {
    return problemResponse({
      slug: "validation-error",
      title: "Invalid Query Parameter",
      status: 422,
      detail: `Kategori tiket '${kategoriParam}' tidak dikenal (BUG, SYNC_FAIL, DATA_MISMATCH, OTHER).`,
      instance,
      errors: [{ field: "kategori", message: "Kategori tiket tidak dikenal.", code: "invalid_value" }],
    });
  }

  const where: Prisma.TroubleTicketWhereInput = {
    ...(auth.role === "admin" ? {} : { reporterId: auth.session.id }),
    ...(statusParam ? { status: statusParam as TicketStatus } : {}),
    ...(kategoriParam ? { kategori: kategoriParam as TicketCategory } : {}),
  };

  try {
    const tickets = await prisma.troubleTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      tickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Tiket Kendala");
  }
}

/**
 * POST /api/v1/trouble-tickets
 * Membuat laporan kendala/sengketa data baru (UR-P08).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    "POST /api/v1/trouble-tickets"
  );
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = TroubleTicketSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const { kategori, judul, deskripsi } = parsed.data;
  const ticketId = `TCK-${Date.now().toString().slice(-6)}`;

  try {
    const created = await prisma.troubleTicket.create({
      data: {
        id: ticketId,
        reporterId: auth.session.id,
        reporterName: auth.session.name,
        reporterRole: ROLE_MAP[auth.role] || UserRole.pasien,
        faskesId: auth.session.faskesId || null,
        kategori: kategori as TicketCategory,
        judul,
        deskripsi,
        status: TicketStatus.OPEN,
      },
    });

    safeRevalidate(["/pasien/tiket-kendala", "/admin/incident-center"]);

    return jsonOk(
      {
        ...created,
        createdAt: created.createdAt.toISOString(),
        resolvedAt: created.resolvedAt ? created.resolvedAt.toISOString() : null,
      },
      201,
      { Location: `/api/v1/trouble-tickets/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Tiket Kendala");
  }
}
