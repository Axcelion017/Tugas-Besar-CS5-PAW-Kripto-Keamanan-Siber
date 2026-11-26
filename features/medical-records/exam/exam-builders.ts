import type { UserSession } from "@/lib/auth/auth";
import type { Appointment, Patient } from "@/lib/db/mockData";
import type { CanonicalSoapPayload } from "@/features/medical-records/crypto-service";
import type { PrintableRecordData } from "@/components/clinical/PrintableMedicalResume";
import { AVAILABLE_REFERRAL_DOCTORS } from "@/features/medical-records/exam/ExamTab5MedicoLegal";

export const ICD10_MAP: Record<string, string> = {
  I10: "Hipertensi Esensial (Primer)",
  "J06.9": "Infeksi Saluran Pernapasan Akut (ISPA)",
  E11: "Diabetes Melitus Tipe 2",
  "K29.7": "Gastritis, Unspecified",
  "I20.9": "Angina Pectoris (Nyeri Dada Iskemik)",
};

export const BIAYA_KONSULTASI = 100000;
export const BIAYA_TINDAKAN = 50000;
export const BIAYA_OBAT = 85000;

export interface ExamSnapshotInput {
  session: UserSession;
  appointment: Appointment;
  patient: Patient;
  subjective: string;
  systolic: string;
  diastolic: string;
  heartRate: string;
  temperature: string;
  spo2: string;
  icd10: string;
  planPrescription: string;
  planAction: string;
  gcsEye: string;
  gcsVerbal: string;
  gcsMotor: string;
  icd9Procedure: string;
  dischargeDisposition: string;
  berikanSuratSakit: boolean;
  lamaHariSakit: string;
  isRujukan: boolean;
  rujukanFaskesId: string;
  rujukanDokterId: string;
  rujukanUrgensi: string;
  rujukanTujuan: string;
  rujukanAlasan: string;
  jadwalKontrol: string;
  isAddendum: boolean;
  addendumReason: string;
}

export function buildCanonicalSoapPayload(input: ExamSnapshotInput): CanonicalSoapPayload {
  return {
    subjective: input.subjective,
    vitalSigns: {
      systolic: Number(input.systolic),
      diastolic: Number(input.diastolic),
      heartRate: Number(input.heartRate),
      temperature: Number(input.temperature),
      respiratoryRate: 20,
      spo2: Number(input.spo2),
    },
    assessment: { icd10: input.icd10, desc: ICD10_MAP[input.icd10] || "Diagnosis Umum" },
    plan: {
      resep: input.planPrescription.split("\n").map((r) => r.trim()).filter(Boolean),
      tindakan: `[ICD-9: ${input.icd9Procedure}] ${input.planAction || "Observasi klinis"}`,
    },
    gcs: {
      eye: Number(input.gcsEye),
      verbal: Number(input.gcsVerbal),
      motor: Number(input.gcsMotor),
      total: Number(input.gcsEye) + Number(input.gcsVerbal) + Number(input.gcsMotor),
    },
    icd9Procedure: input.icd9Procedure,
    dischargeDisposition: input.dischargeDisposition,
    suratSakit: input.berikanSuratSakit ? { lamaHari: Number(input.lamaHariSakit) } : null,
    rujukan: input.isRujukan
      ? {
          faskesId: input.rujukanFaskesId,
          faskesNama: input.rujukanTujuan,
          dokterId: input.rujukanDokterId,
          urgensi: input.rujukanUrgensi,
          alasan: input.rujukanAlasan,
        }
      : null,
    jadwalKontrol: input.jadwalKontrol,
    meta: {
      dokterId: input.session.id,
      dokterNama: input.session.name,
      dokterStr: input.session.strNumber || "",
      faskesNama: input.appointment.faskesNama,
      timestamp: new Date().toISOString(),
    },
  };
}

export function buildExamPrintableData(input: ExamSnapshotInput): PrintableRecordData {
  const { session, appointment, patient } = input;
  return {
    recordId: `REC-${appointment.id}`,
    faskesNama: appointment.faskesNama || "RSUP Dr. Sardjito",
    patientNama: patient.name,
    patientNik: patient.nik,
    patientMrn: patient.mrn,
    patientBloodType: patient.bloodType,
    patientAge: patient.age,
    penjaminBiaya: "BPJS Kesehatan (JKN)",
    tanggalPeriksa: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    poli: appointment.poli,
    dokterNama: session.name,
    dokterSpecialty: session.specialization || "Spesialis Penyakit Dalam",
    dokterStr: session.strNumber,
    triaseLevel: appointment.triaseLevel || "HIJAU (Non-Urgent)",
    triageVitals: {
      systolic: Number(input.systolic),
      diastolic: Number(input.diastolic),
      heartRate: Number(input.heartRate),
      temperature: Number(input.temperature),
      spo2: Number(input.spo2),
    },
    subjective: input.subjective,
    diagnosisIcd10: input.icd10,
    diagnosisShort: ICD10_MAP[input.icd10] || "Hipertensi Esensial",
    prosedurIcd9: input.icd9Procedure,
    prescriptions: input.planPrescription.split("\n").map((r) => r.trim()).filter(Boolean),
    edukasiDokter: input.planAction,
    suratKeteranganSakit: {
      diberikan: input.berikanSuratSakit,
      lamaHari: Number(input.lamaHariSakit),
      mulaiTanggal: new Date().toLocaleDateString("id-ID"),
    },
    suratRujukan: {
      isRujukan: input.isRujukan,
      tujuanFaskes: `${input.rujukanTujuan} (${
        AVAILABLE_REFERRAL_DOCTORS.find((d) => d.id === input.rujukanDokterId)?.name || "DPJP"
      } [${input.rujukanUrgensi}])`,
      alasanRujukan: input.rujukanAlasan,
    },
    billing: {
      biayaKonsultasi: BIAYA_KONSULTASI,
      biayaTindakan: BIAYA_TINDAKAN,
      biayaObat: BIAYA_OBAT,
      totalBiaya: BIAYA_KONSULTASI + BIAYA_TINDAKAN + BIAYA_OBAT,
      statusKlaim: "DITANGGUNG JKN (BPJS KESEHATAN)",
    },
    version: input.isAddendum ? 2 : 1,
    addendumReason: input.isAddendum ? input.addendumReason : undefined,
  };
}
