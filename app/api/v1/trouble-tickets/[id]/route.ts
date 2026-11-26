import { NextRequest } from "next/server";
import { AuditAction, AuditSeverity, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  noContentResponse,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { UpdateTroubleTicketApiSchema } from "@/lib/validations/api-v1";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/trouble-tickets/[id]
 * Detail tiket kendala (Admin atau pelapor pemilik tiket — Anti-BOLA).
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    `GET ${instance}`
  );
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Tiket Kendala", instance);
  if (!validId.ok) return validId.response;

  try {
    const ticket = await prisma.troubleTicket.findUnique({ where: { id: validId.id } });
    if (!ticket) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Tiket kendala '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role !== "admin" && ticket.reporterId !== auth.session.id) {
      const meta = extractRequestMeta(request);
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Pengguna ${auth.session.id} mencoba membaca tiket kendala ${validId.id} milik pelapor lain.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang melihat tiket kendala milik pengguna lain.",
        instance,
      });
    }

    return jsonOk({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Tiket Kendala");
  }
}

/**
 * PATCH /api/v1/trouble-tickets/[id]
 * Memperbarui status penanganan tiket (`OPEN`, `INVESTIGATING`, `RESOLVED`) khusus Admin Regulator (UR-A05).
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["admin"], `PATCH ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Tiket Kendala", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = UpdateTroubleTicketApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const nextStatus = parsed.data.status as TicketStatus;

  try {
    const updated = await prisma.troubleTicket.update({
      where: { id: validId.id },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === TicketStatus.RESOLVED ? new Date() : null,
      },
    });

    safeRevalidate(["/admin/incident-center", "/pasien/tiket-kendala"]);

    return jsonOk({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Tiket Kendala");
  }
}

/**
 * DELETE /api/v1/trouble-tickets/[id]
 * Menarik/menghapus tiket yang masih berstatus `OPEN` (Pemilik atau Admin).
 * Mengembalikan HTTP 409 jika tiket sudah masuk investigasi/selesai.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    `DELETE ${instance}`
  );
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Tiket Kendala", instance);
  if (!validId.ok) return validId.response;

  try {
    const existing = await prisma.troubleTicket.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Tiket kendala '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role !== "admin" && existing.reporterId !== auth.session.id) {
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang menghapus tiket kendala milik pengguna lain.",
        instance,
      });
    }

    if (existing.status !== TicketStatus.OPEN) {
      return problemResponse({
        slug: "conflict",
        title: "Conflict",
        status: 409,
        detail: `Tiket berstatus ${existing.status} tidak dapat dihapus karena telah masuk proses audit/penanganan.`,
        instance,
      });
    }

    await prisma.troubleTicket.delete({ where: { id: validId.id } });
    safeRevalidate(["/admin/incident-center", "/pasien/tiket-kendala"]);

    return noContentResponse();
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Tiket Kendala");
  }
}
