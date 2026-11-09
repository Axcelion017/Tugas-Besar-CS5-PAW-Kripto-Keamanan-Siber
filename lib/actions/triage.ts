"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { TriaseSchema } from "@/lib/validations/triage";
import { TriaseLevel } from "@prisma/client";

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
 * Menyimpan data ke tabel `triage_assessments` di PostgreSQL
 */
export async function submitTriageServerAction(
  appointmentId: string,
  rawData: Record<string, unknown>,
  staffId: string = "STF-01"
): Promise<TriageActionResponse> {
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

    const triageId = `TRG-${appointmentId.slice(-4)}`;

    const saved = await prisma.triageAssessment.upsert({
      where: { appointmentId },
      update: {
        staffId,
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
        staffId,
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

    safeRevalidate("/staf");
    safeRevalidate("/staf/triase");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: "Pengkajian tanda vital dan kategori triase berhasil disimpan ke basis data.",
      data: {
        ...saved,
        temperature: Number(saved.temperature),
        beratBadan: saved.beratBadan ? Number(saved.beratBadan) : null,
        tinggiBadan: saved.tinggiBadan ? Number(saved.tinggiBadan) : null,
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
