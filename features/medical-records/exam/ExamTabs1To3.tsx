"use client";

import React from "react";
import type { Appointment, EncryptedMedicalImage, Patient } from "@/lib/db/mockData";

export interface ExamTabs1To3Props {
  activeTab: 1 | 2 | 3 | 4 | 5;
  appointment: Appointment;
  patient: Patient;
  patientAllergies: string[];
  subjective: string;
  setSubjective: (v: string) => void;
  gcsEye: string;
  setGcsEye: (v: string) => void;
  gcsVerbal: string;
  setGcsVerbal: (v: string) => void;
  gcsMotor: string;
  setGcsMotor: (v: string) => void;
  systolic: string;
  setSystolic: (v: string) => void;
  diastolic: string;
  setDiastolic: (v: string) => void;
  heartRate: string;
  setHeartRate: (v: string) => void;
  temperature: string;
  setTemperature: (v: string) => void;
  spo2: string;
  setSpo2: (v: string) => void;
  icd10: string;
  setIcd10: (v: string) => void;
  attachedImages: EncryptedMedicalImage[];
  selectedImageType: "RONTGEN" | "USG" | "LAB" | "EKG";
  setSelectedImageType: (v: "RONTGEN" | "USG" | "LAB" | "EKG") => void;
  imageTitle: string;
  setImageTitle: (v: string) => void;
  onAddSampleImage: () => void;
  validationErrors: Record<string, string>;
  clearFieldError: (field: string) => void;
}

