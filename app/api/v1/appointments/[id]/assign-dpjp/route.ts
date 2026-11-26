import { NextRequest } from "next/server";
import { AppointmentStatus, AuditAction, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { AssignDpjpApiSchema } from "@/lib/validations/api-v1";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/appointments/[id]/assign-dpjp
 * Verifikasi PIN persetujuan 6-digit pasien & penugasan DPJP + Active Encounter Ticket (UR-S03, UR-P10).
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["staf", "admin"], `POST ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = AssignDpjpApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const { doctorId, consentPin } = parsed.data;

  try {
    const [apt, doctor] = await Promise.all([
      prisma.appointment.findUnique({ where: { id: validId.id } }),
      prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true } }),
    ]);

    if (!apt) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (!doctor) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Dokter DPJP '${doctorId}' tidak ditemukan.`,
        instance,
      });
    }

    if (
      apt.status === AppointmentStatus.COMPLETED ||
      apt.status === AppointmentStatus.CANCELLED
    ) {
      return problemResponse({
        slug: "conflict",
        title: "Invalid State Transition",
        status: 409,
        detail: `Antrean berstatus ${apt.status} tidak dapat ditugaskan ke DPJP.`,
        instance,
      });
    }

    if (!apt.consentPin || apt.consentPin !== consentPin) {
      return problemResponse({
        slug: "forbidden",
        title: "Invalid Consent PIN",
        status: 403,
        detail: "PIN persetujuan 6-digit tidak cocok dengan PIN aktif pada aplikasi pasien.",
        instance,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedApt = await tx.appointment.update({
        where: { id: validId.id },
        data: {
          dpjpId: doctor.id,
          status: AppointmentStatus.IN_EXAMINATION,
        },
      });

      const encounter = await tx.activeEncounter.upsert({
        where: { appointmentId: validId.id },
        update: { doctorId: doctor.id, isClosed: false },
        create: {
          id: `ENC-${validId.id.slice(-4)}`,
          appointmentId: validId.id,
          doctorId: doctor.id,
          patientId: apt.patientId,
          encounterToken: `ENC-TOKEN-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          isClosed: false,
        },
      });

      return { updatedApt, encounter };
    });

    const meta = extractRequestMeta(request);
    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.ASSIGN_DPJP,
      targetResource: instance,
      severity: AuditSeverity.INFO,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Staf ${auth.session.name} menugaskan DPJP ${doctor.name} (${doctor.id}) untuk antrean ${validId.id} setelah verifikasi PIN 6-digit.`,
    });

    safeRevalidate(["/staf", "/staf/assign-dpjp", "/nakes", "/nakes/jadwal"]);

    return jsonOk({
      appointmentId: result.updatedApt.id,
      dpjpId: result.updatedApt.dpjpId,
      status: result.updatedApt.status,
      encounterId: result.encounter.id,
      expiresAt: result.encounter.expiresAt.toISOString(),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Penugasan DPJP");
  }
}
