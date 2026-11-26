"use client";

import React from "react";

interface ClinicalActionModalsProps {
  patientName: string;
  showBreakGlassModal: boolean;
  setShowBreakGlassModal: (v: boolean) => void;
  breakGlassReason: string;
  setBreakGlassReason: (v: string) => void;
  onExecuteBreakGlass: () => void;

  showPrescriptionModal: boolean;
  setShowPrescriptionModal: (v: boolean) => void;
  prescriptionInput: string;
  setPrescriptionInput: (v: string) => void;
  signaInput: string;
  setSignaInput: (v: string) => void;
  onAddPrescription: (e: React.FormEvent) => void;

  showLabModal: boolean;
  setShowLabModal: (v: boolean) => void;
  labTestName: string;
  setLabTestName: (v: string) => void;
  labResultValue: string;
  setLabResultValue: (v: string) => void;
  labReferenceRange: string;
  setLabReferenceRange: (v: string) => void;
  labNotes: string;
  setLabNotes: (v: string) => void;
  onAddLabResult: (e: React.FormEvent) => void;

  showProcedureModal: boolean;
  setShowProcedureModal: (v: boolean) => void;
  icd9Code: string;
  setIcd9Code: (v: string) => void;
  procedureName: string;
  setProcedureName: (v: string) => void;
  performerRole: "DOKTER" | "STAF";
  setPerformerRole: (v: "DOKTER" | "STAF") => void;
  procedureNotes: string;
  setProcedureNotes: (v: string) => void;
  onAddProcedure: (e: React.FormEvent) => void;

  isSubmittingAction: boolean;
}

export function ClinicalActionModals(props: ClinicalActionModalsProps) {
  const {
    patientName,
    showBreakGlassModal,
    setShowBreakGlassModal,
    breakGlassReason,
    setBreakGlassReason,
    onExecuteBreakGlass,
    showPrescriptionModal,
    setShowPrescriptionModal,
    prescriptionInput,
    setPrescriptionInput,
    signaInput,
    setSignaInput,
    onAddPrescription,
    showLabModal,
    setShowLabModal,
    labTestName,
    setLabTestName,
    labResultValue,
    setLabResultValue,
    labReferenceRange,
    setLabReferenceRange,
    labNotes,
    setLabNotes,
    onAddLabResult,
    showProcedureModal,
    setShowProcedureModal,
    icd9Code,
    setIcd9Code,
    procedureName,
    setProcedureName,
    performerRole,
    setPerformerRole,
    procedureNotes,
    setProcedureNotes,
    onAddProcedure,
    isSubmittingAction,
  } = props;

  return (
    <>
      {showBreakGlassModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bg-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
              Protokol Darurat ISO 27799
            </span>
            <h3 id="bg-modal-title" className="text-lg font-black text-slate-900">
              Aktivasi Break-Glass IGD — {patientName}
            </h3>
            <p className="text-xs text-slate-600">
              Pembukaan rekam medis tanpa izin pasien hanya diperbolehkan untuk kondisi mengancam
              nyawa. Aktivasi dicatat permanen pada SIEM Kemenkes.
            </p>
            <textarea
              rows={3}
              value={breakGlassReason}
              onChange={(e) => setBreakGlassReason(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold"
              placeholder="Tuliskan indikasi klinis darurat..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onExecuteBreakGlass}
                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl uppercase cursor-pointer"
              >
                Aktifkan Break-Glass
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrescriptionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rx-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={onAddPrescription}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 id="rx-modal-title" className="text-lg font-black text-slate-900">
              Tambah Resep Obat (Immutable Addendum AEAD)
            </h3>
            <div>
              <label htmlFor="rx-name" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nama Obat & Dosis *
              </label>
              <input
                id="rx-name"
                type="text"
                required
                value={prescriptionInput}
                onChange={(e) => setPrescriptionInput(e.target.value)}
                placeholder="Cth: Amlodipine 10mg Tablet"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
              />
            </div>
            <div>
              <label htmlFor="rx-signa" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Aturan Pakai (Signa)
              </label>
              <input
                id="rx-signa"
                type="text"
                value={signaInput}
                onChange={(e) => setSignaInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl uppercase cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAction ? "Menyimpan..." : "Simpan Addendum Resep"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showLabModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={onAddLabResult}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 id="lab-modal-title" className="text-lg font-black text-slate-900">
              Catat Hasil Laboratorium Terenkripsi
            </h3>
            <input
              type="text"
              required
              value={labTestName}
              onChange={(e) => setLabTestName(e.target.value)}
              placeholder="Nama Pemeriksaan Lab"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
            />
            <input
              type="text"
              required
              value={labResultValue}
              onChange={(e) => setLabResultValue(e.target.value)}
              placeholder="Nilai Hasil (cth: 7.400 /uL)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
            />
            <input
              type="text"
              value={labReferenceRange}
              onChange={(e) => setLabReferenceRange(e.target.value)}
              placeholder="Nilai Rujukan Normal"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
            />
            <textarea
              rows={2}
              value={labNotes}
              onChange={(e) => setLabNotes(e.target.value)}
              placeholder="Catatan klinis tambahan..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLabModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl uppercase cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAction ? "Menyimpan..." : "Simpan Hasil Lab"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showProcedureModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="proc-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={onAddProcedure}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 id="proc-modal-title" className="text-lg font-black text-slate-900">
              Catat Tindakan Medis ICD-9-CM
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={icd9Code}
                onChange={(e) => setIcd9Code(e.target.value)}
                placeholder="ICD-9"
                className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold"
              />
              <input
                type="text"
                required
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="Nama Tindakan"
                className="col-span-2 px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
              />
            </div>
            <select
              value={performerRole}
              onChange={(e) => setPerformerRole(e.target.value as "DOKTER" | "STAF")}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
            >
              <option value="DOKTER">Pelaksana: Dokter DPJP</option>
              <option value="STAF">Pelaksana: Staf Perawat Klinis</option>
            </select>
            <textarea
              rows={2}
              value={procedureNotes}
              onChange={(e) => setProcedureNotes(e.target.value)}
              placeholder="Catatan hasil tindakan..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProcedureModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-black text-white bg-slate-900 hover:bg-black rounded-xl uppercase cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAction ? "Menyimpan..." : "Simpan Addendum Tindakan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
