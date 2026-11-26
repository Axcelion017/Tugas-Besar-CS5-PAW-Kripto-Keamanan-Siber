import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedSession } from "@/features/auth/guard";
import type { UserSession } from "@/lib/auth/auth";

export interface NakesDashboardAppointment {
  id: string;
  pasienId: string;
  pasienNama: string;
  pasienNik: string;
  pasienMrn: string;
  pasienBloodType: string;
  allergies: string[];
  faskesId: string;
  faskesNama: string;
  dokterId: string;
  poli: string;
  tanggal: string; // YYYY-MM-DD
  jam: string;
  keluhanAwal: string;
  status: string;
  triaseLevel: string;
  triaseVitals: {
    systolic: number;
    diastolic: number;
    heartRate: number;
    temperature: number;
    respiratoryRate: number;
    spo2: number;
  } | null;
}

export interface NakesDashboardServerData {
  session: UserSession;
  appointments: NakesDashboardAppointment[];
}

export async function getNakesDashboardServerData(): Promise<NakesDashboardServerData | null> {
  const auth = await getAuthenticatedSession();
  if (!auth) return null;

  const { session, role } = auth;
  const isDoctor = role === "nakes";
  const appointments = await prisma.appointment.findMany({
    where: isDoctor ? { OR: [{ doctorId: session.id }, { dpjpId: session.id }] } : {},
    include: {
      patient: {
        select: { id: true, name: true, nik: true, mrn: true, bloodType: true, allergies: true },
      },
      faskes: { select: { id: true, nama: true } },
      triageAssessment: true,
    },
    orderBy: [{ tanggal: "asc" }, { jam: "asc" }],
  });

  return {
    session,
    appointments: appointments.map((a) => ({
      id: a.id,
      pasienId: a.patientId,
      pasienNama: a.patient.name,
      pasienNik: a.patient.nik,
      pasienMrn: a.patient.mrn,
      pasienBloodType: a.patient.bloodType,
      allergies: a.patient.allergies || [],
      faskesId: a.faskesId,
      faskesNama: a.faskes.nama,
      dokterId: a.dpjpId || a.doctorId,
      poli: a.poli,
      tanggal: a.tanggal.toISOString().split("T")[0],
      jam: a.jam,
      keluhanAwal: a.keluhanAwal,
      status: a.status,
      triaseLevel: a.triageAssessment?.triaseLevel || "HIJAU",
      triaseVitals: a.triageAssessment
        ? {
            systolic: a.triageAssessment.systolic,
            diastolic: a.triageAssessment.diastolic,
            heartRate: a.triageAssessment.heartRate,
            temperature: Number(a.triageAssessment.temperature),
            respiratoryRate: a.triageAssessment.respiratoryRate,
            spo2: a.triageAssessment.spo2,
          }
        : null,
    })),
  };
}
