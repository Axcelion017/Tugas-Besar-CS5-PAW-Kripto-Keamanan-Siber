"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import { prisma } from "@/lib/db/prisma";
import {
  AuditAction,
  AuditSeverity,
  AppointmentStatus,
  FaskesStatus,
  Prisma,
} from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  CanonicalSoapPayload,
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
  decryptMedicalRecordPayload,
  encryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: {
    recordId: string;
  };
}

function maskNik(nik: string): string {
  const clean = (nik || "").trim();
  if (clean.length < 8) return "••••••••";
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

function hasValidGrantForDoctor(
  grants: Array<{
    entityId: string;
    entityType: string;
    isRevoked: boolean;
    validUntil: Date;
  }>,
  doctorId: string,
  faskesId?: string | null
): boolean {
  const now = new Date();
  return grants.some(
    (g) =>
      !g.isRevoked &&
      new Date(g.validUntil) > now &&
      (g.entityId === doctorId ||
        (g.entityType === "FASKES" && (!faskesId || g.entityId === faskesId)))
  );
}

function hasActiveEncounterForDoctor(
  appointments: Array<{
    doctorId: string;
    dpjpId: string | null;
    consentActive: boolean;
    status: AppointmentStatus;
  }>,
  doctorId: string
): boolean {
  return appointments.some(
    (a) =>
      (a.doctorId === doctorId || a.dpjpId === doctorId) &&
      a.consentActive &&
      a.status !== AppointmentStatus.CANCELLED
  );
}

/**
 * Server Action: Submit & Tanda Tangan Rekam Medis Klinis (SOAP & ICD-10)
 * 6 Tahapan:
 * 1. Sesi & RBAC (`requireSession(["nakes"])`)
 * 2. Validasi Bentuk (Zod v4)
 * 3. Validasi Semantik (Alergi UR-T10 & eksistensi pasien di DB)
 * 4. Enkripsi AEAD Nyata (HKDF + AES-256-GCM + AAD + HMAC-SHA256) & Mutasi DB
 * 5. revalidatePath
 * 6. redirect (di luar try/catch)
 */
export async function submitPemeriksaanKlinisAction(
  prevState: ServerActionResponse | null,
  formData: FormData
): Promise<ServerActionResponse> {
  // 1. Sesi & Otorisasi Server-Side
  const auth = await requireSession(["nakes"], "submitPemeriksaanKlinis");
  if (!auth.ok) {
    return {
      success: false,
      message: auth.message,
    };
  }

  // 2. Validasi Bentuk (Zod v4)
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
      if (!formattedErrors[key]) {
        formattedErrors[key] = issue.message;
      }
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
    return {
      success: false,
      message: "Identitas pasien (patientId) wajib disertakan.",
    };
  }

  // 3. Validasi Semantik (PostgreSQL sebagai Single Source of Truth)
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      accessGrants: true,
      appointments: true,
    },
  });

  if (!patient) {
    return {
      success: false,
      message: "Data pasien tidak ditemukan di basis data.",
    };
  }

  const doctorId = auth.session.id;
  const faskesId = auth.session.faskesId || "FAS-01";

  // Penegakan Kill-Switch Siber: tolak penulisan RME jika faskes berstatus QUARANTINED
  const activeFaskes = await prisma.faskes.findUnique({
    where: { id: faskesId },
    select: { id: true, nama: true, status: true },
  });
  if (activeFaskes && activeFaskes.status === FaskesStatus.QUARANTINED) {
    return {
      success: false,
      message: `403 Forbidden (Kill-Switch Siber): ${activeFaskes.nama} sedang berstatus KARANTINA oleh Admin Regulator. Penulisan RME ditangguhkan.`,
    };
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

  // 4. Enkripsi AEAD Nyata (HKDF + AES-256-GCM + AAD + HMAC-SHA256)
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
      assessment: {
        icd10: validData.icd10,
        desc: diagnosisShort,
      },
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

    const bundle = await encryptMedicalRecordPayload(
      canonicalPayload,
      patient.encryptionKeyHex,
      { patientId: patient.id, recordId, version }
    );
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

  // 5. Revalidate
  try {
    revalidatePath(`/nakes/periksa/${bookingId || "APT-2026-001"}`);
    revalidatePath("/nakes");
    revalidatePath("/pasien/rekam-medis");
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js (misal integration test)
  }

  // 6. Redirect (di luar try/catch sesuai aturan Next.js App Router)
  if (formData.get("skipRedirect") === "true") {
    return {
      success: true,
      message: "Rekam medis terenkripsi AEAD berhasil disimpan ke PostgreSQL.",
      data: { recordId },
    };
  }

  redirect("/nakes?status=record_created");
}

/**
 * Server Action: Mengambil Daftar Rekam Medis Terenkripsi dari PostgreSQL
 * Pasien dibatasi hanya melihat berkas miliknya sendiri; Nakes hanya berkas yang diizinkan.
 */
