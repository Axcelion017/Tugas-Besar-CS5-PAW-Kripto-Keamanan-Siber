"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { TriaseSchema } from "@/lib/validations/triage";
import { AppointmentStatus, AuditAction, AuditSeverity, TriaseLevel } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js
  }
}

export interface TriageActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Pengkajian Triase Awal Pasien (Tanda Vital & Triase Level)
 * Dibatasi khusus Staf Triase, Nakes, atau Admin (`requireSession`).
 */
export async function submitTriageServerAction(
  appointmentId: string,
  rawData: Record<string, unknown>,
  staffIdParam?: string
): Promise<TriageActionResponse> {
  const auth = await requireSession(["staf", "nakes", "admin"], `submitTriage:${appointmentId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const validation = TriaseSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format data triase tidak valid.",
    };
  }

  const {
    systolic,
    diastolic,
    heartRate,
    temperature,
    respiratoryRate,
    spo2,
    beratBadan,
    tinggiBadan,
    triaseLevel,
    catatanPerawat,
  } = validation.data;

  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!apt) {
      return { success: false, message: "Tiket kunjungan pasien tidak ditemukan." };
    }

    // Pastikan staffId valid mengacu pada tabel staff_members di DB (derive dari sesi staf)
    let resolvedStaffId = auth.role === "staf" ? auth.session.id : staffIdParam || "STF-01";
    const staffExists = await prisma.staffMember.findUnique({ where: { id: resolvedStaffId } });
    if (!staffExists) {
      const fallbackStaff = await prisma.staffMember.findFirst({
        where: { faskesId: apt.faskesId },
        select: { id: true },
      });
      if (!fallbackStaff) {
        return { success: false, message: "Identitas staf pemeriksa triase tidak valid." };
      }
      resolvedStaffId = fallbackStaff.id;
    }

    const triageId = `TRG-${appointmentId.slice(-4)}`;

    // Atomik: simpan pengkajian triase DAN alihkan status antrean ke WAITING_DOCTOR
    const saved = await prisma.$transaction(async (tx) => {
      const triageRecord = await tx.triageAssessment.upsert({
        where: { appointmentId },
        update: {
          staffId: resolvedStaffId,
          systolic,
          diastolic,
          heartRate,
          temperature,
          respiratoryRate,
          spo2,
          beratBadan,
          tinggiBadan,
          triaseLevel: triaseLevel as TriaseLevel,
          catatanPerawat,
        },
        create: {
          id: triageId,
          appointmentId,
          staffId: resolvedStaffId,
          systolic,
          diastolic,
          heartRate,
          temperature,
          respiratoryRate,
          spo2,
          beratBadan,
          tinggiBadan,
          triaseLevel: triaseLevel as TriaseLevel,
          catatanPerawat: catatanPerawat || "Pengkajian triase tanda vital loket",
        },
      });

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.WAITING_DOCTOR },
      });

      return triageRecord;
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.CHECK_IN_TRIAGE,
      targetResource: `/api/triage/${appointmentId}`,
      severity: AuditSeverity.INFO,
      detail: `Pengkajian triase pasien antrean ${appointmentId} disimpan dengan kategori ${triaseLevel}; status dialihkan ke WAITING_DOCTOR.`,
    });

    safeRevalidate("/staf");
    safeRevalidate("/staf/triase");
    safeRevalidate("/staf/assign-dpjp");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: "Pengkajian tanda vital dan kategori triase berhasil disimpan ke basis data.",
      data: {
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
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    console.error("Submit Triage Error:", error);
    return {
      success: false,
      message: `Gagal menyimpan triase: ${msg}`,
    };
  }
}
