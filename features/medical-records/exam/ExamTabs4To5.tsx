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

export interface ExamTabs4To5Props {
  activeTab: 1 | 2 | 3 | 4 | 5;
  session: UserSession;
  planPrescription: string;
  setPlanPrescription: (v: string) => void;
  detectedAllergies: string[];
  icd9Procedure: string;
  setIcd9Procedure: (v: string) => void;
  planAction: string;
  setPlanAction: (v: string) => void;
  biayaKonsultasi: number;
  biayaTindakan: number;
  biayaObat: number;
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

export function ExamTabs4To5(props: ExamTabs4To5Props) {
  const {
    activeTab,
    session,
    planPrescription,
    setPlanPrescription,
    detectedAllergies,
    icd9Procedure,
    setIcd9Procedure,
    planAction,
    setPlanAction,
    biayaKonsultasi,
    biayaTindakan,
    biayaObat,
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
  } = props;

  if (activeTab === 4) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label
              htmlFor="exam-prescription"
              className="block text-xs font-bold text-slate-700 uppercase mb-1"
            >
              Plan: Resep Obat Elektronik (e-Prescription) & Farmasi *
            </label>
            <textarea
              id="exam-prescription"
              required
              rows={4}
              value={planPrescription}
              onChange={(e) => {
                setPlanPrescription(e.target.value);
                clearFieldError("planPrescription");
              }}
              placeholder={"Contoh:\nAmlodipine 10mg tab No. XXX, S 1 dd 1 tab pagi\nKandesartan 8mg tab No. XXX, S 1 dd 1 tab malam"}
              className={`w-full px-4 py-2.5 rounded-xl border font-semibold text-sm focus:outline-none transition ${
                validationErrors.planPrescription
                  ? "border-red-400 bg-red-50/20 focus:ring-2 focus:ring-red-400"
                  : "border-slate-300 focus:ring-2 focus:ring-emerald-500"
              }`}
            />
            {validationErrors.planPrescription && (
              <p className="text-[11px] font-bold text-red-600 mt-1">
                {validationErrors.planPrescription}
              </p>
            )}
            {detectedAllergies.length > 0 && (
              <div
                role="alert"
                className="mt-2 p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 text-xs font-bold"
              >
                PERINGATAN KONTRAINDIKASI KLINIS (UR-T10): Resep memuat zat alergen pasien:{" "}
                <span className="underline uppercase">{detectedAllergies.join(", ")}</span>!
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Status Dispensing Farmasi:</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Menunggu Verifikasi Apoteker
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="exam-icd9" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Tindakan Medis Terstandarisasi ICD-9-CM
            </label>
            <select
              id="exam-icd9"
              value={icd9Procedure}
              onChange={(e) => setIcd9Procedure(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
            >
              <option value="89.52">89.52 — Electrocardiogram (EKG 12-Lead)</option>
              <option value="89.38">89.38 — Pemeriksaan Fungsi Paru / Spirometri</option>
              <option value="96.07">96.07 — Pemasangan Nasogastric Tube (NGT)</option>
              <option value="99.21">99.21 — Injeksi Antibiotik Intravena</option>
              <option value="86.59">86.59 — Penjahitan Luka Sederhana (Hecting)</option>
            </select>
          </div>

          <div>
            <label htmlFor="exam-action" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Catatan Edukasi & Tindak Lanjut Pasien *
            </label>
            <textarea
              id="exam-action"
              required
              rows={2}
              value={planAction}
              onChange={(e) => setPlanAction(e.target.value)}
              placeholder="Contoh: Diet rendah garam, kurangi kafein, kontrol tensi ulang 2 minggu lagi..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-bold text-emerald-900 text-[10px] uppercase">
              <span>Estimasi Rincian Biaya</span>
              <span className="text-emerald-700 font-mono">Status: Ditanggung JKN</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-emerald-200/60 font-mono">
              <div>Konsultasi: <strong>Rp {biayaKonsultasi.toLocaleString("id-ID")}</strong></div>
              <div>Tindakan: <strong>Rp {biayaTindakan.toLocaleString("id-ID")}</strong></div>
              <div>Farmasi: <strong>Rp {biayaObat.toLocaleString("id-ID")}</strong></div>
            </div>
            <div className="pt-1 flex justify-between text-xs font-black text-slate-900 border-t border-emerald-200">
              <span>Total Billing:</span>
              <span>Rp {(biayaKonsultasi + biayaTindakan + biayaObat).toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 5) {
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

  return null;
}
