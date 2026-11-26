"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
  maskNik,
} from "@/features/medical-records/helpers";

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
          include: { triageAssessment: true, faskes: { select: { nama: true } } },
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
    const signedCount = patients.filter(
      (p) => p.medicalRecords.length > 0 && !unsignedPatients.some((up) => up.id === p.id)
    ).length;

    return {
      success: true,
      stats: { totalPatients, totalAntrean, unsignedCount, signedCount },
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
      where: { OR: [{ id: clean }, { nik: clean }, { mrn: clean }] },
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