export function ExamTabs1To3(props: ExamTabs1To3Props) {
  const {
    activeTab,
    appointment,
    patient,
    patientAllergies,
    subjective,
    setSubjective,
    gcsEye,
    setGcsEye,
    gcsVerbal,
    setGcsVerbal,
    gcsMotor,
    setGcsMotor,
    systolic,
    setSystolic,
    diastolic,
    setDiastolic,
    heartRate,
    setHeartRate,
    temperature,
    setTemperature,
    spo2,
    setSpo2,
    icd10,
    setIcd10,
    attachedImages,
    selectedImageType,
    setSelectedImageType,
    imageTitle,
    setImageTitle,
    onAddSampleImage,
    validationErrors,
    clearFieldError,
  } = props;

  if (activeTab === 1) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            1. Data Administratif Pendaftaran (Permenkes 24/2022 Pasal 25)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-bold block uppercase text-[10px]">
                No. Rekam Medis (MRN)
              </span>
              <span className="font-mono font-bold text-slate-800">{patient.mrn}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block uppercase text-[10px]">
                Penjamin Biaya
              </span>
              <span className="font-bold text-emerald-700">BPJS Kesehatan (SEP Aktif)</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block uppercase text-[10px]">
                Poli & Faskes
              </span>
              <span className="font-semibold text-slate-800">
                {appointment.poli} • {appointment.faskesNama}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block uppercase text-[10px]">
                Status Triase Loket
              </span>
              <span className="font-bold text-blue-700">
                {appointment.triaseLevel || "HIJAU (Non-Urgent)"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-red-200 bg-red-50/50 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-red-800">
            2. Profil Riwayat Alergi Pasien
          </span>
          {patientAllergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patientAllergies.map((allergy, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 rounded-lg text-xs font-bold"
                >
                  [ALERGI] {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Tidak ada riwayat alergi obat berbahaya yang tercatat.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 2) {
    return (
      <div className="space-y-4">
        <div>
          <label
            htmlFor="exam-subjective"
            className="block text-xs font-bold text-slate-700 uppercase mb-1"
          >
            Subjective (S) — Anamnesis & Keluhan Utama Pasien *
          </label>
          <textarea
            id="exam-subjective"
            required
            rows={3}
            value={subjective}
            onChange={(e) => {
              setSubjective(e.target.value);
              clearFieldError("subjective");
            }}
            placeholder="Jelaskan keluhan utama pasien, onset kejadian, dan riwayat pengobatan mandiri (minimal 10 karakter)..."
            className={`w-full px-4 py-2.5 rounded-xl border font-semibold text-sm focus:outline-none transition ${
              validationErrors.subjective
                ? "border-red-400 bg-red-50/20 focus:ring-2 focus:ring-red-400"
                : "border-slate-300 focus:ring-2 focus:ring-emerald-500"
            }`}
          />
          {validationErrors.subjective && (
            <p className="text-[11px] font-bold text-red-600 mt-1">{validationErrors.subjective}</p>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            Tingkat Kesadaran Glasgow Coma Scale (GCS)
          </span>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="gcs-eye" className="block text-[10px] font-bold text-slate-600 uppercase">
                Eye (1-4)
              </label>
              <select
                id="gcs-eye"
                value={gcsEye}
                onChange={(e) => setGcsEye(e.target.value)}
                className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm"
              >
                <option value="4">4 - Spontan</option>
                <option value="3">3 - Terhadap Suara</option>
                <option value="2">2 - Terhadap Nyeri</option>
                <option value="1">1 - Tidak Ada</option>
              </select>
            </div>
            <div>
              <label htmlFor="gcs-verbal" className="block text-[10px] font-bold text-slate-600 uppercase">
                Verbal (1-5)
              </label>
              <select
                id="gcs-verbal"
                value={gcsVerbal}
                onChange={(e) => setGcsVerbal(e.target.value)}
                className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm"
              >
                <option value="5">5 - Orientasi Baik</option>
                <option value="4">4 - Bingung</option>
                <option value="3">3 - Kata Tidak Tepat</option>
                <option value="2">2 - Suara Tanpa Arti</option>
                <option value="1">1 - Tidak Ada</option>
              </select>
            </div>
            <div>
              <label htmlFor="gcs-motor" className="block text-[10px] font-bold text-slate-600 uppercase">
                Motorik (1-6)
              </label>
              <select
                id="gcs-motor"
                value={gcsMotor}
                onChange={(e) => setGcsMotor(e.target.value)}
                className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm"
              >
                <option value="6">6 - Menurut Perintah</option>
                <option value="5">5 - Melokalisir Nyeri</option>
                <option value="4">4 - Menghindar Nyeri</option>
                <option value="3">3 - Fleksi Abnormal</option>
                <option value="2">2 - Ekstensi</option>
                <option value="1">1 - Tidak Ada</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <span className="block text-xs font-bold text-slate-700 uppercase mb-2">
            Objective (O) — Tanda-Tanda Vital Fisiologis *
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: "v-sys", label: "Sistolik (70-250)", val: systolic, set: setSystolic, err: validationErrors.systolic, step: "1" },
              { id: "v-dia", label: "Diastolik (40-150)", val: diastolic, set: setDiastolic, err: validationErrors.diastolic, step: "1" },
              { id: "v-hr", label: "Nadi (bpm)", val: heartRate, set: setHeartRate, err: validationErrors.heartRate, step: "1" },
              { id: "v-temp", label: "Suhu (°C)", val: temperature, set: setTemperature, err: validationErrors.temperature, step: "0.1" },
              { id: "v-spo2", label: "SpO2 (%)", val: spo2, set: setSpo2, err: validationErrors.spo2, step: "1" },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="text-[10px] font-bold text-slate-600 uppercase">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="number"
                  step={field.step}
                  required
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                    field.err ? "border-red-400 bg-red-50/20" : "border-slate-300"
                  }`}
                />
                {field.err && <p className="text-[10px] text-red-600 mt-0.5">{field.err}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 3) {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="exam-icd10" className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Assessment (A) — Kode Diagnosis Terstandarisasi ICD-10 WHO *
          </label>
          <select
            id="exam-icd10"
            value={icd10}
            onChange={(e) => setIcd10(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
          >
            <option value="I10">I10 — Hipertensi Esensial (Primer)</option>
            <option value="J06.9">J06.9 — Infeksi Saluran Pernapasan Akut (ISPA)</option>
            <option value="E11">E11 — Diabetes Melitus Tipe 2</option>
            <option value="K29.7">K29.7 — Gastritis, Unspecified</option>
            <option value="I20.9">I20.9 — Angina Pectoris (Nyeri Dada Iskemik)</option>
          </select>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase">
                Lampiran Citra Medis Penunjang (Rontgen, USG, Lab, EKG)
              </p>
              <p className="text-[11px] text-slate-500">
                Dienkripsi menggunakan AES-256-GCM + HKDF + HMAC-SHA256 sebelum disimpan.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              {attachedImages.length} Citra Terlampir
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedImageType}
              onChange={(e) =>
                setSelectedImageType(e.target.value as "RONTGEN" | "USG" | "LAB" | "EKG")
              }
              className="px-3 py-2 border rounded-xl text-xs bg-white font-semibold"
            >
              <option value="RONTGEN">Foto Rontgen (X-Ray)</option>
              <option value="USG">Ultrasonografi (USG)</option>
              <option value="LAB">Hasil Scan Laboratorium</option>
              <option value="EKG">Rekaman Grafik EKG</option>
            </select>
            <input
              type="text"
              value={imageTitle}
              onChange={(e) => setImageTitle(e.target.value)}
              placeholder="Keterangan berkas (cth: Rontgen Thorax PA)"
              className="flex-1 px-3 py-2 border rounded-xl text-xs"
            />
            <button
              type="button"
              onClick={onAddSampleImage}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer"
            >
              + Lampirkan & Enkripsi Citra
            </button>
          </div>

          {attachedImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-700">{img.type}</span>
                    <p className="font-bold text-slate-800">{img.title}</p>
                    <p className="text-[10px] text-emerald-700 font-mono truncate max-w-xs">
                      HMAC: {img.hmacDigest.slice(0, 16)}...
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{img.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