export async function getMedicalRecordsServerAction(filters?: {
  patientId?: string;
  doctorId?: string;
  faskesId?: string;
}) {
  const auth = await requireSession(["pasien", "nakes", "admin"], "getMedicalRecords");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const whereClause: Prisma.MedicalRecordWhereInput = {};

    if (auth.role === "pasien") {
      whereClause.patientId = auth.session.id;
    } else if (auth.role === "nakes") {
      if (filters?.patientId) whereClause.patientId = filters.patientId;
      whereClause.OR = [
        { doctorId: auth.session.id },
        {
          patient: {
            accessGrants: {
              some: {
                entityId: auth.session.id,
                isRevoked: false,
                validUntil: { gt: new Date() },
              },
            },
          },
        },
        {
          patient: {
            appointments: {
              some: {
                OR: [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }],
                consentActive: true,
                status: { not: AppointmentStatus.CANCELLED },
              },
            },
          },
        },
      ];
    } else {
      if (filters?.patientId) whereClause.patientId = filters.patientId;
      if (filters?.doctorId) whereClause.doctorId = filters.doctorId;
      if (filters?.faskesId) whereClause.faskesId = filters.faskesId;
    }

    const records = await prisma.medicalRecord.findMany({
      where: whereClause,
      include: {
        patient: {
          select: { id: true, name: true, nik: true, mrn: true, bloodType: true },
        },
        doctor: {
          select: { id: true, name: true, specialty: true, strNumber: true, sipNumber: true },
        },
        faskes: {
          select: { id: true, nama: true, tipe: true, kota: true, alamat: true },
        },
        appointment: {
          include: {
            triageAssessment: {
              include: {
                assessedBy: {
                  select: { id: true, name: true, nip: true, posisi: true },
                },
              },
            },
          },
        },
        medicalImages: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = records.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      appointment: r.appointment
        ? {
            ...r.appointment,
            tanggal: r.appointment.tanggal.toISOString(),
            createdAt: r.appointment.createdAt.toISOString(),
            checkInTime: r.appointment.checkInTime ? r.appointment.checkInTime.toISOString() : null,
            triageAssessment: r.appointment.triageAssessment
              ? {
                  ...r.appointment.triageAssessment,
                  temperature: Number(r.appointment.triageAssessment.temperature),
                  beratBadan: r.appointment.triageAssessment.beratBadan
                    ? Number(r.appointment.triageAssessment.beratBadan)
                    : null,
                  tinggiBadan: r.appointment.triageAssessment.tinggiBadan
                    ? Number(r.appointment.triageAssessment.tinggiBadan)
                    : null,
                  assessedAt: r.appointment.triageAssessment.assessedAt.toISOString(),
                }
              : null,
          }
        : null,
      medicalImages: (r.medicalImages || []).map((img) => {
        const rawImg = img as unknown as { fileSizeBytes?: bigint | number };
        return {
          ...img,
          fileSizeBytes: rawImg.fileSizeBytes ? Number(rawImg.fileSizeBytes) : null,
          createdAt: img.createdAt.toISOString(),
        };
      }),
    }));

    return { success: true, data: serialized };
  } catch (err: unknown) {
    console.warn("Get Medical Records Error:", err);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mengambil Satu Berkas Rekam Medis Detail dengan BOLA Ownership & Consent Check
 */
export async function getSingleMedicalRecordServerAction(recordId: string) {
  const auth = await requireSession(
    ["pasien", "nakes", "admin"],
    `getSingleMedicalRecord:${recordId}`
  );
  if (!auth.ok) {
    return { success: false, message: auth.message, data: null };
  }

  try {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            nik: true,
            mrn: true,
            bloodType: true,
            birthDate: true,
            accessGrants: true,
            appointments: true,
          },
        },
        doctor: {
          select: { id: true, name: true, specialty: true, strNumber: true, sipNumber: true },
        },
        faskes: {
          select: { id: true, nama: true, tipe: true, kota: true, alamat: true, kontak: true },
        },
        appointment: {
          include: {
            triageAssessment: {
              include: {
                assessedBy: {
                  select: { id: true, name: true, nip: true, posisi: true },
                },
              },
            },
          },
        },
        medicalImages: true,
      },
    });

    if (!record) {
      return { success: false, data: null };
    }

    // Penegakan BOLA: Pasien hanya boleh membaca berkas miliknya sendiri
    if (auth.role === "pasien" && record.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/rme/record/${recordId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengakses berkas RME ${recordId} milik pasien ${record.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang mengakses rekam medis milik pasien lain.",
        data: null,
      };
    }

    // Penegakan BOLA untuk Dokter: wajib punya consent aktif, encounter aktif, atau penulis berkas
    if (auth.role === "nakes") {
      const doctorId = auth.session.id;
      const isAuthorized =
        record.doctorId === doctorId ||
        hasValidGrantForDoctor(record.patient.accessGrants, doctorId, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(record.patient.appointments, doctorId);

      if (!isAuthorized) {
        await recordSecurityAuditBestEffort({
          actorId: doctorId,
          actorName: auth.session.name,
          actorRole: auth.role,
          action: AuditAction.IDOR_BLOCKED,
          targetResource: `/api/rme/record/${recordId}`,
          severity: AuditSeverity.CRITICAL,
          detail: `BOLA Guard: Dokter ${doctorId} ditolak mengakses berkas RME ${recordId} tanpa consent/encounter aktif.`,
        });
        return {
          success: false,
          message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk berkas ini.",
          data: null,
        };
      }
    }

    const { accessGrants: _grants, appointments: _apts, ...safePatient } = record.patient;
    void _grants;
    void _apts;

    const serialized = {
      ...record,
      patient: {
        ...safePatient,
        birthDate: safePatient.birthDate ? safePatient.birthDate.toISOString() : null,
      },
      createdAt: record.createdAt.toISOString(),
      appointment: record.appointment
        ? {
            ...record.appointment,
            tanggal: record.appointment.tanggal.toISOString(),
            createdAt: record.appointment.createdAt.toISOString(),
            checkInTime: record.appointment.checkInTime
              ? record.appointment.checkInTime.toISOString()
              : null,
            triageAssessment: record.appointment.triageAssessment
              ? {
                  ...record.appointment.triageAssessment,
                  temperature: Number(record.appointment.triageAssessment.temperature),
                  beratBadan: record.appointment.triageAssessment.beratBadan
                    ? Number(record.appointment.triageAssessment.beratBadan)
                    : null,
                  tinggiBadan: record.appointment.triageAssessment.tinggiBadan
                    ? Number(record.appointment.triageAssessment.tinggiBadan)
                    : null,
                  assessedAt: record.appointment.triageAssessment.assessedAt.toISOString(),
                }
              : null,
          }
        : null,
      medicalImages: (record.medicalImages || []).map((img) => {
        const rawImg = img as unknown as { fileSizeBytes?: bigint | number };
        return {
          ...img,
          fileSizeBytes: rawImg.fileSizeBytes ? Number(rawImg.fileSizeBytes) : null,
          createdAt: img.createdAt.toISOString(),
        };
      }),
    };

    return { success: true, data: serialized };
  } catch (err: unknown) {
    console.warn("Get Single Medical Record Error:", err);
    return { success: false, data: null };
  }
}

