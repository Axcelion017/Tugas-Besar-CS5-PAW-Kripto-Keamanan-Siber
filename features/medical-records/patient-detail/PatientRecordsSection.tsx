"use client";

import React from "react";
import type { CanonicalSoapPayload } from "@/features/medical-records/crypto-service";
import type { PrintableRecordData } from "@/components/clinical/PrintableMedicalResume";
import {
  DoctorMedicalRecordRow,
  MedicalRecordItemCard,
} from "@/features/medical-records/patient-detail/MedicalRecordItemCard";

interface PatientRecordsSectionProps {
  accessAllowed: boolean;
  patient: {
    name: string;
    nik: string;
    mrn: string;
    bloodType: string;
  };
  medicalRecords: DoctorMedicalRecordRow[];
  decryptedMap: Record<string, CanonicalSoapPayload>;
  hmacStatusMap: Record<string, boolean>;
  decryptErrorMap: Record<string, string>;
  defaultPoli: string;
  defaultTriaseLevel: string;
  onDecrypt: (rec: DoctorMedicalRecordRow) => void;
  onSelectPrint: (data: PrintableRecordData) => void;
}

export function PatientRecordsSection({
  accessAllowed,
  patient,
  medicalRecords,
  decryptedMap,
  hmacStatusMap,
  decryptErrorMap,
  defaultPoli,
  defaultTriaseLevel,
  onDecrypt,
  onSelectPrint,
}: PatientRecordsSectionProps) {
  if (!accessAllowed) {
    return (
      <div className="p-8 rounded-3xl bg-red-50 border border-red-200 text-center space-y-3">
        <h2 className="text-lg font-black text-red-900">
          Akses Rekam Medis Ditolak (403 Zero-Trust BOLA Guard)
        </h2>
        <p className="text-xs text-red-800 max-w-xl mx-auto">
          Pasien belum memberikan tiket consent aktif kepada Anda. Kunci dekripsi dan isi rekam
          medis tidak dikirim oleh server. Gunakan protokol darurat Break-Glass hanya untuk kasus
          gawat darurat IGD.
        </p>
      </div>
    );
  }

  if (medicalRecords.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-xs text-slate-500">
        Belum ada berkas rekam medis tersimpan untuk pasien ini di PostgreSQL.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {medicalRecords.map((rec) => (
        <MedicalRecordItemCard
          key={rec.id}
          record={rec}
          decrypted={decryptedMap[rec.id]}
          hmacValid={hmacStatusMap[rec.id]}
          decryptError={decryptErrorMap[rec.id]}
          onDecrypt={() => onDecrypt(rec)}
          onPrint={() => {
            const dec = decryptedMap[rec.id];
            if (!dec) return;
            onSelectPrint({
              recordId: rec.id,
              faskesNama: rec.faskesNama,
              patientNama: patient.name,
              patientNik: patient.nik,
              patientMrn: patient.mrn,
              patientBloodType: patient.bloodType,
              tanggalPeriksa: rec.createdAt,
              poli: defaultPoli,
              dokterNama: rec.dokterNama,
              dokterSpecialty: rec.dokterSpecialty,
              dokterStr: rec.dokterStr,
              dokterSip: rec.dokterSip,
              triaseLevel: defaultTriaseLevel,
              triageVitals: dec.vitalSigns
                ? {
                    systolic: dec.vitalSigns.systolic,
                    diastolic: dec.vitalSigns.diastolic,
                    heartRate: dec.vitalSigns.heartRate,
                    temperature: dec.vitalSigns.temperature,
                    spo2: dec.vitalSigns.spo2,
                  }
                : undefined,
              subjective: dec.subjective,
              diagnosisIcd10: rec.primaryIcd10,
              diagnosisShort: rec.diagnosisShort,
              prescriptions: dec.plan?.resep || [],
              tindakanMedis: dec.plan?.tindakan,
              version: rec.version,
              addendumReason: rec.addendumReason || undefined,
            });
          }}
        />
      ))}
    </div>
  );
}
