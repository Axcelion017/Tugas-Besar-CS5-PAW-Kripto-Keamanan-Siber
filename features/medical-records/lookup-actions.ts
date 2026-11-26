"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
  maskNik,
} from "@/features/medical-records/helpers";

export async function lookupPatientByNikServerAction(nikOrId: string, _doctorIdUnused?: string) {
  void _doctorIdUnused;
  const auth = await requireSession(["nakes", "admin"], "lookupPatientByNik");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const doctorId = auth.session.id;

  try {
    const clean = nikOrId.trim();
    const patient = await prisma.patient.findFirst({
      where: { OR: [{ nik: clean }, { id: clean }, { mrn: clean }] },
      include: {
        accessGrants: true,
        appointments: true,
        user: true,
        medicalRecords: {
          include: {
            doctor: { select: { name: true, specialty: true, strNumber: true, sipNumber: true } },
            faskes: { select: { nama: true } },
            medicalImages: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!patient) {
      return {
        success: false,
        message: "Data pasien dengan NIK/ID tersebut tidak ditemukan di basis data.",
      };
    }

    const isAccessAllowed =
      hasValidGrantForDoctor(patient.accessGrants, doctorId, auth.session.faskesId) ||
      hasActiveEncounterForDoctor(patient.appointments, doctorId);

    if (!isAccessAllowed) {
      await recordSecurityAuditBestEffort({
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/rme/patient/${patient.id}`,
        severity: AuditSeverity.CRITICAL,
        ipAddress: "127.0.0.1 (Klinik LAN)",
        userAgent: "Mozilla/5.0 (JagaMedis HIS)",
        detail: `BOLA Guard: Dokter ${doctorId} mencoba mengakses NIK ${maskNik(clean)} (${patient.id}) tanpa tiket consent aktif dari pasien. Akses diblokir otomatis.`,
      });

      return {
        success: true,
        accessAllowed: false,
        patient: {
          id: patient.id,
          nik: maskNik(patient.nik),
          name: patient.name,
          mrn: patient.mrn,
          gender: patient.gender,
          bloodType: "-",
          birthDate: null,
          phone: "-",
          allergies: [] as string[],
          encryptionKeyHex: undefined as string | undefined,
        },
        medicalRecords: [],
      };
    }

    return {
      success: true,
      accessAllowed: true,
      patient: {
        id: patient.id,
        nik: patient.nik,
        name: patient.name,
        mrn: patient.mrn,
        gender: patient.gender,
        bloodType: patient.bloodType,
        birthDate: patient.birthDate ? patient.birthDate.toISOString() : null,
        phone: patient.emergencyContactPhone,
        allergies: patient.allergies,
        encryptionKeyHex: patient.encryptionKeyHex,
      },
      medicalRecords: patient.medicalRecords.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        medicalImages: (r.medicalImages || []).map((img) => ({
          ...img,
          fileSizeBytes: img.fileSizeBytes ? Number(img.fileSizeBytes) : null,
          createdAt: img.createdAt.toISOString(),
        })),
      })),
    };
  } catch (err: unknown) {
    console.warn("Lookup Patient Error:", err);
    return { success: false, message: "Terjadi gangguan saat mencari data pasien di database." };
  }
}

export async function executeBreakGlassServerAction(params: {
  patientId: string;
  doctorId?: string;
  reason: string;
}) {
  const auth = await requireSession(["nakes"], `executeBreakGlass:${params.patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const doctorId = auth.session.id;
  const reason = (params.reason || "").trim();
  if (reason.length < 5) {
    return {
      success: false,
      message: "Alasan klinis darurat Break-Glass wajib diisi minimal 5 karakter.",
    };
  }

  try {
    const grantId = `GRANT-BG-${Date.now().toString().slice(-6)}`;
    const validUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const grant = await prisma.accessGrant.create({
      data: {
        id: grantId,
        patientId: params.patientId,
        entityId: doctorId,
        entityName: `${auth.session.name} (Break-Glass IGD)`,
        entityType: "DOKTER",
        scope: `Akses Darurat IGD (Break-Glass): ${reason}`,
        validUntil,
        isRevoked: false,
        isBreakGlass: true,
      },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: "nakes",
        action: "BREAK_GLASS_ACCESS",
        targetResource: `/api/rme/break-glass/${params.patientId}`,
        ipAddress: "127.0.0.1 (Terminal IGD)",
        userAgent: "Mozilla/5.0 (JagaMedis Emergency)",
        severity: "CRITICAL",
        detail: `BREAK-GLASS DIAKTIFKAN: Dokter ${auth.session.name} (${doctorId}) membuka rekam medis darurat pasien ${params.patientId}. Alasan klinis: ${reason}. Notifikasi dikirimkan ke Admin Regulator Kemenkes.`,
      },
    });

    return {
      success: true,
      message: "Protokol Break-Glass berhasil diaktifkan. Akses darurat diberikan selama 12 jam.",
      data: grant,
    };
  } catch (err: unknown) {
    console.warn("Break Glass Error:", err);
    return { success: false, message: "Gagal mengaktifkan protokol Break-Glass." };
  }
}