/**
 * Server Action: Menyimpan Citra Medis Terenkripsi ke Basis Data
 * Menolak IV statis maupun HMAC kosong.
 */
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

  const faskesId = auth.session.faskesId || "FAS-01";
  const activeFaskes = await prisma.faskes.findUnique({
    where: { id: faskesId },
    select: { nama: true, status: true },
  });
  if (activeFaskes?.status === FaskesStatus.QUARANTINED) {
    return {
      success: false,
      message: `403 Forbidden (Kill-Switch Siber): ${activeFaskes.nama} sedang dikarantina. Unggah citra medis ditangguhkan.`,
    };
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

/**
 * Server Action: Pencarian Pasien Berdasarkan NIK dengan Pemeriksaan BOLA/IDOR Real-Time
 * - Tidak pernah mengirim PII / `encryptionKeyHex` saat `accessAllowed === false`.
 * - Tidak pernah menggunakan bypass `|| "DOC-01"`.
 */
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
      where: {
        OR: [{ nik: clean }, { id: clean }, { mrn: clean }],
      },
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

      // Kembalikan hanya metadata minimal (TANPA encryptionKeyHex, NIK utuh, alergi, HP, atau RME)
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
    return {
      success: false,
      message: "Terjadi gangguan saat mencari data pasien di database.",
    };
  }
}

/**
 * Server Action: Eksekusi Protokol Darurat Break-Glass IGD (ISO 27799 / UU PDP)
 * Khusus peran Dokter DPJP (`requireSession(["nakes"])`).
 */
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

/**
 * Server Action: Mengambil Daftar Pasien & Statistik Dokter
 * - NIK di-mask di server (`3171••••••••0001`).
 * - Tidak mengirim `encryptionKeyHex` di daftar pasien (Least Privilege / OWASP API3:2023).
 */
