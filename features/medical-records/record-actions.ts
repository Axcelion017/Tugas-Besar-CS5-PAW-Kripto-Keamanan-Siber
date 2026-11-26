"use server";

import { prisma } from "@/lib/db/prisma";
import { AppointmentStatus, AuditAction, AuditSeverity, Prisma } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";

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
        patient: { select: { id: true, name: true, nik: true, mrn: true, bloodType: true } },
        doctor: {
          select: { id: true, name: true, specialty: true, strNumber: true, sipNumber: true },
        },
        faskes: { select: { id: true, nama: true, tipe: true, kota: true, alamat: true } },
        appointment: {
          include: {
            triageAssessment: {
              include: {
                assessedBy: { select: { id: true, name: true, nip: true, posisi: true } },
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
                assessedBy: { select: { id: true, name: true, nip: true, posisi: true } },
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

    return {
      success: true,
      data: {
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
      },
    };
  } catch (err: unknown) {
    console.warn("Get Single Medical Record Error:", err);
    return { success: false, data: null };
  }
}

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
        : { OR: [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }] };

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
