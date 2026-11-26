import { NextRequest } from "next/server";
import { AppointmentStatus, AuditAction, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
} from "@/lib/api/problem";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/appointments/[id]/check-in
 * Admisi kedatangan pasien oleh Staf Loket menuju ruang triase (`WAITING_TRIAGE` — UR-S01).
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["staf", "admin"], `POST ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  try {
    const existing = await prisma.appointment.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (
      existing.status === AppointmentStatus.COMPLETED ||
      existing.status === AppointmentStatus.CANCELLED
    ) {
      return problemResponse({
        slug: "conflict",
        title: "Invalid State Transition",
        status: 409,
        detail: `Antrean berstatus ${existing.status} tidak dapat dilakukan check-in.`,
        instance,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: validId.id },
      data: {
        status: AppointmentStatus.WAITING_TRIAGE,
        checkInTime: existing.checkInTime ?? new Date(),
      },
    });

    const meta = extractRequestMeta(request);
    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.CHECK_IN_TRIAGE,
      targetResource: instance,
      severity: AuditSeverity.INFO,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Staf ${auth.session.name} melakukan check-in antrean ${validId.id} menuju ruang triase.`,
    });

    safeRevalidate(["/staf", "/staf/triase", "/pasien"]);

    return jsonOk({
      id: updated.id,
      status: updated.status,
      checkInTime: updated.checkInTime ? updated.checkInTime.toISOString() : null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Check-In Antrean");
  }
}
