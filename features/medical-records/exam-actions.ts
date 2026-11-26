"use server";

import { redirect } from "next/navigation";
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, AppointmentStatus } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  CanonicalSoapPayload,
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
  encryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import {
  assertFaskesNotQuarantined,
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";
import { safeRevalidate } from "@/lib/utils/revalidate";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: { recordId: string };
}

export async function submitPemeriksaanKlinisAction(
  prevState: ServerActionResponse | null,
  formData: FormData
): Promise<ServerActionResponse> {
  void prevState;
  const auth = await requireSession(["nakes"], "submitPemeriksaanKlinis");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const rawData = {
    subjective: formData.get("subjective") as string,
    systolic: Number(formData.get("systolic")),
    diastolic: Number(formData.get("diastolic")),
    heartRate: Number(formData.get("heartRate")),
    temperature: Number(formData.get("temperature")),
    spo2: Number(formData.get("spo2")),
    icd10: formData.get("icd10") as string,
    planPrescription: formData.get("planPrescription") as string,
    planAction: (formData.get("planAction") as string) || undefined,
    isMedicallyConfirmed:
      formData.get("isMedicallyConfirmed") === "true" ||
      formData.get("isMedicallyConfirmed") === "on",
  };

  const validationResult = PemeriksaanKlinisSchema.safeParse(rawData);
  if (!validationResult.success) {
    const formattedErrors: Record<string, string> = {};
    for (const issue of validationResult.error.issues) {
      const key = issue.path[0]?.toString() || "form";
      if (!formattedErrors[key]) formattedErrors[key] = issue.message;
    }
    return {
      success: false,
      message: "Data formulir tidak memenuhi aturan validasi medis.",
      errors: formattedErrors,
    };
  }

  const validData = validationResult.data;
  const patientId = ((formData.get("patientId") as string) || "").trim();
  const bookingId = ((formData.get("bookingId") as string) || "").trim() || null;

  if (!patientId) {
    return { success: false, message: "Identitas pasien (patientId) wajib disertakan." };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { accessGrants: true, appointments: true },
  });

  if (!patient) {
    return { success: false, message: "Data pasien tidak ditemukan di basis data." };
  }

  const doctorId = auth.session.id;
  const faskesId = auth.session.faskesId || "FAS-01";

  const killSwitchCheck = await assertFaskesNotQuarantined(faskesId, "Penulisan RME");
  if (!killSwitchCheck.ok) {
    return { success: false, message: killSwitchCheck.message };
  }

  const canAccess =
    hasValidGrantForDoctor(patient.accessGrants, doctorId, faskesId) ||
    hasActiveEncounterForDoctor(patient.appointments, doctorId);

  if (!canAccess) {
    await recordSecurityAuditBestEffort({
      actorId: doctorId,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.IDOR_BLOCKED,
      targetResource: `/api/rme/write/${patient.id}`,
      severity: AuditSeverity.CRITICAL,
      detail: `BOLA Guard: Dokter ${doctorId} mencoba menulis RME pasien ${patient.id} tanpa consent atau encounter aktif.`,
    });
    return {
      success: false,
      message: "403 Forbidden: Anda tidak memiliki izin consent atau janji temu aktif untuk pasien ini.",
    };
  }

  const patientAllergies = Array.isArray(patient.allergies) ? patient.allergies : [];
  const detectedAllergies = patientAllergies.filter((allergy) =>
    validData.planPrescription.toLowerCase().includes(allergy.toLowerCase())
  );
  const forceOverride = formData.get("forceOverrideAllergy") === "true";

  if (detectedAllergies.length > 0 && !forceOverride) {
    return {
      success: false,
      message: `PERINGATAN KONTRAINDIKASI KLINIS (UR-T10): Resep memuat zat berbahaya bagi pasien (${detectedAllergies.join(
        ", "
      )}). Konfirmasi khusus diperlukan sebelum penyimpanan.`,
      errors: {
        planPrescription: `Kontraindikasi: Pasien alergi terhadap ${detectedAllergies.join(", ")}.`,
      },
    };
  }

  const recordId =
    ((formData.get("recordId") as string) || "").trim() ||
    `REC-2026-${Date.now().toString().slice(-6)}`;
  const version = formData.get("isAddendum") === "true" ? 2 : 1;
  const diagnosisShort =
    ((formData.get("assessment") as string) || "").trim() ||
    `Pemeriksaan Klinis Rawat Jalan (${validData.icd10})`;

  const clientEncryptedPayload = ((formData.get("encryptedPayload") as string) || "").trim();
  const clientIvHex = ((formData.get("ivHex") as string) || "").trim();
  const clientHmacDigest = ((formData.get("hmacDigest") as string) || "").trim();

  const hasValidClientCiphertext =
    /^[0-9a-fA-F]+$/.test(clientEncryptedPayload) &&
    clientEncryptedPayload.length % 2 === 0 &&
    /^[0-9a-fA-F]{24}$/.test(clientIvHex) &&
    /^[0-9a-fA-F]{64}$/.test(clientHmacDigest) &&
    clientIvHex.toLowerCase() !== STATIC_FORBIDDEN_IV &&
    clientHmacDigest.toLowerCase() !== EMPTY_SHA256_HMAC;

  let encryptedPayload: string;
  let ivHex: string;
  let hmacDigest: string;

  if (hasValidClientCiphertext) {
    encryptedPayload = clientEncryptedPayload;
    ivHex = clientIvHex;
    hmacDigest = clientHmacDigest;
  } else {
    const canonicalPayload: CanonicalSoapPayload = {
      subjective: validData.subjective,
      vitalSigns: {
        systolic: validData.systolic,
        diastolic: validData.diastolic,
        heartRate: validData.heartRate,
        temperature: validData.temperature,
        respiratoryRate: Number(formData.get("respiratoryRate")) || 20,
        spo2: validData.spo2,
      },
      assessment: { icd10: validData.icd10, desc: diagnosisShort },
      plan: {
        resep: validData.planPrescription
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
        tindakan: validData.planAction || "",
      },
      meta: {
        dokterId: doctorId,
        dokterNama: auth.session.name,
        dokterStr: auth.session.strNumber || "",
        faskesNama: auth.session.faskesName || "RSUP Dr. Sardjito",
        timestamp: new Date().toISOString(),
      },
    };

    const bundle = await encryptMedicalRecordPayload(canonicalPayload, patient.encryptionKeyHex, {
      patientId: patient.id,
      recordId,
      version,
    });
    encryptedPayload = bundle.encryptedPayload;
    ivHex = bundle.ivHex;
    hmacDigest = bundle.hmacDigest;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.medicalRecord.create({
        data: {
          id: recordId,
          patientId: patient.id,
          doctorId,
          faskesId,
          appointmentId: bookingId,
          primaryIcd10: validData.icd10,
          diagnosisShort,
          encryptedPayload,
          ivHex,
          hmacDigest,
          version,
          addendumReason: (formData.get("addendumReason") as string) || null,
          vitalSignsTrend: {
            systolic: validData.systolic,
            diastolic: validData.diastolic,
            heartRate: validData.heartRate,
            temperature: validData.temperature,
            spo2: validData.spo2,
            recordedAt: new Date().toISOString(),
          },
          claimStatus: "DRAFT",
        },
      });

      if (bookingId) {
        await tx.appointment.updateMany({
          where: { id: bookingId },
          data: { status: AppointmentStatus.COMPLETED },
        });
      }
    });
  } catch (dbError: unknown) {
    const msg = dbError instanceof Error ? dbError.message : "Kesalahan basis data";
    console.error("Prisma DB create medicalRecord error:", dbError);
    return {
      success: false,
      message: `Gagal menyimpan rekam medis terenkripsi ke PostgreSQL: ${msg}`,
    };
  }

  await recordSecurityAuditBestEffort({
    actorId: doctorId,
    actorName: auth.session.name,
    actorRole: auth.role,
    action: AuditAction.WRITE_RME,
    targetResource: `/api/rme/record/${recordId}`,
    severity: AuditSeverity.INFO,
    detail: `Dokter ${auth.session.name} menandatangani RME terenkripsi AEAD (${recordId}, v${version}) untuk pasien ${patient.id}.`,
  });

  safeRevalidate([
    `/nakes/periksa/${bookingId || "APT-2026-001"}`,
    "/nakes",
    "/nakes/jadwal",
    "/pasien/rekam-medis",
  ]);

  if (formData.get("skipRedirect") === "true") {
    return {
      success: true,
      message: "Rekam medis terenkripsi AEAD berhasil disimpan ke PostgreSQL.",
      data: { recordId },
    };
  }

  redirect("/nakes?status=record_created");
}
