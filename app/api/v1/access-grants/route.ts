import { NextRequest } from "next/server";
import { GrantEntityType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateAccessGrantApiSchema } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

/**
 * GET /api/v1/access-grants
 * Mengambil daftar persetujuan izin akses RME (Pasien hanya miliknya; Admin bisa filter `?patientId=`).
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien", "admin"], "GET /api/v1/access-grants");
  if (!auth.ok) return auth.response;

  const patientIdFilter = request.nextUrl.searchParams.get("patientId")?.trim();
  const where =
    auth.role === "admin"
      ? patientIdFilter
        ? { patientId: patientIdFilter }
        : {}
      : { patientId: auth.session.id };

  try {
    const grants = await prisma.accessGrant.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      grants.map((g) => ({
        ...g,
        validUntil: g.validUntil.toISOString(),
        revokedAt: g.revokedAt ? g.revokedAt.toISOString() : null,
        createdAt: g.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Izin Akses");
  }
}

/**
 * POST /api/v1/access-grants
 * Pemberian izin akses portabilitas RME lintas faskes/dokter oleh Pasien (UR-P05).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien"], "POST /api/v1/access-grants");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateAccessGrantApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;

  try {
    let resolvedEntityName = data.entityName;
    if (data.entityType === "DOKTER") {
      const doctor = await prisma.doctor.findUnique({
        where: { id: data.entityId },
        select: { id: true, name: true },
      });
      if (!doctor) {
        return problemResponse({
          slug: "not-found",
          title: "Resource Not Found",
          status: 404,
          detail: `Dokter tujuan '${data.entityId}' tidak ditemukan.`,
          instance,
        });
      }
      resolvedEntityName = resolvedEntityName || doctor.name;
    } else {
      const faskes = await prisma.faskes.findUnique({
        where: { id: data.entityId },
        select: { id: true, nama: true },
      });
      if (!faskes) {
        return problemResponse({
          slug: "not-found",
          title: "Resource Not Found",
          status: 404,
          detail: `Faskes tujuan '${data.entityId}' tidak ditemukan.`,
          instance,
        });
      }
      resolvedEntityName = resolvedEntityName || faskes.nama;
    }

    const grantId = `AG-${Date.now().toString().slice(-6)}`;
    const validUntil = new Date(Date.now() + data.durationHours * 60 * 60 * 1000);

    const created = await prisma.accessGrant.create({
      data: {
        id: grantId,
        patientId: auth.session.id,
        entityId: data.entityId,
        entityName: resolvedEntityName,
        entityType: data.entityType as GrantEntityType,
        scope: data.scope,
        validUntil,
        isRevoked: false,
      },
    });

    safeRevalidate(["/pasien/consent", "/pasien", "/pasien/audit-log"]);

    return jsonOk(
      {
        ...created,
        validUntil: created.validUntil.toISOString(),
        revokedAt: created.revokedAt ? created.revokedAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      },
      201,
      { Location: `/api/v1/access-grants/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Izin Akses");
  }
}
