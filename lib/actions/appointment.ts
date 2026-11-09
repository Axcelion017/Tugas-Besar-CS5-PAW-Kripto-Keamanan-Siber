"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { BookingSchema } from "@/lib/validations/patient";
import { AssignDpjpSchema } from "@/lib/validations/triage";
import { AppointmentStatus, Prisma } from "@prisma/client";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js
  }
}

export interface AppointmentActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Pemesanan Jadwal Antrean Pasien (Booking & Auto-Consent)
 * Menyimpan data ke tabel `appointments` di PostgreSQL
 */
export async function createAppointmentServerAction(
  rawData: Record<string, unknown>
): Promise<AppointmentActionResponse> {
  const validation = BookingSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format pemesanan jadwal tidak valid.",
    };
  }

  const {
    faskesId,
    dokterId,
    tanggal,
    jam,
    keluhanAwal,
    autoConsent = true,
  } = validation.data;

  const poli = String(rawData.poli || "Poli Penyakit Dalam");
  const patientId = String(rawData.patientId || "P-101");
  const aptId = `APT-2026-${Date.now().toString().slice(-4)}`;
  const consentPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit PIN

  try {
    const created = await prisma.appointment.create({
      data: {
        id: aptId,
        patientId,
        faskesId,
        doctorId: dokterId,
        tanggal: new Date(tanggal),
        jam,
        poli,
        keluhanAwal,
        consentActive: autoConsent,
        consentPin,
        status: AppointmentStatus.PENDING_ARRIVAL,
      },
    });

    safeRevalidate("/pasien");
    safeRevalidate("/pasien/booking");
    safeRevalidate("/pasien/audit-log");
    safeRevalidate("/staf");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: "Jadwal kunjungan berhasil dipesan dan dicatat di basis data.",
      data: created,
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(", ") : "identitas unik";
        return {
          success: false,
          message: `[Prisma P2002] Pelanggaran batasan unik: Janji temu dengan ${target} sudah terdaftar di sistem.`,
        };
      }
      if (error.code === "P2003") {
        return {
          success: false,
          message: `[Prisma P2003] Pelanggaran Foreign Key: Pasien, Dokter, atau Faskes terkait tidak ditemukan di database.`,
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    console.error("Create Appointment Error:", error);
    return {
      success: false,
      message: `Gagal menyimpan antrean: ${msg}`,
    };
  }
}

/**
 * Server Action: Membaca Daftar Antrean dari PostgreSQL
 */