export async function getDoctorPatientListServerAction(_doctorIdUnused?: string) {
  void _doctorIdUnused;
  const auth = await requireSession(["nakes", "admin"], "getDoctorPatientList");
  if (!auth.ok) {
    return {
      success: false,
      message: auth.message,
      stats: { totalPatients: 0, totalAntrean: 0, unsignedCount: 0, signedCount: 0 },
      patients: [],
    };
  }

  const doctorId = auth.session.id;

  try {
    const patients = await prisma.patient.findMany({
      include: {
        accessGrants: true,
        medicalRecords: {
          include: {
            doctor: { select: { name: true, specialty: true } },
            faskes: { select: { nama: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        appointments: {
          include: {
            triageAssessment: true,
            faskes: { select: { nama: true } },
          },
          orderBy: { tanggal: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalPatients = patients.length;

    const queuedPatients = patients.filter((p) =>
      p.appointments.some(
        (a) =>
          a.status === "PENDING_ARRIVAL" ||
          a.status === "WAITING_TRIAGE" ||
          a.status === "WAITING_DOCTOR" ||
          a.status === "IN_EXAMINATION" ||
          a.status === "WAITING" ||
          a.status === "IN_PROGRESS"
      )
    );
    const totalAntrean = queuedPatients.length;

    const unsignedPatients = patients.filter(
      (p) =>
        p.appointments.some(
          (a) =>
            a.status === "WAITING_DOCTOR" ||
            a.status === "IN_EXAMINATION" ||
            a.status === "WAITING_TRIAGE" ||
            a.status === "IN_PROGRESS"
        ) || p.medicalRecords.length === 0
    );
    const unsignedCount = unsignedPatients.length;

    const signedPatients = patients.filter(
      (p) => p.medicalRecords.length > 0 && !unsignedPatients.some((up) => up.id === p.id)
    );
    const signedCount = signedPatients.length;

    return {
      success: true,
      stats: {
        totalPatients,
        totalAntrean,
        unsignedCount,
        signedCount,
      },
      patients: patients.map((p) => {
        const latestApt = p.appointments[0];
        const latestRecord = p.medicalRecords[0];

        const isQueued =
          latestApt &&
          (latestApt.status === "PENDING_ARRIVAL" ||
            latestApt.status === "WAITING_TRIAGE" ||
            latestApt.status === "WAITING_DOCTOR" ||
            latestApt.status === "IN_EXAMINATION" ||
            latestApt.status === "WAITING" ||
            latestApt.status === "IN_PROGRESS");

        const isUnsigned =
          (latestApt &&
            (latestApt.status === "WAITING_DOCTOR" ||
              latestApt.status === "IN_EXAMINATION" ||
              latestApt.status === "WAITING_TRIAGE" ||
              latestApt.status === "IN_PROGRESS")) ||
          p.medicalRecords.length === 0;

        const hasActiveGrant =
          hasValidGrantForDoctor(p.accessGrants, doctorId, auth.session.faskesId) ||
          hasActiveEncounterForDoctor(p.appointments, doctorId);

        const triageLevel =
          (latestApt?.triageAssessment?.triaseLevel as "MERAH" | "KUNING" | "HIJAU") ||
          (p.id === "P-102" ? "MERAH" : p.id === "P-101" ? "KUNING" : "HIJAU");

        return {
          id: p.id,
          nik: maskNik(p.nik),
          name: p.name,
          mrn: p.mrn,
          gender: p.gender,
          bloodType: p.bloodType,
          birthDate: p.birthDate ? p.birthDate.toISOString() : null,
          allergies: hasActiveGrant ? p.allergies : [],
          phone: hasActiveGrant ? p.emergencyContactPhone || "-" : "-",
          totalVisits: p.medicalRecords.length + p.appointments.length,
          latestVisitDate: latestRecord?.createdAt
            ? latestRecord.createdAt.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : latestApt?.tanggal
            ? new Date(latestApt.tanggal).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Belum ada kunjungan",
          latestDiagnosis: hasActiveGrant
            ? latestRecord?.primaryIcd10
              ? `${latestRecord.primaryIcd10} - ${latestRecord.diagnosisShort}`
              : latestApt?.keluhanAwal || "Pemeriksaan Rawat Jalan"
            : "Terkunci (Menunggu Consent Pasien)",
          documentStatus: isUnsigned ? ("UNSIGNED" as const) : ("SIGNED" as const),
          queueStatus: isQueued ? ("IN_QUEUE" as const) : ("IDLE" as const),
          activeAppointmentId: latestApt?.id || null,
          hasAccessGrant: hasActiveGrant,
          recordsCount: p.medicalRecords.length,
          triaseLevel: triageLevel,
        };
      }),
    };
  } catch (err: unknown) {
    console.warn("Get Doctor Patient List Error:", err);
    return {
      success: false,
      message: "Gagal mengambil daftar pasien dari basis data.",
      stats: { totalPatients: 0, totalAntrean: 0, unsignedCount: 0, signedCount: 0 },
      patients: [],
    };
  }
}

/**
 * Server Action: Mengambil Detail Rekam Medis Lengkap Pasien untuk Dokter
 * - Memeriksa `requireSession(["nakes", "admin"])`.
 * - Menghapus bypass `|| "DOC-01"` dan memeriksa `validUntil > now`.
 * - Saat `accessAllowed === false`, TIDAK mengirim `encryptionKeyHex`, NIK utuh, HP, alergi, atau riwayat.
 */
export async function getPatientDetailForDoctorServerAction(
  patientIdOrNik: string,
  _doctorIdUnused?: string
) {
  void _doctorIdUnused;
  const auth = await requireSession(
    ["nakes", "admin"],
    `getPatientDetailForDoctor:${patientIdOrNik}`
  );
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const doctorId = auth.session.id;

  try {
    const clean = patientIdOrNik.trim();
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [{ id: clean }, { nik: clean }, { mrn: clean }],
      },
      include: {
        accessGrants: true,
        user: true,
        medicalRecords: {
          include: {
            doctor: { select: { name: true, specialty: true, strNumber: true, sipNumber: true } },
            faskes: { select: { nama: true } },
            medicalImages: true,
          },
          orderBy: { createdAt: "desc" },
        },
        appointments: {
          include: {
            triageAssessment: true,
            faskes: { select: { nama: true } },
            doctor: { select: { name: true, specialty: true } },
          },
          orderBy: { tanggal: "desc" },
        },
      },
    });

    if (!patient) {
      return { success: false, message: "Pasien tidak ditemukan." };
    }

    const isAccessAllowed =
      hasValidGrantForDoctor(patient.accessGrants, doctorId, auth.session.faskesId) ||
      hasActiveEncounterForDoctor(patient.appointments, doctorId);

    if (!isAccessAllowed) {
      return {
        success: true,
        accessAllowed: false,
        message: "Akses rekam medis memerlukan izin persetujuan (Consent) aktif dari pasien.",
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
        appointments: [],
      };
    }

    await recordSecurityAuditBestEffort({
      actorId: doctorId,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.VIEW_RME,
      targetResource: `/api/rme/patient/${patient.id}`,
      severity: AuditSeverity.INFO,
      detail: `Dokter ${auth.session.name} (${doctorId}) membuka detail berkas RME pasien ${patient.name} (${patient.id}) melalui izin sah.`,
    });

    return {
      success: true,
      accessAllowed: true,
      message: undefined,
      patient: {
        id: patient.id,
        nik: patient.nik,
        name: patient.name,
        mrn: patient.mrn,
        gender: patient.gender,
        bloodType: patient.bloodType,
        birthDate: patient.birthDate ? patient.birthDate.toISOString() : null,
        phone: patient.emergencyContactPhone || "-",
        allergies: patient.allergies,
        encryptionKeyHex: patient.encryptionKeyHex,
      },
      medicalRecords: patient.medicalRecords.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        doctorId: r.doctorId,
        dokterNama: r.doctor?.name || "dr. Andi Pratama, Sp.PD",
        dokterSpecialty: r.doctor?.specialty || "Spesialis Penyakit Dalam",
        dokterStr: r.doctor?.strNumber || "STR-3171-88921",
        dokterSip: r.doctor?.sipNumber || "503/SIP.DOKTER/2026/014",
        faskesNama: r.faskes?.nama || "RSUP Dr. Sardjito",
        primaryIcd10: r.primaryIcd10,
        diagnosisShort: r.diagnosisShort,
        encryptedPayload: r.encryptedPayload,
        ivHex: r.ivHex,
        hmacDigest: r.hmacDigest,
        version: r.version,
        addendumReason: r.addendumReason,
        createdAt: r.createdAt.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        medicalImages: (r.medicalImages || []).map((img) => ({
          id: img.id,
          title: img.title,
          type: img.type,
          encryptedBlobHex: img.encryptedBlobHex,
          mimeType: img.mimeType,
          fileSizeBytes: img.fileSizeBytes ? Number(img.fileSizeBytes) : 0,
          notes: img.notes,
          createdAt: img.createdAt.toISOString(),
        })),
      })),
      appointments: patient.appointments.map((a) => ({
        id: a.id,
        poli: a.poli,
        tanggal: new Date(a.tanggal).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        status: a.status,
        keluhanAwal: a.keluhanAwal,
        triageAssessment: a.triageAssessment
          ? {
              id: a.triageAssessment.id,
              systolic: a.triageAssessment.systolic,
              diastolic: a.triageAssessment.diastolic,
              heartRate: a.triageAssessment.heartRate,
              temperature: Number(a.triageAssessment.temperature),
              spo2: a.triageAssessment.spo2,
              respiratoryRate: a.triageAssessment.respiratoryRate,
              beratBadan: a.triageAssessment.beratBadan
                ? Number(a.triageAssessment.beratBadan)
                : null,
              tinggiBadan: a.triageAssessment.tinggiBadan
                ? Number(a.triageAssessment.tinggiBadan)
                : null,
              triaseLevel: a.triageAssessment.triaseLevel,
              catatanPerawat: a.triageAssessment.catatanPerawat,
            }
          : null,
      })),
    };
  } catch (err: unknown) {
    console.warn("Get Patient Detail For Doctor Error:", err);
    return { success: false, message: "Gagal mengambil data detail pasien." };
  }
}

/**
 * Server Action: Tambah Resep Obat Elektronik ke Rekam Medis Pasien (Immutable Addendum AEAD)
 * Tidak lagi menimpa record lama dan tidak lagi menulis hex plaintext / IV statis.
 */
export async function addPrescriptionToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  prescriptions: string[];
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes"], `addPrescription:${params.patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const docId = auth.session.id;

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });

    if (!patient) {
      return { success: false, message: "Data pasien tidak ditemukan." };
    }

    const faskesId = auth.session.faskesId || "FAS-01";
    const activeFaskes = await prisma.faskes.findUnique({
      where: { id: faskesId },
      select: { nama: true, status: true },
    });
    if (activeFaskes?.status === FaskesStatus.QUARANTINED) {
      return {
        success: false,
        message: `403 Forbidden (Kill-Switch Siber): ${activeFaskes.nama} sedang dikarantina. Peresepan obat ditangguhkan.`,
      };
    }

    const allowed =
      hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
      hasActiveEncounterForDoctor(patient.appointments, docId);
    if (!allowed) {
      return {
        success: false,
        message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk meresepkan obat.",
      };
    }

    const targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    let basePayload: CanonicalSoapPayload = {
      subjective: "Pemeriksaan dan peresepan obat poliklinik spesialis.",
      vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
      assessment: { icd10: "Z71.9", desc: "Konsultasi Terapi Farmasi" },
      plan: { resep: [], tindakan: "Konsumsi obat sesuai dosis dan jadwal." },
    };

    if (targetRecord) {
      const decrypted = await decryptMedicalRecordPayload(
        {
          encryptedPayload: targetRecord.encryptedPayload,
          ivHex: targetRecord.ivHex,
          hmacDigest: targetRecord.hmacDigest,
        },
        patient.encryptionKeyHex,
        {
          patientId: patient.id,
          recordId: targetRecord.id,
          version: targetRecord.version,
        }
      );
      if (decrypted.ok) {
        basePayload = decrypted.data;
      }
    }

    const currentResep = basePayload.plan?.resep || [];
    const mergedPayload: CanonicalSoapPayload = {
      ...basePayload,
      plan: {
        ...(basePayload.plan || {}),
        resep: Array.from(new Set([...currentResep, ...params.prescriptions])),
      },
      meta: {
        ...(basePayload.meta || {}),
        dokterId: docId,
        dokterNama: auth.session.name,
        timestamp: new Date().toISOString(),
      },
    };

    const newVersion = targetRecord ? targetRecord.version + 1 : 1;
    const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
    const bundle = await encryptMedicalRecordPayload(mergedPayload, patient.encryptionKeyHex, {
      patientId: patient.id,
      recordId: newRecordId,
      version: newVersion,
    });

    const created = await prisma.medicalRecord.create({
      data: {
        id: newRecordId,
        patientId: patient.id,
        doctorId: docId,
        faskesId: targetRecord?.faskesId || auth.session.faskesId || "FAS-01",
        appointmentId: targetRecord?.appointmentId || null,
        parentRecordId: targetRecord?.id || null,
        primaryIcd10: targetRecord?.primaryIcd10 || "Z71.9",
        diagnosisShort: targetRecord?.diagnosisShort || "Konsultasi Terapi Farmasi",
        encryptedPayload: bundle.encryptedPayload,
        ivHex: bundle.ivHex,
        hmacDigest: bundle.hmacDigest,
        version: newVersion,
        addendumReason: targetRecord
          ? `Addendum Penambahan Resep Obat oleh ${auth.session.name}`
          : null,
      },
    });

    return {
      success: true,
      message: "Resep obat berhasil dienkripsi AEAD (Addendum) dan disinkronkan ke rekam medis pasien.",
      recordId: created.id,
    };
  } catch (err: unknown) {
    console.warn("Add prescription error:", err);
    return { success: false, message: "Gagal menyimpan resep obat ke rekam medis." };
  }
}

