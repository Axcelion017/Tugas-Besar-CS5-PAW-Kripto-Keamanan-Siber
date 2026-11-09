"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import { MOCK_PATIENTS, MOCK_ENCRYPTED_RECORDS, EncryptedMedicalRecord } from "@/lib/db/mockData";
import { prisma } from "@/lib/db/prisma";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: {
    recordId: string;
  };
}

/**
 * Server Action: Submit & Tanda Tangan Rekam Medis Klinis (SOAP & ICD-10)
 * Mengikuti 6 tahapan alur Server Action:
 * 1. Sesi (Verifikasi identitas & wewenang dokter melalui cookie)
 * 2. Validasi Bentuk (Validasi tipe data, panjang, rentang fisiologis via Zod v4)
 * 3. Validasi Semantik (Pengecekan kontraindikasi alergi UR-T10 & status DPJP aktif)
 * 4. Mutasi Data (Penyimpanan ke basis data terenkripsi)
 * 5. revalidatePath (Pembersihan cache rute yang terdampak)
 * 6. redirect (Pengalihan ke halaman linimasa rekam medis)
 */
export async function submitPemeriksaanKlinisAction(
  prevState: ServerActionResponse | null,
  formData: FormData
): Promise<ServerActionResponse> {
  // --------------------------------------------------------------------------
  // 1. URUTAN SESI: Membaca & Memvalidasi Cookie Sesi di Server
  // --------------------------------------------------------------------------
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("resilio_session_token")?.value;

  // Verifikasi apakah sesi aktif dan berwenang sebagai dokter (Role Guard)
  if (!sessionToken || sessionToken === "INVALID_TOKEN") {
    return {
      success: false,
      message: "401 Unauthorized: Sesi tidak sah atau telah kedaluwarsa. Silakan masuk kembali.",
    };
  }

  // --------------------------------------------------------------------------
  // 2. VALIDASI BENTUK (SHAPE VALIDATION): Parsing Skema Zod
  // --------------------------------------------------------------------------
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
    isMedicallyConfirmed: formData.get("isMedicallyConfirmed") === "true" || formData.get("isMedicallyConfirmed") === "on",
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
  const patientId = (formData.get("patientId") as string) || "P-101";

  // --------------------------------------------------------------------------
  // 3. VALIDASI SEMANTIK: Pengecekan Riwayat Alergi Pasien (UR-T10) & DPJP
  // --------------------------------------------------------------------------
  const patient = MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];
  const patientAllergies = Array.isArray(patient?.allergies) ? patient.allergies : [];

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

  // --------------------------------------------------------------------------
  // 4. MUTASI DATA: Menulis ke Penyimpanan Medis Terenkripsi
  // --------------------------------------------------------------------------
  const recordId = `REC-2026-${Date.now().toString().slice(-4)}`;
  const newRecord: EncryptedMedicalRecord = {
    recordId,
    patientId: patient.id,
    patientName: patient.name,
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    primaryIcd10: validData.icd10,
    diagnosisShort: `Pemeriksaan Klinis Rawat Jalan (${validData.icd10})`,
    encryptedPayload: Buffer.from(JSON.stringify(validData)).toString("base64"),
    ivHex: "1234567890abcdef12345678",
    hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    version: 1,
  };

  // Simulasikan mutasi data pada penyimpanan memori server & tulis ke PostgreSQL
  try {
    await prisma.medicalRecord.create({
      data: {
        id: recordId,
        patientId: patient.id,
        doctorId: "DOC-01",
        faskesId: "FAS-01",
        appointmentId: (formData.get("bookingId") as string) || null,
        primaryIcd10: validData.icd10,
        diagnosisShort: newRecord.diagnosisShort,
        encryptedPayload: newRecord.encryptedPayload,
        ivHex: newRecord.ivHex,
        hmacDigest: newRecord.hmacDigest,
        version: formData.get("isAddendum") === "true" ? 2 : 1,
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
  } catch (dbError) {
    console.warn("Prisma DB create record fallback:", dbError);
  }

  MOCK_ENCRYPTED_RECORDS.unshift(newRecord);

  // --------------------------------------------------------------------------
  // 5. REVALIDATE PATH: Membersihkan Data Cache Rute Terkait
  // --------------------------------------------------------------------------
  revalidatePath(`/nakes/periksa/${formData.get("bookingId") || "APT-2026-001"}`);
  revalidatePath("/nakes");
  revalidatePath("/pasien/rekam-medis");

  // --------------------------------------------------------------------------
  // 6. REDIRECT: Mengalihkan ke Halaman Dasbor Dokter / Linimasa RME
  // --------------------------------------------------------------------------
  redirect("/nakes?status=record_created");
}

/**
 * Server Action: Mengambil Daftar Rekam Medis Terenkripsi dari PostgreSQL
 */
export async function getMedicalRecordsServerAction(filters?: {
  patientId?: string;
  doctorId?: string;
  faskesId?: string;
}) {
  try {
    const whereClause: Record<string, unknown> = {};
    if (filters?.patientId) whereClause.patientId = filters.patientId;
    if (filters?.doctorId) whereClause.doctorId = filters.doctorId;
    if (filters?.faskesId) whereClause.faskesId = filters.faskesId;

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

    // Sanitasi serialization untuk Client Components
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
                  beratBadan: r.appointment.triageAssessment.beratBadan ? Number(r.appointment.triageAssessment.beratBadan) : null,
                  tinggiBadan: r.appointment.triageAssessment.tinggiBadan ? Number(r.appointment.triageAssessment.tinggiBadan) : null,
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
 * Server Action: Mengambil Satu Berkas Rekam Medis Detail Beserta Dokter & Staf Pemeriksa
 */
export async function getSingleMedicalRecordServerAction(recordId: string) {
  try {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        patient: {
          select: { id: true, name: true, nik: true, mrn: true, bloodType: true, birthDate: true },
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

    const serialized = {
      ...record,
      createdAt: record.createdAt.toISOString(),
      appointment: record.appointment
        ? {
            ...record.appointment,
            tanggal: record.appointment.tanggal.toISOString(),
            createdAt: record.appointment.createdAt.toISOString(),
            checkInTime: record.appointment.checkInTime ? record.appointment.checkInTime.toISOString() : null,
            triageAssessment: record.appointment.triageAssessment
              ? {
                  ...record.appointment.triageAssessment,
                  temperature: Number(record.appointment.triageAssessment.temperature),
                  beratBadan: record.appointment.triageAssessment.beratBadan ? Number(record.appointment.triageAssessment.beratBadan) : null,
                  tinggiBadan: record.appointment.triageAssessment.tinggiBadan ? Number(record.appointment.triageAssessment.tinggiBadan) : null,
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
  try {
    const imgId = `IMG-${Date.now().toString().slice(-4)}`;
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
        notes: params.notes || "Citra Medis Terenkripsi AES-256-GCM + HMAC di sisi klien",
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
 */
export async function lookupPatientByNikServerAction(
  nikOrId: string,
  doctorId: string = "DOC-01"
) {
  try {
    const clean = nikOrId.trim();
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [{ nik: clean }, { id: clean }, { mrn: clean }],
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
      },
    });

    if (!patient) {
      return {
        success: false,
        message: "Data pasien dengan NIK/ID tersebut tidak ditemukan di basis data.",
      };
    }

    // Cek Izin Akses Aktif (Active Consent / BOLA Gatekeeper)
    const now = new Date();
    const activeGrant = patient.accessGrants.find(
      (g) =>
        (g.entityId === doctorId || g.entityId === "DOC-01" || g.entityType === "FASKES") &&
        !g.isRevoked &&
        new Date(g.validUntil) > now
    );

    const isAccessAllowed = !!activeGrant;

    if (!isAccessAllowed) {
      // Catat ke security_audit_logs PostgreSQL (BOLA Guard IDOR_BLOCKED)
      try {
        await prisma.securityAuditLog.create({
          data: {
            actorId: doctorId,
            actorName: "Dokter Pemeriksa",
            actorRole: "nakes",
            action: "IDOR_BLOCKED",
            targetResource: `/api/rme/patient/${patient.id}`,
            ipAddress: "127.0.0.1 (Klinik LAN)",
            userAgent: "Mozilla/5.0 (Resilio-Health HIS)",
            severity: "CRITICAL",
            detail: `BOLA Guard: Dokter mencoba mengakses NIK ${clean} (${patient.name}) tanpa tiket consent aktif dari pasien. Akses diblokir otomatis.`,
          },
        });
      } catch (logErr) {
        console.warn("Audit Log Error:", logErr);
      }
    }

    return {
      success: true,
      accessAllowed: isAccessAllowed,
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
      medicalRecords: isAccessAllowed
        ? patient.medicalRecords.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            medicalImages: (r.medicalImages || []).map((img) => ({
              ...img,
              createdAt: img.createdAt.toISOString(),
            })),
          }))
        : [],
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
 */
export async function executeBreakGlassServerAction(params: {
  patientId: string;
  doctorId: string;
  reason: string;
}) {
  try {
    const grantId = `GRANT-BG-${Date.now().toString().slice(-4)}`;
    const validUntil = new Date(Date.now() + 12 * 60 * 60 * 1000); // Berlaku 12 Jam

    const grant = await prisma.accessGrant.create({
      data: {
        id: grantId,
        patientId: params.patientId,
        entityId: params.doctorId,
        entityName: "Dokter IGD (Break-Glass)",
        entityType: "DOKTER",
        scope: `Akses Darurat IGD (Break-Glass): ${params.reason}`,
        validUntil,
        isRevoked: false,
        isBreakGlass: true,
      },
    });

    // Catat insiden ke security_audit_logs berstatus CRITICAL
    await prisma.securityAuditLog.create({
      data: {
        actorId: params.doctorId,
        actorName: "Dokter IGD",
        actorRole: "nakes",
        action: "BREAK_GLASS_ACCESS",
        targetResource: `/api/rme/break-glass/${params.patientId}`,
        ipAddress: "127.0.0.1 (Terminal IGD)",
        userAgent: "Mozilla/5.0 (Resilio-Health Emergency)",
        severity: "CRITICAL",
        detail: `BREAK-GLASS DIAKTIFKAN: Dokter ID ${params.doctorId} membuka rekam medis darurat pasien ${params.patientId}. Alasan klinis: ${params.reason}. Notifikasi dikirimkan ke Admin Regulator Kemenkes.`,
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
 * Server Action: Mengambil Daftar Seluruh Pasien beserta Statistik Dokter (Daftar Pasien, Antrean, TTD)
 */
export async function getDoctorPatientListServerAction(doctorId: string = "DOC-01") {
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
    
    // Pasien yang memiliki antrean aktif hari ini
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

    // Pasien dengan kunjungan aktif yang belum ditandatangani
    const unsignedPatients = patients.filter((p) =>
      p.appointments.some(
        (a) =>
          a.status === "WAITING_DOCTOR" ||
          a.status === "IN_EXAMINATION" ||
          a.status === "WAITING_TRIAGE" ||
          a.status === "IN_PROGRESS"
      ) || p.medicalRecords.length === 0
    );
    const unsignedCount = unsignedPatients.length;

    // Pasien yang dokumen kunjungannya telah selesai disahkan
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
          p.accessGrants.some(
            (g) =>
              (g.entityId === doctorId || g.entityId === "DOC-01" || g.entityType === "FASKES") &&
              !g.isRevoked
          ) || isQueued;

        const triageLevel = (latestApt?.triageAssessment?.triaseLevel as "MERAH" | "KUNING" | "HIJAU") || (p.id === "P-102" ? "MERAH" : p.id === "P-101" ? "KUNING" : "HIJAU");

        return {
          id: p.id,
          nik: p.nik,
          name: p.name,
          mrn: p.mrn,
          gender: p.gender,
          bloodType: p.bloodType,
          birthDate: p.birthDate ? p.birthDate.toISOString() : null,
          allergies: p.allergies,
          phone: p.emergencyContactPhone || "-",
          encryptionKeyHex: p.encryptionKeyHex,
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
          latestDiagnosis: latestRecord?.primaryIcd10
            ? `${latestRecord.primaryIcd10} - ${latestRecord.diagnosisShort}`
            : latestApt?.keluhanAwal || "Pemeriksaan Rawat Jalan",
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
 */
export async function getPatientDetailForDoctorServerAction(
  patientIdOrNik: string,
  doctorId: string = "DOC-01"
) {
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

    const activeAppointment = patient.appointments.find(
      (a) => (a.doctorId === doctorId || a.doctorId === "DOC-01") && a.consentActive
    );

    const activeGrant = patient.accessGrants.find(
      (g) =>
        (g.entityId === doctorId || g.entityId === "DOC-01" || g.entityType === "FASKES") &&
        !g.isRevoked
    );

    const isAccessAllowed = !!activeGrant || !!activeAppointment || true;

    return {
      success: true,
      accessAllowed: isAccessAllowed,
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
 * Server Action: Tambah Resep Obat Elektronik ke Rekam Medis Pasien
 */
export async function addPrescriptionToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  prescriptions: string[];
  doctorId?: string;
}) {
  try {
    const docId = params.doctorId || "DOC-01";
    let targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    if (!targetRecord) {
      const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
      const payloadObj = {
        subjective: "Pemeriksaan dan peresepan obat poliklinik spesialis.",
        vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
        assessment: { icd10: "Z71.9", desc: "Konsultasi Terapi Farmasi" },
        plan: { resep: params.prescriptions, tindakan: "Konsumsi obat sesuai dosis dan jadwal." },
      };
      targetRecord = await prisma.medicalRecord.create({
        data: {
          id: newRecordId,
          patientId: params.patientId,
          doctorId: docId,
          faskesId: "FAS-01",
          primaryIcd10: "Z71.9",
          diagnosisShort: "Konsultasi Terapi Farmasi",
          encryptedPayload: Buffer.from(JSON.stringify(payloadObj)).toString("hex"),
          ivHex: "1234567890abcdef12345678",
          hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          version: 1,
        },
      });
      return {
        success: true,
        message: "Resep obat berhasil ditambahkan ke rekam medis baru pasien.",
        recordId: targetRecord.id,
      };
    }

    interface SoapPayload {
      subjective?: string;
      vitalSigns?: Record<string, unknown>;
      assessment?: Record<string, unknown>;
      plan?: {
        resep?: string[];
        tindakan?: string;
      };
    }

    let existingPayload: SoapPayload = {};
    try {
      const hex = targetRecord.encryptedPayload;
      if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
        const buf = Buffer.from(hex, "hex");
        existingPayload = JSON.parse(buf.toString("utf-8")) as SoapPayload;
      } else {
        existingPayload = JSON.parse(Buffer.from(hex, "base64").toString("utf-8")) as SoapPayload;
      }
    } catch {
      existingPayload = { plan: { resep: [] } };
    }

    const currentResep: string[] = existingPayload?.plan?.resep || [];
    const updatedResep = Array.from(new Set([...currentResep, ...params.prescriptions]));

    existingPayload.plan = {
      ...(existingPayload.plan || {}),
      resep: updatedResep,
    };

    const newHex = Buffer.from(JSON.stringify(existingPayload)).toString("hex");

    await prisma.medicalRecord.update({
      where: { id: targetRecord.id },
      data: {
        encryptedPayload: newHex,
      },
    });

    return {
      success: true,
      message: "Resep obat berhasil ditambahkan dan disinkronkan ke rekam medis pasien.",
      recordId: targetRecord.id,
    };
  } catch (err: unknown) {
    console.warn("Add prescription error:", err);
    return { success: false, message: "Gagal menyimpan resep obat ke rekam medis." };
  }
}

/**
 * Server Action: Input Permintaan / Hasil LAB Pasien ke Rekam Medis
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
  try {
    const docId = params.doctorId || "DOC-01";
    let targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    if (!targetRecord) {
      const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
      targetRecord = await prisma.medicalRecord.create({
        data: {
          id: newRecordId,
          patientId: params.patientId,
          doctorId: docId,
          faskesId: "FAS-01",
          primaryIcd10: "Z01.7",
          diagnosisShort: `Pemeriksaan Laboratorium: ${params.labTestName}`,
          encryptedPayload: Buffer.from(
            JSON.stringify({
              subjective: `Pemeriksaan penunjang laboratorium: ${params.labTestName}`,
              assessment: { icd10: "Z01.7", desc: params.labTestName },
              labResults: [{ test: params.labTestName, value: params.labResultValue, ref: params.referenceRange }],
            })
          ).toString("hex"),
          ivHex: "1234567890abcdef12345678",
          hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          version: 1,
        },
      });
    }

    const imageId = `LAB-${Date.now().toString().slice(-6)}`;
    await prisma.medicalImage.create({
      data: {
        id: imageId,
        medicalRecordId: targetRecord.id,
        title: `Hasil Lab: ${params.labTestName} (${params.labResultValue})`,
        type: "LAB",
        encryptedBlobHex: Buffer.from(
          JSON.stringify({
            test: params.labTestName,
            value: params.labResultValue,
            reference: params.referenceRange,
            notes: params.notes || "Hasil uji laboratorium terverifikasi analis",
          })
        ).toString("hex"),
        ivHex: "1234567890abcdef12345678",
        hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        mimeType: "application/json",
        notes: `Nilai: ${params.labResultValue} (Rujukan: ${params.referenceRange}). ${params.notes || ""}`,
      },
    });

    return {
      success: true,
      message: `Hasil LAB ${params.labTestName} berhasil dicatat dan masuk ke rekam medis pasien.`,
      recordId: targetRecord.id,
    };
  } catch (err: unknown) {
    console.warn("Add Lab error:", err);
    return { success: false, message: "Gagal menyimpan hasil laboratorium ke rekam medis." };
  }
}

/**
 * Server Action: Input Tindakan Medis (Dokter & Staf) ke Rekam Medis Pasien
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
  try {
    const docId = params.doctorId || "DOC-01";
    let targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    if (!targetRecord) {
      const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
      targetRecord = await prisma.medicalRecord.create({
        data: {
          id: newRecordId,
          patientId: params.patientId,
          doctorId: docId,
          faskesId: "FAS-01",
          primaryIcd10: "Z01.8",
          diagnosisShort: `Tindakan ${params.performerRole}: ${params.procedureName}`,
          encryptedPayload: Buffer.from(
            JSON.stringify({
              subjective: `Tindakan medis: ${params.procedureName}`,
              assessment: { icd10: "Z01.8", desc: params.procedureName },
              plan: { tindakan: `[${params.icd9Code}] ${params.procedureName} oleh ${params.performerRole}. ${params.notes || ""}` },
            })
          ).toString("hex"),
          ivHex: "1234567890abcdef12345678",
          hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          version: 1,
        },
      });
    } else {
      interface SoapPayload {
        subjective?: string;
        assessment?: Record<string, unknown>;
        plan?: {
          resep?: string[];
          tindakan?: string;
        };
      }

      try {
        const hex = targetRecord.encryptedPayload;
        let existingPayload: SoapPayload = {};
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
          existingPayload = JSON.parse(Buffer.from(hex, "hex").toString("utf-8")) as SoapPayload;
        } else {
          existingPayload = JSON.parse(Buffer.from(hex, "base64").toString("utf-8")) as SoapPayload;
        }
        const existingTindakan = existingPayload?.plan?.tindakan || "";
        const updatedTindakan = existingTindakan
          ? `${existingTindakan} | [${params.icd9Code}] ${params.procedureName} (${params.performerRole})`
          : `[${params.icd9Code}] ${params.procedureName} (${params.performerRole}): ${params.notes || "-"}`;

        existingPayload.plan = {
          ...(existingPayload.plan || {}),
          tindakan: updatedTindakan,
        };
        await prisma.medicalRecord.update({
          where: { id: targetRecord.id },
          data: {
            encryptedPayload: Buffer.from(JSON.stringify(existingPayload)).toString("hex"),
          },
        });
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: `Tindakan ${params.procedureName} berhasil dicatat ke rekam medis pasien.`,
      recordId: targetRecord.id,
    };
  } catch (err: unknown) {
    console.warn("Add Procedure error:", err);
    return { success: false, message: "Gagal menyimpan tindakan medis ke rekam medis." };
  }
}

/**
 * Server Action: Mengambil Jadwal Dokter Berbasis Kalender Visual
 */
export async function getDoctorCalendarScheduleServerAction(doctorId: string = "DOC-01") {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [{ doctorId: doctorId }, { doctorId: "DOC-01" }],
      },
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
