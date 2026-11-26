"use client";

import React from "react";
import type { CanonicalSoapPayload } from "@/features/medical-records/crypto-service";

export interface DoctorMedicalRecordRow {
  id: string;
  dokterNama: string;
  dokterSpecialty: string;
  dokterStr: string;
  dokterSip: string;
  faskesNama: string;
  primaryIcd10: string;
  diagnosisShort: string;
  encryptedPayload: string;
  ivHex: string;
  hmacDigest: string;
  version: number;
  addendumReason: string | null;
  createdAt: string;
  medicalImages: Array<{
    id: string;
    title: string;
    type: string;
    mimeType: string;
    notes: string | null;
  }>;
}

interface MedicalRecordItemCardProps {
  record: DoctorMedicalRecordRow;
  decrypted?: CanonicalSoapPayload;
  hmacValid?: boolean;
  decryptError?: string;
  onDecrypt: () => void;
  onPrint: () => void;
}

export function MedicalRecordItemCard({
  record,
  decrypted,
  hmacValid,
  decryptError,
  onDecrypt,
  onPrint,
}: MedicalRecordItemCardProps) {
  const isDecrypted = Boolean(decrypted && hmacValid === true);

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black text-slate-800">{record.id}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-800 border border-blue-200">
              {record.primaryIcd10}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              v{record.version}
            </span>
            {hmacValid === true && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                HMAC Terverifikasi
              </span>
            )}
            {hmacValid === false && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                HMAC Mismatch (Fail-Closed)
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-slate-900">{record.diagnosisShort}</h3>
          <p className="text-xs text-slate-500">
            {record.dokterNama} • {record.faskesNama} • {record.createdAt}
          </p>
          {record.addendumReason && (
            <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block">
              Addendum: {record.addendumReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isDecrypted && (
            <button
              type="button"
              onClick={onDecrypt}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Dekripsi & Verifikasi HMAC
            </button>
          )}
          <button
            type="button"
            disabled={!isDecrypted}
            title={
              isDecrypted
                ? "Cetak Resume Medis Terverifikasi"
                : "Dekripsi & verifikasi HMAC berkas terlebih dahulu sebelum mencetak"
            }
            onClick={onPrint}
            className="px-4 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            Cetak Resume Medis
          </button>
        </div>
      </div>

      {decryptError && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1">
          <p className="font-black uppercase text-[11px]">
            PERINGATAN INTEGRITAS KRIPTOGRAFI (FAIL-CLOSED)
          </p>
          <p>{decryptError}</p>
        </div>
      )}

      {isDecrypted && decrypted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-500">
              Anamnesis (Subjective) & Tanda Vital (Objective)
            </span>
            <p className="font-semibold text-slate-800">{decrypted.subjective || "-"}</p>
            {decrypted.vitalSigns && (
              <p className="font-mono text-[11px] text-slate-600">
                TD: {decrypted.vitalSigns.systolic}/{decrypted.vitalSigns.diastolic} mmHg • Nadi:{" "}
                {decrypted.vitalSigns.heartRate} bpm • Suhu: {decrypted.vitalSigns.temperature}°C •
                SpO2: {decrypted.vitalSigns.spo2}%
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 space-y-2">
            <span className="text-[10px] font-black uppercase text-emerald-800">
              Terapi Farmasi & Tindakan (Plan)
            </span>
            {decrypted.plan?.resep && decrypted.plan.resep.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 font-semibold text-slate-800">
                {decrypted.plan.resep.map((rx, idx) => (
                  <li key={idx}>{rx}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">Tidak ada resep obat.</p>
            )}
            {decrypted.plan?.tindakan && (
              <p className="text-slate-700 pt-1 border-t border-emerald-200/60">
                <strong>Tindakan:</strong> {decrypted.plan.tindakan}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] space-y-1 overflow-x-auto">
          <p className="text-slate-400 text-[10px] uppercase">
            Zero-Knowledge Ciphertext (AES-256-GCM + HKDF + AAD)
          </p>
          <p className="truncate">IV (96-bit): {record.ivHex}</p>
          <p className="truncate">HMAC-SHA256: {record.hmacDigest}</p>
          <p className="truncate text-slate-500">Ciphertext: {record.encryptedPayload.slice(0, 96)}...</p>
        </div>
      )}

      {record.medicalImages.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Lampiran Penunjang Terenkripsi ({record.medicalImages.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {record.medicalImages.map((img) => (
              <div key={img.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] font-black uppercase text-blue-700">{img.type}</span>
                <p className="font-bold text-slate-900">{img.title}</p>
                {img.notes && <p className="text-[11px] text-slate-600">{img.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
