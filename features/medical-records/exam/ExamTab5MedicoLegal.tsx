"use client";

import React from "react";
import type { UserSession } from "@/lib/auth/auth";

export const AVAILABLE_REFERRAL_FASKES = [
  { id: "FAS-01", nama: "RSUP Dr. Sardjito", tipe: "RS Umum Pusat (Tipe A)", kota: "Yogyakarta" },
  { id: "FAS-02", nama: "RS Harapan Sehat", tipe: "RS Rujukan Kardiologi", kota: "Sleman" },
  { id: "FAS-03", nama: "Klinik Pratama Sehat Mandiri", tipe: "Klinik Pratama Faskes 1", kota: "Sleman" },
  { id: "FAS-04", nama: "Puskesmas Mlati 1", tipe: "Puskesmas Kecamatan", kota: "Sleman" },
];

export const AVAILABLE_REFERRAL_DOCTORS = [
  { id: "DOC-01", name: "dr. Andi Pratama, Sp.PD", specialty: "Spesialis Penyakit Dalam", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito" },
  { id: "DOC-02", name: "dr. Ratna Juwita, Sp.JP", specialty: "Spesialis Kardiologi & Jantung", faskesId: "FAS-02", faskesName: "RS Harapan Sehat" },
  { id: "DOC-03", name: "dr. Sarah, Sp.A", specialty: "Spesialis Anak & Tumbuh Kembang", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito" },
  { id: "DOC-04", name: "dr. Rian, Sp.JP", specialty: "Spesialis Bedah Vaskular", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito" },
];

export interface ExamTab5MedicoLegalProps {
  session: UserSession;
  berikanSuratSakit: boolean;
  setBerikanSuratSakit: (v: boolean) => void;
  lamaHariSakit: string;
  setLamaHariSakit: (v: string) => void;
  isRujukan: boolean;
  setIsRujukan: (v: boolean) => void;
  rujukanFaskesId: string;
  setRujukanFaskesId: (v: string) => void;
  rujukanDokterId: string;
  setRujukanDokterId: (v: string) => void;
  rujukanUrgensi: string;
  setRujukanUrgensi: (v: string) => void;
  setRujukanTujuan: (v: string) => void;
  rujukanAlasan: string;
  setRujukanAlasan: (v: string) => void;
  dischargeDisposition: string;
  setDischargeDisposition: (v: string) => void;
  jadwalKontrol: string;
  setJadwalKontrol: (v: string) => void;
  isAddendum: boolean;
  addendumReason: string;
  isMedicallyConfirmed: boolean;
  setIsMedicallyConfirmed: (v: boolean) => void;
  validationErrors: Record<string, string>;
  clearFieldError: (field: string) => void;
}

export function ExamTab5MedicoLegal({
  session,
  berikanSuratSakit,
  setBerikanSuratSakit,
  lamaHariSakit,
  setLamaHariSakit,
  isRujukan,
  setIsRujukan,
  rujukanFaskesId,
  setRujukanFaskesId,
  rujukanDokterId,
  setRujukanDokterId,
  rujukanUrgensi,
  setRujukanUrgensi,
  setRujukanTujuan,
  rujukanAlasan,
  setRujukanAlasan,
  dischargeDisposition,
  setDischargeDisposition,
  jadwalKontrol,
  setJadwalKontrol,
  isAddendum,
  addendumReason,
  isMedicallyConfirmed,
  setIsMedicallyConfirmed,
  validationErrors,
  clearFieldError,
}: ExamTab5MedicoLegalProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
          Pembuatan Surat Keterangan Medis Resmi
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={berikanSuratSakit}
                onChange={(e) => setBerikanSuratSakit(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>Terbitkan Surat Keterangan Istirahat / Sakit</span>
            </label>
            {berikanSuratSakit && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-slate-600">Lama Istirahat:</span>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={lamaHariSakit}
                  onChange={(e) => setLamaHariSakit(e.target.value)}
                  className="w-16 p-1 border rounded text-center font-bold"
                />
                <span>Hari</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isRujukan}
                onChange={(e) => setIsRujukan(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Terbitkan Surat Rujukan ke Faskes Lain</span>
            </label>
            {isRujukan && (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <select
                  value={rujukanFaskesId}
                  onChange={(e) => {
                    setRujukanFaskesId(e.target.value);
                    const found = AVAILABLE_REFERRAL_FASKES.find((f) => f.id === e.target.value);
                    if (found) setRujukanTujuan(found.nama);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {AVAILABLE_REFERRAL_FASKES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nama} ({f.tipe} - {f.kota})
                    </option>
                  ))}
                </select>
                <select
                  value={rujukanDokterId}
                  onChange={(e) => setRujukanDokterId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {AVAILABLE_REFERRAL_DOCTORS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty} ({d.faskesName})
                    </option>
                  ))}
                </select>
                <select
                  value={rujukanUrgensi}
                  onChange={(e) => setRujukanUrgensi(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="Rutin / Terencana (7 Hari)">Rutin / Terencana (7 Hari)</option>
                  <option value="Mendesak (24 Jam)">Mendesak (24 Jam)</option>
                  <option value="Gawat Darurat Segera (Transfer Ambulans)">
                    Gawat Darurat Segera (Transfer Ambulans)
                  </option>
                </select>
                <textarea
                  rows={2}
                  value={rujukanAlasan}
                  onChange={(e) => setRujukanAlasan(e.target.value)}
                  placeholder="Indikasi & alasan klinis rujukan..."
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
          Disposisi Resume Medis (Discharge Disposition)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <select
            value={dischargeDisposition}
            onChange={(e) => setDischargeDisposition(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
          >
            <option value="PULANG_SEHAT_KONTROL">PULANG DENGAN JADWAL KONTROL POLIKLINIK</option>
            <option value="PINDAH_RUANG_RAWAT">PINDAH KE RUANG RAWAT INAP</option>
            <option value="DIRUJUK_FASKES_LAIN">DIRUJUK KE FASKES LAIN</option>
            <option value="PULANG_ATAS_PERMINTAAN_SENDIRI">PULANG ATAS PERMINTAAN SENDIRI (APS)</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 whitespace-nowrap">Jadwal Kontrol:</span>
            <input
              type="date"
              value={jadwalKontrol}
              onChange={(e) => setJadwalKontrol(e.target.value)}
              className="p-2 border rounded-xl bg-white font-bold text-xs flex-1"
            />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
          Riwayat Silsilah Perubahan Berkas (Addendum Audit Trail — Permenkes 24/2022)
        </span>
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800">Versi 1: Dokumen Rekam Medis Induk</span>
            <p className="text-[11px] text-slate-500">Dibuat oleh {session.name}</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Immutable
          </span>
        </div>
        {isAddendum && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-900">Versi 2: Addendum Koreksi</span>
              <p className="text-[11px] text-amber-800">
                Alasan: {addendumReason || "Koreksi catatan klinis dan resep"}
              </p>
            </div>
            <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Draft Revisi
            </span>
          </div>
        )}
      </div>

      <div
        className={`p-4 rounded-2xl border transition ${
          validationErrors.isMedicallyConfirmed
            ? "bg-red-50/40 border-red-300"
            : "bg-emerald-50/40 border-emerald-200"
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isMedicallyConfirmed}
            onChange={(e) => {
              setIsMedicallyConfirmed(e.target.checked);
              if (e.target.checked) clearFieldError("isMedicallyConfirmed");
            }}
            className="mt-0.5 w-4 h-4 rounded text-emerald-600 cursor-pointer shrink-0"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-900 block">
              Konfirmasi Keabsahan Medikolegal & Tanda Tangan (Permenkes No. 24/2022) *
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Saya menyatakan bahwa seluruh pengkajian klinis ini sah berdasarkan pemeriksaan fisik
              langsung dan siap dienkripsi AEAD+HMAC.
            </p>
            {validationErrors.isMedicallyConfirmed && (
              <p className="text-[11px] font-bold text-red-600 pt-1">
                {validationErrors.isMedicallyConfirmed}
              </p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