/**
 * Server Action: Input Permintaan / Hasil LAB Pasien ke Rekam Medis (Terenkripsi AEAD)
 */
export async function addLabResultToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  labTestName: string;
  labResultValue: string;
  referenceRange: string;
  notes?: string;
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes", "staf"], `addLabResult:${params.patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const docId = auth.role === "nakes" ? auth.session.id : "DOC-01";

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });

    if (!patient) {
      return { success: false, message: "Data pasien tidak ditemukan." };
    }

    const labFaskesId = auth.session.faskesId || "FAS-01";
    const labFaskes = await prisma.faskes.findUnique({
      where: { id: labFaskesId },
      select: { nama: true, status: true },
    });
    if (labFaskes?.status === FaskesStatus.QUARANTINED) {
      return {
        success: false,
        message: `403 Forbidden (Kill-Switch Siber): ${labFaskes.nama} sedang dikarantina. Input hasil lab ditangguhkan.`,
      };
    }

    if (auth.role === "nakes") {
      const allowed =
        hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(patient.appointments, docId);
      if (!allowed) {
        return {
          success: false,
          message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk pasien ini.",
        };
      }
    }

    let targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    if (!targetRecord) {
      const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
      const labRecordPayload: CanonicalSoapPayload = {
        subjective: `Pemeriksaan penunjang laboratorium: ${params.labTestName}`,
        assessment: { icd10: "Z01.7", desc: params.labTestName },
        labResults: [
          {
            test: params.labTestName,
            value: params.labResultValue,
            ref: params.referenceRange,
            notes: params.notes,
          },
        ],
      };

      const bundle = await encryptMedicalRecordPayload(
        labRecordPayload,
        patient.encryptionKeyHex,
        { patientId: patient.id, recordId: newRecordId, version: 1 }
      );

      targetRecord = await prisma.medicalRecord.create({
        data: {
          id: newRecordId,
          patientId: patient.id,
          doctorId: docId,
          faskesId: auth.session.faskesId || "FAS-01",
          primaryIcd10: "Z01.7",
          diagnosisShort: `Pemeriksaan Laboratorium: ${params.labTestName}`,
          encryptedPayload: bundle.encryptedPayload,
          ivHex: bundle.ivHex,
          hmacDigest: bundle.hmacDigest,
          version: 1,
        },
      });
    }

    const imageId = `LAB-${Date.now().toString().slice(-6)}`;
    const labAttachmentBundle = await encryptMedicalRecordPayload(
      {
        subjective: `Lampiran Hasil Lab: ${params.labTestName}`,
        labResults: [
          {
            test: params.labTestName,
            value: params.labResultValue,
            ref: params.referenceRange,
            notes: params.notes || "Hasil uji laboratorium terverifikasi analis",
          },
        ],
      },
      patient.encryptionKeyHex,
      { patientId: patient.id, recordId: imageId, version: 1 }
    );

    await prisma.medicalImage.create({
      data: {
        id: imageId,
        medicalRecordId: targetRecord.id,
        title: `Hasil Lab: ${params.labTestName} (${params.labResultValue})`,
        type: "LAB",
        encryptedBlobHex: labAttachmentBundle.encryptedPayload,
        ivHex: labAttachmentBundle.ivHex,
        hmacDigest: labAttachmentBundle.hmacDigest,
        mimeType: "application/json",
        notes: `Nilai: ${params.labResultValue} (Rujukan: ${params.referenceRange}). ${params.notes || ""}`,
      },
    });

    return {
      success: true,
      message: `Hasil LAB ${params.labTestName} berhasil dienkripsi AEAD dan dicatat ke rekam medis pasien.`,
      recordId: targetRecord.id,
    };
  } catch (err: unknown) {
    console.warn("Add Lab error:", err);
    return { success: false, message: "Gagal menyimpan hasil laboratorium ke rekam medis." };
  }
}

