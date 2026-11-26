"use server";

import { prisma } from "@/lib/db/prisma";
import { AssignDpjpSchema, WalkInAdmisiSchema } from "@/lib/validations/triage";
import { AppointmentStatus, AuditAction, AuditSeverity, FaskesStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";
import type { AppointmentActionResponse } from "@/features/appointments/booking-actions";

export async function assignDpjpServerAction(
  rawData: Record<string, unknown>
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(["staf", "admin"], "assignDpjp");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const validation = AssignDpjpSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format penugasan DPJP tidak valid.",
    };
  }

  const { aptId, doctorId, inputPin } = validation.data;

  try {
    const apt = await prisma.appointment.findUnique({ where: { id: aptId } });
    if (!apt) {
      return { success: false, message: "Tiket antrean tidak ditemukan di basis data." };
    }

    if (!apt.consentPin || !inputPin || apt.consentPin !== inputPin.trim()) {
      return {
        success: false,
        message:
          "PIN Persetujuan Medis 6-digit wajib diisi dan harus cocok dengan PIN pada aplikasi pasien.",
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedApt = await tx.appointment.update({
        where: { id: aptId },
        data: { dpjpId: doctorId, status: AppointmentStatus.IN_EXAMINATION },
      });

      await tx.activeEncounter.upsert({
        where: { appointmentId: aptId },
        update: { doctorId, isClosed: false },
        create: {
          id: `ENC-${aptId.slice(-4)}`,
          appointmentId: aptId,
          doctorId,
          patientId: apt.patientId,
          encounterToken: `ENC-TOKEN-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          isClosed: false,
        },
      });

      return updatedApt;
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.ASSIGN_DPJP,
      targetResource: `/api/appointments/${aptId}/assign-dpjp`,
      severity: AuditSeverity.INFO,
      detail: `Staf ${auth.session.name} menugaskan DPJP ${doctorId} untuk antrean ${aptId} setelah verifikasi PIN 6-digit pasien.`,
    });

    safeRevalidate(["/staf", "/staf/assign-dpjp", "/nakes", "/nakes/jadwal"]);

    return {
      success: true,
      message: "DPJP berhasil ditugaskan dan tiket sesi periksa aktif dicatat di basis data.",
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    console.error("Assign DPJP Error:", error);
    return { success: false, message: `Gagal menugaskan DPJP: ${msg}` };
  }
}

export async function updateAppointmentStatusServerAction(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(
    ["staf", "nakes", "admin"],
    `updateAppointmentStatus:${appointmentId}`
  );
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus },
    });

    safeRevalidate(["/staf", "/nakes", "/pasien"]);

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

export async function checkInAppointmentServerAction(
  appointmentId: string
): Promise<AppointmentActionResponse> {
  const auth = await requireSession(["staf", "admin"], `checkInAppointment:${appointmentId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.WAITING_TRIAGE, checkInTime: new Date() },
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.CHECK_IN_TRIAGE,
      targetResource: `/api/appointments/${appointmentId}/check-in`,
      severity: AuditSeverity.INFO,
      detail: `Staf ${auth.session.name} melakukan check-in kedatangan antrean ${appointmentId} menuju loket triase.`,
    });

    safeRevalidate(["/staf", "/staf/triase", "/pasien"]);

    return {
      success: true,
      message: `Pasien pada antrean ${appointmentId} berhasil Check-In dan dialihkan ke Loket Triase.`,
      data: {
        ...updated,
        tanggal: updated.tanggal.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        checkInTime: updated.checkInTime ? updated.checkInTime.toISOString() : null,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal melakukan check-in pasien: ${msg}` };
  }
}

export async function createWalkInAppointmentServerAction(rawData: {
  nik: string;
  keluhan: string;
  poli: string;
}): Promise<AppointmentActionResponse> {
  const auth = await requireSession(["staf", "admin"], "createWalkInAppointment");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const validation = WalkInAdmisiSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format pendaftaran walk-in tidak valid.",
    };
  }

  const { nik, keluhan, poli } = validation.data;
  const faskesId = auth.session.faskesId || "FAS-01";

  try {
    const faskes = await prisma.faskes.findUnique({
      where: { id: faskesId },
      include: { doctors: { take: 1 } },
    });

    if (!faskes) {
      return { success: false, message: "Fasilitas kesehatan tidak ditemukan." };
    }

    if (faskes.status === FaskesStatus.QUARANTINED) {
      return {
        success: false,
        message: `Pendaftaran walk-in ditolak: ${faskes.nama} sedang berstatus KARANTINA.`,
      };
    }

    const patient = await prisma.patient.findFirst({ where: { OR: [{ nik }, { id: nik }] } });
    if (!patient) {
      return {
        success: false,
        message: `Pasien dengan NIK ${nik} belum terdaftar di basis data nasional JagaMedis.`,
      };
    }

    const defaultDoctor = faskes.doctors[0] || (await prisma.doctor.findFirst());
    if (!defaultDoctor) {
      return { success: false, message: "Tidak ada dokter aktif tersedia di faskes ini." };
    }

    const aptId = `APT-WLK-${Date.now().toString().slice(-5)}`;
    const consentPin = randomInt(100000, 1000000).toString();
    const now = new Date();
    const jamStr = `${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;

    const created = await prisma.appointment.create({
      data: {
        id: aptId,
        patientId: patient.id,
        faskesId: faskes.id,
        doctorId: defaultDoctor.id,
        tanggal: now,
        jam: jamStr,
        poli,
        keluhanAwal: keluhan,
        consentActive: true,
        consentPin,
        status: AppointmentStatus.WAITING_TRIAGE,
        checkInTime: now,
      },
      include: {
        patient: { select: { id: true, name: true, nik: true, mrn: true } },
        faskes: { select: { id: true, nama: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
      },
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.CHECK_IN_TRIAGE,
      targetResource: `/api/appointments/${aptId}`,
      severity: AuditSeverity.INFO,
      detail: `Staf ${auth.session.name} mendaftarkan pasien walk-in ${patient.name} (${aptId}) langsung ke Loket Triase.`,
    });

    safeRevalidate(["/staf", "/staf/triase", "/nakes", "/nakes/jadwal"]);

    return {
      success: true,
      message: `Pasien walk-in ${patient.name} (${aptId}) berhasil didaftarkan ke Loket Triase.`,
      data: {
        ...created,
        tanggal: created.tanggal.toISOString(),
        createdAt: created.createdAt.toISOString(),
        checkInTime: created.checkInTime ? created.checkInTime.toISOString() : null,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    return { success: false, message: `Gagal mendaftarkan walk-in: ${msg}` };
  }
}
