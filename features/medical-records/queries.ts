import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedSession } from "@/features/auth/guard";
import { calculateAge } from "@/lib/db/mockData";
import type { UserSession } from "@/lib/auth/auth";
import type { VitalSignMetric } from "@/components/clinical/VitalSignsTrendChart";

export interface PasienDashboardServerData {
  session: UserSession;
  patient: {
    id: string;
    nik: string;
    name: string;
    mrn: string;
    bloodType: string;
    age: number;
    gender: string;
    allergies: string[];
    statusKyc: "VERIFIED" | "PENDING" | "REJECTED";
    emergencyContact: { name: string; relation: string; phone: string };
    familyMembers: Array<{ id: string; name: string; relation: string; nik: string; age: number }>;
  };
  appointments: Array<{
    id: string;
    faskesNama: string;
    dokterNama: string;
    poli: string;
    tanggal: string;
    jam: string;
    keluhanAwal: string;
    status: string;
    consentPin?: string;
    triaseLevel?: string;
  }>;
  activeGrantsCount: number;
  recordsCount: number;
  vitalMetrics: VitalSignMetric[];
}

export async function getPasienDashboardServerData(): Promise<PasienDashboardServerData | null> {
  const auth = await getAuthenticatedSession();
  if (!auth) return null;
  const { session } = auth;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: session.id }, { username: session.username }, { patient: { id: session.id } }],
    },
    include: {
      patient: { include: { familyMembers: true } },
    },
  });

  const dbPatient = user?.patient;
  const patientId = dbPatient?.id || session.id;

  const [appointments, activeGrantsCount, records] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId },
      include: {
        faskes: { select: { nama: true } },
        doctor: { select: { name: true } },
        triageAssessment: { select: { triaseLevel: true } },
      },
      orderBy: { tanggal: "desc" },
      take: 10,
    }),
    prisma.accessGrant.count({
      where: { patientId, isRevoked: false, validUntil: { gt: new Date() } },
    }),
    prisma.medicalRecord.findMany({
      where: { patientId },
      select: { id: true, createdAt: true, vitalSignsTrend: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
  ]);

  const vitalMetrics: VitalSignMetric[] = [];
  for (const rec of records) {
    const trend = rec.vitalSignsTrend as
      | { systolic?: number; diastolic?: number; heartRate?: number; spo2?: number }
      | null
      | undefined;
    if (trend && typeof trend.systolic === "number" && typeof trend.diastolic === "number") {
      vitalMetrics.push({
        date: rec.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        systolic: trend.systolic,
        diastolic: trend.diastolic,
        heartRate: typeof trend.heartRate === "number" ? trend.heartRate : 78,
      });
    }
  }

  const isTempNik = !dbPatient?.nik || dbPatient.nik.startsWith("TEMP-");
  const statusKyc: "VERIFIED" | "PENDING" | "REJECTED" =
    user?.status === "VERIFIED"
      ? "VERIFIED"
      : user?.status === "REJECTED"
      ? "REJECTED"
      : "PENDING";

  return {
    session,
    patient: {
      id: patientId,
      nik: isTempNik ? "" : dbPatient!.nik,
      name: dbPatient?.name || session.name,
      mrn: dbPatient?.mrn || "MRN-2026-BARU",
      bloodType: dbPatient?.bloodType || "O+",
      age: dbPatient?.birthDate ? calculateAge(dbPatient.birthDate) : 0,
      gender: dbPatient?.gender || "L",
      allergies: dbPatient?.allergies || [],
      statusKyc,
      emergencyContact: {
        name: dbPatient?.emergencyContactName || "Belum Diatur",
        relation: dbPatient?.emergencyContactRelation || "Keluarga",
        phone: dbPatient?.emergencyContactPhone || "-",
      },
      familyMembers: (dbPatient?.familyMembers || []).map((f) => ({
        id: f.id,
        name: f.name,
        relation: String(f.relation).replace("_", " "),
        nik: f.nik,
        age: calculateAge(f.birthDate),
      })),
    },
    appointments: appointments.map((a) => ({
      id: a.id,
      faskesNama: a.faskes.nama,
      dokterNama: a.doctor.name,
      poli: a.poli,
      tanggal: a.tanggal.toISOString().split("T")[0],
      jam: a.jam,
      keluhanAwal: a.keluhanAwal,
      status: a.status,
      consentPin: a.consentPin || undefined,
      triaseLevel: a.triageAssessment?.triaseLevel || undefined,
    })),
    activeGrantsCount,
    recordsCount: records.length,
    vitalMetrics,
  };
}
