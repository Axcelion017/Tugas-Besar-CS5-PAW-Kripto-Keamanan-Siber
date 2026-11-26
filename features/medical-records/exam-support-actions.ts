"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
} from "@/features/medical-records/crypto-service";
import {
  assertFaskesNotQuarantined,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";

export async function saveEncryptedImageServerAction(params: {
  medicalRecordId: string;
  title: string;
  type: "RONTGEN" | "USG" | "LAB" | "EKG" | "FOTO_KLINIS";
  encryptedBlobHex: string;
  ivHex: string;
  hmacDigest: string;
  mimeType: string;
  binaryHmac?: string;
  fileSizeBytes?: number;
  notes?: string;
}) {
  const auth = await requireSession(["nakes", "staf"], "saveEncryptedImage");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  if (
    !/^[0-9a-fA-F]{24}$/.test(params.ivHex) ||
    params.ivHex.toLowerCase() === STATIC_FORBIDDEN_IV ||
    !/^[0-9a-fA-F]{64}$/.test(params.hmacDigest) ||
    params.hmacDigest.toLowerCase() === EMPTY_SHA256_HMAC
  ) {
    return {
      success: false,
      message: "Ditolak: Citra medis wajib dienkripsi AES-256-GCM dengan IV acak 96-bit dan HMAC valid.",
    };
  }

  const killSwitchCheck = await assertFaskesNotQuarantined(
    auth.session.faskesId || "FAS-01",
    "Unggah citra medis"
  );
  if (!killSwitchCheck.ok) {
    return { success: false, message: killSwitchCheck.message };
  }

  try {
    const imgId = `IMG-${Date.now().toString().slice(-6)}`;
    const created = await prisma.medicalImage.create({
      data: {
        id: imgId,
        medicalRecordId: params.medicalRecordId,
        title: params.title,
        type: params.type,
        encryptedBlobHex: params.encryptedBlobHex,
        ivHex: params.ivHex,
        hmacDigest: params.hmacDigest,
        mimeType: params.mimeType,
        binaryHmac: params.binaryHmac || null,
        fileSizeBytes: params.fileSizeBytes ? BigInt(params.fileSizeBytes) : null,
        notes: params.notes || "Citra Medis Terenkripsi AES-256-GCM + HKDF HMAC di sisi klien",
      },
    });

    const rawCreated = created as unknown as { fileSizeBytes?: bigint | number };
    return {
      success: true,
      message: "Citra medis penunjang berhasil disimpan ke basis data.",
      data: {
        ...created,
        fileSizeBytes: rawCreated.fileSizeBytes ? Number(rawCreated.fileSizeBytes) : null,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    console.warn("Save Encrypted Image Error:", err);
    return { success: false, message: "Gagal menyimpan citra medis ke basis data." };
  }
}

export async function getAppointmentForExamServerAction(bookingId: string) {
  const auth = await requireSession(["nakes", "admin"], `getAppointmentForExam:${bookingId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message, data: null };
  }

  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: bookingId },
      include: {
        patient: true,
        faskes: true,
        doctor: true,
        dpjp: true,
        triageAssessment: true,
      },
    });

    if (!apt) {
      return { success: false, message: "Jadwal pemeriksaan tidak ditemukan di basis data.", data: null };
    }

    if (auth.role === "nakes") {
      const doctorId = auth.session.id;
      const grants = await prisma.accessGrant.findMany({ where: { patientId: apt.patientId } });
      const authorized =
        apt.doctorId === doctorId ||
        apt.dpjpId === doctorId ||
        hasValidGrantForDoctor(grants, doctorId, auth.session.faskesId);

      if (!authorized) {
        await recordSecurityAuditBestEffort({
          actorId: doctorId,
          actorName: auth.session.name,
          actorRole: auth.role,
          action: AuditAction.IDOR_BLOCKED,
          targetResource: `/nakes/periksa/${bookingId}`,
          severity: AuditSeverity.CRITICAL,
          detail: `BOLA Guard: Dokter ${doctorId} mencoba membuka ruang periksa antrean ${bookingId} yang bukan wewenangnya.`,
        });
        return {
          success: false,
          message: "403 Forbidden: Anda bukan dokter DPJP yang ditugaskan untuk antrean ini.",
          data: null,
        };
      }
    }

    const birthYear = apt.patient.birthDate
      ? new Date(apt.patient.birthDate).getFullYear()
      : new Date().getFullYear() - 30;
    const computedAge = Math.max(0, new Date().getFullYear() - birthYear);

    return {
      success: true,
      data: {
        appointment: {
          id: apt.id,
          pasienId: apt.patientId,
          pasienNama: apt.patient.name,
          pasienNik: apt.patient.nik,
          faskesId: apt.faskesId,
          faskesNama: apt.faskes.nama,
          faskesStatus: apt.faskes.status,
          dokterId: apt.dpjpId || apt.doctorId,
          dokterNama: apt.dpjp?.name || apt.doctor.name,
          poli: apt.poli,
          tanggal: apt.tanggal.toISOString().split("T")[0],
          jam: apt.jam,
          keluhanAwal: apt.keluhanAwal,
          status: apt.status,
          consentActive: apt.consentActive,
          triaseLevel: apt.triageAssessment?.triaseLevel || undefined,
          triaseVitals: apt.triageAssessment
            ? {
                systolic: apt.triageAssessment.systolic,
                diastolic: apt.triageAssessment.diastolic,
                heartRate: apt.triageAssessment.heartRate,
                temperature: Number(apt.triageAssessment.temperature),
                respiratoryRate: apt.triageAssessment.respiratoryRate,
                spo2: apt.triageAssessment.spo2,
                beratBadan: apt.triageAssessment.beratBadan
                  ? Number(apt.triageAssessment.beratBadan)
                  : undefined,
                tinggiBadan: apt.triageAssessment.tinggiBadan
                  ? Number(apt.triageAssessment.tinggiBadan)
                  : undefined,
              }
            : undefined,
        },
        patient: {
          id: apt.patient.id,
          nik: apt.patient.nik,
          name: apt.patient.name,
          age: computedAge,
          gender: apt.patient.gender,
          mrn: apt.patient.mrn,
          bloodType: apt.patient.bloodType,
          birthDate: apt.patient.birthDate
            ? apt.patient.birthDate.toISOString().split("T")[0]
            : undefined,
          allergies: apt.patient.allergies || [],
          emergencyContact: {
            name: apt.patient.emergencyContactName,
            relation: apt.patient.emergencyContactRelation,
            phone: apt.patient.emergencyContactPhone,
          },
          lastVisit: "-",
          hasAccess: true,
          encryptionKeyHex: apt.patient.encryptionKeyHex,
          statusKyc: "VERIFIED" as const,
        },
      },
    };
  } catch (err: unknown) {
    console.warn("Get Appointment For Exam Error:", err);
    return { success: false, message: "Gagal memuat data pemeriksaan dari basis data.", data: null };
  }
}