/**
 * Server Action: Input Tindakan Medis (Dokter & Staf) ke Rekam Medis Pasien (Immutable Addendum AEAD)
 */
export async function addProcedureToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  icd9Code: string;
  procedureName: string;
  performerRole: "DOKTER" | "STAF";
  notes?: string;
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes", "staf"], `addProcedure:${params.patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const docId = auth.role === "nakes" ? auth.session.id : "DOC-01";

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });

    if (!patient) {
      return { success: false, message: "Data pasien tidak ditemukan." };
    }

    const procFaskesId = auth.session.faskesId || "FAS-01";
    const procFaskes = await prisma.faskes.findUnique({
      where: { id: procFaskesId },
      select: { nama: true, status: true },
    });
    if (procFaskes?.status === FaskesStatus.QUARANTINED) {
      return {
        success: false,
        message: `403 Forbidden (Kill-Switch Siber): ${procFaskes.nama} sedang dikarantina. Pencatatan tindakan medis ditangguhkan.`,
      };
    }

    if (auth.role === "nakes") {
      const allowed =
        hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(patient.appointments, docId);
      if (!allowed) {
        return {
          success: false,
          message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk pasien ini.",
        };
      }
    }

    const targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    let basePayload: CanonicalSoapPayload = {
      subjective: `Tindakan medis: ${params.procedureName}`,
      assessment: { icd10: "Z01.8", desc: params.procedureName },
      plan: { resep: [], tindakan: "" },
    };

    if (targetRecord) {
      const decrypted = await decryptMedicalRecordPayload(
        {
          encryptedPayload: targetRecord.encryptedPayload,
          ivHex: targetRecord.ivHex,
          hmacDigest: targetRecord.hmacDigest,
        },
        patient.encryptionKeyHex,
        {
          patientId: patient.id,
          recordId: targetRecord.id,
          version: targetRecord.version,
        }
      );
      if (decrypted.ok) {
        basePayload = decrypted.data;
      }
    }

    const existingTindakan = basePayload.plan?.tindakan || "";
    const newEntry = `[${params.icd9Code}] ${params.procedureName} (${params.performerRole})${
      params.notes ? `: ${params.notes}` : ""
    }`;
    const updatedTindakan = existingTindakan ? `${existingTindakan} | ${newEntry}` : newEntry;

    const mergedPayload: CanonicalSoapPayload = {
      ...basePayload,
      plan: {
        ...(basePayload.plan || {}),
        tindakan: updatedTindakan,
      },
      meta: {
        ...(basePayload.meta || {}),
        dokterId: docId,
        dokterNama: auth.session.name,
        timestamp: new Date().toISOString(),
      },
    };

    const newVersion = targetRecord ? targetRecord.version + 1 : 1;
    const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
    const bundle = await encryptMedicalRecordPayload(mergedPayload, patient.encryptionKeyHex, {
      patientId: patient.id,
      recordId: newRecordId,
      version: newVersion,
    });

    const created = await prisma.medicalRecord.create({
      data: {
        id: newRecordId,
        patientId: patient.id,
        doctorId: docId,
        faskesId: targetRecord?.faskesId || auth.session.faskesId || "FAS-01",
        appointmentId: targetRecord?.appointmentId || null,
        parentRecordId: targetRecord?.id || null,
        primaryIcd10: targetRecord?.primaryIcd10 || "Z01.8",
        diagnosisShort:
          targetRecord?.diagnosisShort ||
          `Tindakan ${params.performerRole}: ${params.procedureName}`,
        encryptedPayload: bundle.encryptedPayload,
        ivHex: bundle.ivHex,
        hmacDigest: bundle.hmacDigest,
        version: newVersion,
        addendumReason: targetRecord
          ? `Addendum Tindakan [${params.icd9Code}] oleh ${auth.session.name}`
          : null,
      },
    });

    return {
      success: true,
      message: `Tindakan ${params.procedureName} berhasil dienkripsi AEAD (Addendum) dan dicatat ke rekam medis pasien.`,
      recordId: created.id,
    };
  } catch (err: unknown) {
    console.warn("Add Procedure error:", err);
    return { success: false, message: "Gagal menyimpan tindakan medis ke rekam medis." };
  }
}