export async function getAppointmentsServerAction(filters?: {
  faskesId?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}) {
  try {
    const whereClause: Record<string, unknown> = {};
    if (filters?.faskesId) whereClause.faskesId = filters.faskesId;
    if (filters?.doctorId) whereClause.doctorId = filters.doctorId;
    if (filters?.patientId) whereClause.patientId = filters.patientId;
    if (filters?.status) whereClause.status = filters.status;

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: { id: true, name: true, nik: true, mrn: true, bloodType: true },
        },
        doctor: {
          select: { id: true, name: true, specialty: true, strNumber: true },
        },
        dpjp: {
          select: { id: true, name: true, specialty: true },
        },
        triageAssessment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Sanitasi tipe Prisma.Decimal dan Date menjadi plain objects untuk Client Components
    const serializedAppointments = appointments.map((apt) => ({
      ...apt,
      tanggal: apt.tanggal.toISOString(),
      createdAt: apt.createdAt.toISOString(),
      checkInTime: apt.checkInTime ? apt.checkInTime.toISOString() : null,
      triageAssessment: apt.triageAssessment
        ? {
            ...apt.triageAssessment,
            temperature: Number(apt.triageAssessment.temperature),
            beratBadan: apt.triageAssessment.beratBadan ? Number(apt.triageAssessment.beratBadan) : null,
            tinggiBadan: apt.triageAssessment.tinggiBadan ? Number(apt.triageAssessment.tinggiBadan) : null,
            assessedAt: apt.triageAssessment.assessedAt.toISOString(),
          }
        : null,
    }));

    return { success: true, data: serializedAppointments };
  } catch (error: unknown) {
    console.warn("Get Appointments Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Penugasan DPJP dengan Validasi PIN (Active Encounter Ticket)
 */
export async function assignDpjpServerAction(
  rawData: Record<string, unknown>
): Promise<AppointmentActionResponse> {
  const validation = AssignDpjpSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format penugasan DPJP tidak valid.",
    };
  }

  const { aptId, doctorId, inputPin } = validation.data;

  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: aptId },
    });

    if (!apt) {
      return { success: false, message: "Tiket antrean tidak ditemukan di basis data." };
    }

    // Verifikasi kecocokan PIN 6 Digit Pasien
    if (apt.consentPin && inputPin && apt.consentPin !== inputPin) {
      return {
        success: false,
        message: "PIN Persetujuan Medis tidak cocok! Minta pasien melihat 6-digit PIN di aplikasi.",
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update status appointment dan DPJP di tabel appointments
      const updatedApt = await tx.appointment.update({
        where: { id: aptId },
        data: {
          dpjpId: doctorId,
          status: AppointmentStatus.IN_EXAMINATION,
        },
      });

      // 2. Terbitkan atau perbarui Active Encounter Ticket
      await tx.activeEncounter.upsert({
        where: { appointmentId: aptId },
        update: {
          doctorId,
          isClosed: false,
        },
        create: {
          id: `ENC-${aptId.slice(-4)}`,
          appointmentId: aptId,
          doctorId,
          patientId: apt.patientId,
          encounterToken: `ENC-TOKEN-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 jam masa aktif tiket
          isClosed: false,
        },
      });

      return updatedApt;
    });

    safeRevalidate("/staf");
    safeRevalidate("/staf/assign-dpjp");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: "DPJP berhasil ditugaskan dan tiket sesi periksa aktif dicatat di basis data.",
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    console.error("Assign DPJP Error:", error);
    return {
      success: false,
      message: `Gagal menugaskan DPJP: ${msg}`,
    };
  }
}

/**
 * Server Action: Perbarui Status Antrean (Misal saat check-in loket atau batal)
 */
export async function updateAppointmentStatusServerAction(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<AppointmentActionResponse> {
  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus },
    });

    safeRevalidate("/staf");
    safeRevalidate("/nakes");
    safeRevalidate("/pasien");

    return {
      success: true,
      message: `Status antrean berhasil diperbarui menjadi ${newStatus}.`,
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mengubah status antrean: ${msg}` };
  }
}

/**
 * Server Action: Perbarui Detail Janji Temu (UPDATE - Reschedule Tanggal, Jam, dan Keluhan)
 */
export async function updateAppointmentDetailsServerAction(
  appointmentId: string,
  params: {
    tanggal: string;
    jam: string;
    keluhanAwal?: string;
  }
): Promise<AppointmentActionResponse> {
  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing) {
      return { success: false, message: "Tiket antrean tidak ditemukan." };
    }

    if (existing.status === AppointmentStatus.COMPLETED) {
      return { success: false, message: "Antrean yang sudah selesai diperiksa tidak dapat diubah jadwalnya." };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        tanggal: new Date(params.tanggal),
        jam: params.jam,
        ...(params.keluhanAwal ? { keluhanAwal: params.keluhanAwal } : {}),
      },
    });

    safeRevalidate("/pasien");
    safeRevalidate("/pasien/booking");
    safeRevalidate("/pasien/audit-log");
    safeRevalidate("/staf");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: `Jadwal antrean berhasil diperbarui menjadi ${params.tanggal} pukul ${params.jam}.`,
      data: updated,
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          message: "[Prisma P2025] Rekaman tidak ditemukan: Janji temu yang ingin diubah tidak ada di database.",
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal memperbarui jadwal: ${msg}` };
  }
}

/**
 * Server Action: Batalkan / Hapus Janji Temu Pasien (DELETE)
 */
export async function deleteAppointmentServerAction(
  appointmentId: string
): Promise<AppointmentActionResponse> {
  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing) {
      return { success: false, message: "[Prisma P2025] Tiket antrean tidak ditemukan di database." };
    }

    // Jika antrean sudah memiliki rekam medis terkait, tidak boleh dihapus sembarangan (onDelete: Restrict)
    await prisma.appointment.delete({
      where: { id: appointmentId },
    });

    safeRevalidate("/pasien");
    safeRevalidate("/pasien/booking");
    safeRevalidate("/pasien/audit-log");
    safeRevalidate("/staf");
    safeRevalidate("/nakes");

    return {
      success: true,
      message: "Tiket antrean berhasil dibatalkan dan dihapus dari basis data.",
      data: { id: appointmentId },
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          message: "[Prisma P2025] Rekaman tidak ditemukan: Data antrean yang hendak dihapus tidak ada di database.",
        };
      }
      if (error.code === "P2003") {
        return {
          success: false,
          message: "[Prisma P2003/RESTRICT] Larangan hapus: Antrean ini masih terikat dengan data medis/triase lain.",
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal membatalkan antrean: ${msg}` };
  }
}
