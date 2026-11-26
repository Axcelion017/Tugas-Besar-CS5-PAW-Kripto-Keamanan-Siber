"use client";

import React from "react";

export interface ExamTab4PlanProps {
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
  validationErrors: Record<string, string>;
  clearFieldError: (field: string) => void;
}

export function ExamTab4Plan({
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
  validationErrors,
  clearFieldError,
}: ExamTab4PlanProps) {
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
            placeholder={
              "Contoh:\nAmlodipine 10mg tab No. XXX, S 1 dd 1 tab pagi\nKandesartan 8mg tab No. XXX, S 1 dd 1 tab malam"
            }
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
