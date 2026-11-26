"use server";

import { prisma } from "@/lib/db/prisma";
import { BookingSchema } from "@/lib/validations/patient";
import {
  AppointmentStatus,
  AuditAction,
  AuditSeverity,
  FaskesStatus,
  GrantEntityType,
  Prisma,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

export interface AppointmentActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

export async function createAppointmentServerAction(
  rawData: Record<string, unknown>
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(["pasien", "staf", "admin"], "createAppointment");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

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
  const patientId =
    auth.role === "pasien" ? auth.session.id : String(rawData.patientId || "").trim();

  if (!patientId) {
    return { success: false, message: "Identitas pasien tujuan wajib diisi." };
  }

  const aptId = `APT-2026-${Date.now().toString().slice(-6)}`;
  const consentPin = randomInt(100000, 1000000).toString();

  try {
    const targetFaskes = await prisma.faskes.findUnique({
      where: { id: faskesId },
      select: { id: true, nama: true, status: true },
    });

    if (!targetFaskes) {
      return { success: false, message: "Fasilitas kesehatan tujuan tidak ditemukan." };
    }

    if (targetFaskes.status === FaskesStatus.QUARANTINED) {
      return {
        success: false,
        message: `Pendaftaran ditolak: ${targetFaskes.nama} sedang berada dalam status KARANTINA (Kill-Switch Siber) oleh Admin Regulator.`,
      };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: dokterId },
      select: { id: true, name: true, specialty: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.create({
        data: {
          id: aptId,
          patientId,
          faskesId,
          doctorId: dokterId,
          tanggal: new Date(tanggal),
          jam,
          poli: doctor?.specialty || poli,
          keluhanAwal,
          consentActive: autoConsent,
          consentPin,
          status: AppointmentStatus.PENDING_ARRIVAL,
        },
        include: {
          faskes: { select: { id: true, nama: true } },
          doctor: { select: { id: true, name: true, specialty: true } },
        },
      });

      if (autoConsent) {
        const visitDate = new Date(tanggal);
        const validUntil = new Date(
          Math.max(visitDate.getTime(), Date.now()) + 48 * 60 * 60 * 1000
        );
        await tx.accessGrant.create({
          data: {
            id: `AG-${Date.now().toString().slice(-6)}`,
            patientId,
            entityId: dokterId,
            entityName: doctor?.name || "Dokter DPJP",
            entityType: GrantEntityType.DOKTER,
            scope: `Auto-Consent Konsultasi (${aptId})`,
            validUntil,
            isRevoked: false,
          },
        });
      }

      return apt;
    });

    safeRevalidate([
      "/pasien",
      "/pasien/booking",
      "/pasien/consent",
      "/pasien/audit-log",
      "/staf",
      "/nakes",
      "/nakes/jadwal",
    ]);

    return {
      success: true,
      message: "Jadwal kunjungan berhasil dipesan dan dicatat di basis data.",
      data: {
        ...created,
        tanggal: created.tanggal.toISOString(),
        createdAt: created.createdAt.toISOString(),
        checkInTime: created.checkInTime ? created.checkInTime.toISOString() : null,
      },
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.join(", ")
          : "identitas unik";
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
    return { success: false, message: `Gagal menyimpan antrean: ${msg}` };
  }
}

export async function getAppointmentsServerAction(filters?: {
  faskesId?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}) {
  const auth = await requireSession(["pasien", "staf", "nakes", "admin"], "getAppointments");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const whereClause: Prisma.AppointmentWhereInput = {};

    if (auth.role === "pasien") {
      whereClause.patientId = auth.session.id;
    } else if (auth.role === "nakes") {
      whereClause.OR = [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }];
    } else {
      if (filters?.faskesId) whereClause.faskesId = filters.faskesId;
      if (filters?.doctorId) whereClause.doctorId = filters.doctorId;
      if (filters?.patientId) whereClause.patientId = filters.patientId;
    }

    if (filters?.status) whereClause.status = filters.status;

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: { id: true, name: true, nik: true, mrn: true, bloodType: true, allergies: true },
        },
        faskes: { select: { id: true, nama: true, status: true } },
        doctor: { select: { id: true, name: true, specialty: true, strNumber: true } },
        dpjp: { select: { id: true, name: true, specialty: true } },
        triageAssessment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const serializedAppointments = appointments.map((apt) => ({
      ...apt,
      consentPin: auth.role === "pasien" ? apt.consentPin : null,
      tanggal: apt.tanggal.toISOString(),
      createdAt: apt.createdAt.toISOString(),
      checkInTime: apt.checkInTime ? apt.checkInTime.toISOString() : null,
      triageAssessment: apt.triageAssessment
        ? {
            ...apt.triageAssessment,
            temperature: Number(apt.triageAssessment.temperature),
            beratBadan: apt.triageAssessment.beratBadan
              ? Number(apt.triageAssessment.beratBadan)
              : null,
            tinggiBadan: apt.triageAssessment.tinggiBadan
              ? Number(apt.triageAssessment.tinggiBadan)
              : null,
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

export async function updateAppointmentDetailsServerAction(
  appointmentId: string,
  params: { tanggal: string; jam: string; keluhanAwal?: string }
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(
    ["pasien", "staf", "admin"],
    `updateAppointmentDetails:${appointmentId}`
  );
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) {
      return { success: false, message: "Tiket antrean tidak ditemukan." };
    }

    if (auth.role === "pasien" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/appointments/${appointmentId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengubah jadwal antrean milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang mengubah jadwal antrean milik pasien lain.",
      };
    }

    if (existing.status === AppointmentStatus.COMPLETED) {
      return {
        success: false,
        message: "Antrean yang sudah selesai diperiksa tidak dapat diubah jadwalnya.",
      };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        tanggal: new Date(params.tanggal),
        jam: params.jam,
        ...(params.keluhanAwal ? { keluhanAwal: params.keluhanAwal } : {}),
      },
    });

    safeRevalidate(["/pasien", "/pasien/booking", "/pasien/audit-log", "/staf", "/nakes"]);

    return {
      success: true,
      message: `Jadwal antrean berhasil diperbarui menjadi ${params.tanggal} pukul ${params.jam}.`,
      data: updated,
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return {
        success: false,
        message:
          "[Prisma P2025] Rekaman tidak ditemukan: Janji temu yang ingin diubah tidak ada di database.",
      };
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal memperbarui jadwal: ${msg}` };
  }
}

export async function deleteAppointmentServerAction(
  appointmentId: string
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(
    ["pasien", "staf", "admin"],
    `deleteAppointment:${appointmentId}`
  );
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) {
      return { success: false, message: "[Prisma P2025] Tiket antrean tidak ditemukan di database." };
    }

    if (auth.role === "pasien" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/appointments/${appointmentId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba menghapus jadwal antrean milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang menghapus jadwal antrean milik pasien lain.",
      };
    }

    await prisma.appointment.delete({ where: { id: appointmentId } });

    safeRevalidate(["/pasien", "/pasien/booking", "/pasien/audit-log", "/staf", "/nakes"]);

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
          message:
            "[Prisma P2025] Rekaman tidak ditemukan: Data antrean yang hendak dihapus tidak ada di database.",
        };
      }
      if (error.code === "P2003") {
        return {
          success: false,
          message:
            "[Prisma P2003/RESTRICT] Larangan hapus: Antrean ini masih terikat dengan data medis/triase lain.",
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal membatalkan antrean: ${msg}` };
  }
}