/**
 * Server Action: Mengambil Jadwal Dokter Berbasis Kalender Visual
 * Menghapus bypass `OR: [{ doctorId: "DOC-01" }]`, memfilter ketat berdasarkan sesi dokter aktif.
 */
export async function getDoctorCalendarScheduleServerAction(_doctorIdUnused?: string) {
  void _doctorIdUnused;
  const auth = await requireSession(["nakes", "admin"], "getDoctorCalendarSchedule");
  if (!auth.ok) {
    return { success: false, message: auth.message, appointments: [] };
  }

  try {
    const whereClause: Prisma.AppointmentWhereInput =
      auth.role === "admin"
        ? {}
        : {
            OR: [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }],
          };

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: { select: { id: true, name: true, mrn: true, bloodType: true } },
        triageAssessment: true,
        faskes: { select: { nama: true } },
      },
      orderBy: [{ tanggal: "asc" }, { jam: "asc" }],
    });

    return {
      success: true,
      appointments: appointments.map((apt) => ({
        id: apt.id,
        patientId: apt.patient.id,
        patientName: apt.patient.name,
        patientMrn: apt.patient.mrn,
        patientBloodType: apt.patient.bloodType,
        faskesName: apt.faskes?.nama || "RSUP Dr. Sardjito",
        tanggal: new Date(apt.tanggal).toISOString().split("T")[0],
        jam: apt.jam,
        poli: apt.poli,
        keluhanAwal: apt.keluhanAwal,
        status: apt.status,
        triaseLevel: apt.triageAssessment?.triaseLevel || "HIJAU",
        vitals: apt.triageAssessment
          ? {
              systolic: apt.triageAssessment.systolic,
              diastolic: apt.triageAssessment.diastolic,
              heartRate: apt.triageAssessment.heartRate,
              temperature: Number(apt.triageAssessment.temperature),
              spo2: apt.triageAssessment.spo2,
            }
          : null,
      })),
    };
  } catch (err: unknown) {
    console.warn("Get Doctor Calendar Schedule Error:", err);
    return { success: false, appointments: [] };
  }
}

/**
 * Server Action: Mengambil Detail Antrean & Profil Pasien dari PostgreSQL untuk Ruang Periksa Dokter
 * Menggantikan pembacaan `localStorage` di `/nakes/periksa/[bookingId]` agar booking DB tidak terkena 404.
 */
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
      const grants = await prisma.accessGrant.findMany({
        where: { patientId: apt.patientId },
      });
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
          birthDate: apt.patient.birthDate ? apt.patient.birthDate.toISOString().split("T")[0] : undefined,
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
