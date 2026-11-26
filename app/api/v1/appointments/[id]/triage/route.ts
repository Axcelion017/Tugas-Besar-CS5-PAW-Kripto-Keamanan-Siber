import { NextRequest } from "next/server";
import { AppointmentStatus, AuditAction, AuditSeverity, TriaseLevel } from "@prisma/client";
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
import { TriaseSchema } from "@/lib/validations/triage";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PUT /api/v1/appointments/[id]/triage
 * Pengkajian triase awal 1:1 (idempoten) oleh Perawat Triase — UR-S02.
 * Atomik: upsert `triage_assessments` + ubah status antrean ke `WAITING_DOCTOR`.
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["staf", "nakes", "admin"], `PUT ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = TriaseSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;

  try {
    const apt = await prisma.appointment.findUnique({ where: { id: validId.id } });
    if (!apt) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
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
        detail: `Triase tidak dapat diperbarui pada antrean berstatus ${apt.status}.`,
        instance,
      });
    }

    let resolvedStaffId = auth.role === "staf" ? auth.session.id : "";
    const staffExists = resolvedStaffId
      ? await prisma.staffMember.findUnique({ where: { id: resolvedStaffId }, select: { id: true } })
      : null;

    if (!staffExists) {
      const fallbackStaff = await prisma.staffMember.findFirst({
        where: { faskesId: apt.faskesId },
        select: { id: true },
      });
      if (!fallbackStaff) {
        return problemResponse({
          slug: "conflict",
          title: "Missing Triage Staff",
          status: 409,
          detail: "Tidak ditemukan identitas staf triase terdaftar pada faskes ini.",
          instance,
        });
      }
      resolvedStaffId = fallbackStaff.id;
    }

    const triageId = `TRG-${validId.id.slice(-4)}`;

    const saved = await prisma.$transaction(async (tx) => {
      const triage = await tx.triageAssessment.upsert({
        where: { appointmentId: validId.id },
        update: {
          staffId: resolvedStaffId,
          systolic: data.systolic,
          diastolic: data.diastolic,
          heartRate: data.heartRate,
          temperature: data.temperature,
          respiratoryRate: data.respiratoryRate,
          spo2: data.spo2,
          beratBadan: data.beratBadan,
          tinggiBadan: data.tinggiBadan,
          triaseLevel: data.triaseLevel as TriaseLevel,
          catatanPerawat: data.catatanPerawat,
        },
        create: {
          id: triageId,
          appointmentId: validId.id,
          staffId: resolvedStaffId,
          systolic: data.systolic,
          diastolic: data.diastolic,
          heartRate: data.heartRate,
          temperature: data.temperature,
          respiratoryRate: data.respiratoryRate,
          spo2: data.spo2,
          beratBadan: data.beratBadan,
          tinggiBadan: data.tinggiBadan,
          triaseLevel: data.triaseLevel as TriaseLevel,
          catatanPerawat: data.catatanPerawat || "Pengkajian triase tanda vital loket",
        },
      });

      await tx.appointment.update({
        where: { id: validId.id },
        data: { status: AppointmentStatus.WAITING_DOCTOR },
      });

      return triage;
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
      detail: `Pengkajian triase antrean ${validId.id} tersimpan (${saved.triaseLevel}); status beralih ke WAITING_DOCTOR.`,
    });

    safeRevalidate(["/staf", "/staf/triase", "/staf/assign-dpjp", "/nakes"]);

    return jsonOk({
      id: saved.id,
      appointmentId: saved.appointmentId,
      staffId: saved.staffId,
      systolic: saved.systolic,
      diastolic: saved.diastolic,
      heartRate: saved.heartRate,
      temperature: Number(saved.temperature),
      respiratoryRate: saved.respiratoryRate,
      spo2: saved.spo2,
      beratBadan: saved.beratBadan ? Number(saved.beratBadan) : null,
      tinggiBadan: saved.tinggiBadan ? Number(saved.tinggiBadan) : null,
      triaseLevel: saved.triaseLevel,
      catatanPerawat: saved.catatanPerawat,
      assessedAt: saved.assessedAt.toISOString(),
      appointmentStatus: AppointmentStatus.WAITING_DOCTOR,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Pengkajian Triase");
  }
}
