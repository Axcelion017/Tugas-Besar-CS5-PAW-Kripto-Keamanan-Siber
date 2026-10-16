"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { encryptAES } from "@/lib/crypto/aes";
import { generateHMAC } from "@/lib/crypto/hmac";
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  getStorageData,
  setStorageData,
  Appointment,
  Patient,
  EncryptedMedicalRecord,
} from "@/lib/db/mockData";

export default function ClinicalExaminationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const router = useRouter();
  const { bookingId } = use(params);

  const [session, setSession] = useState<UserSession | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Form State SOAP
  const [subjective, setSubjective] = useState("");
  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("80");
  const [heartRate, setHeartRate] = useState("75");
  const [temperature, setTemperature] = useState("36.5");
  const [spo2, setSpo2] = useState("98");
  const [icd10, setIcd10] = useState("I10");
  const [planPrescription, setPlanPrescription] = useState("");
  const [planAction, setPlanAction] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      const apt = allApts.find((a) => a.id === bookingId) || allApts[0];
      setAppointment(apt);

      if (apt) {
        setSubjective(apt.keluhanAwal);
        const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
        const p = allPatients.find((pt) => pt.id === apt.pasienId || pt.nik === apt.pasienNik) || allPatients[0];
        setPatient(p);
      }
    }
  }, [bookingId]);

  if (!session || !appointment || !patient) return null;

  const icd10Map: Record<string, string> = {
    I10: "Hipertensi Esensial (Primer)",
    "J06.9": "Infeksi Saluran Pernapasan Akut (ISPA)",
    E11: "Diabetes Melitus Tipe 2",
    "K29.7": "Gastritis, Unspecified",
    "I20.9": "Angina Pectoris (Nyeri Dada Iskemik)",
  };

  const handleSaveAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    const payloadObj = {
      subjective,
      vitalSigns: {
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        heartRate: Number(heartRate),
        temperature: Number(temperature),
        spo2: Number(spo2),
      },
      assessment: {
        icd10,
        desc: icd10Map[icd10] || "Diagnosis Umum",
      },
      plan: {
        resep: planPrescription
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
        tindakan: planAction,
      },
      meta: {
        dokterId: session.id,
        dokterNama: session.name,
        dokterStr: session.strNumber || "31.1.1.100.2.22.123456",
        faskesNama: appointment.faskesNama,
        timestamp: new Date().toLocaleString("id-ID"),
      },
    };

    const plaintextString = JSON.stringify(payloadObj);
    const encryptionKey =
      patient.encryptionKeyHex ||
      "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

    try {
      // 1. Enkripsi Sisi Klien (AES-256-GCM)
      const { ciphertext, iv } = await encryptAES(plaintextString, encryptionKey);

      // 2. Generate Tag Integritas HMAC-SHA256 atas Ciphertext
      const hmacTag = await generateHMAC(ciphertext, encryptionKey);

      const newRecordId = `REC-${Date.now().toString().slice(-4)}`;
      const isOfflineMode =
        localStorage.getItem("resilio_network_mode") === "offline" || !navigator.onLine;

      const record: EncryptedMedicalRecord = {
        recordId: newRecordId,
        patientId: patient.id,
        patientName: patient.name,
        faskesId: appointment.faskesId,
        faskesNama: appointment.faskesNama,
        dokterStr: session.strNumber || "31.1.1.100.2.22.123456",
        dokterNama: session.name,
        primaryIcd10: icd10,
        diagnosisShort: icd10Map[icd10],
        encryptedPayload: ciphertext,
        ivHex: iv,
        hmacDigest: hmacTag,
        timestamp: new Date().toLocaleString("id-ID"),
        isOfflineCreated: isOfflineMode,
        version: 1,
      };

      if (isOfflineMode) {
        // Simpan ke antrean lokal offline (UR-T05)
        const offlineQueue = getStorageData<EncryptedMedicalRecord[]>("resilio_offline_queue", []);
        setStorageData("resilio_offline_queue", [record, ...offlineQueue]);
        window.dispatchEvent(new Event("storage"));

        setSubmitStatus(
          "OFFLINE MODE: Berkas terenkripsi tersimpan aman di penyimpanan lokal peramban. Akan otomatis disinkronkan saat koneksi pulih."
        );
      } else {
        // Simpan ke records pusat
        const existingRecords = getStorageData<EncryptedMedicalRecord[]>("resilio_records", []);
        setStorageData("resilio_records", [record, ...existingRecords]);
        setSubmitStatus("SUKSES: Rekam medis berhasil dienkripsi (AES-256-GCM) dan disahkan.");
      }

      // Perbarui status appointment menjadi COMPLETED
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      const updatedApts = allApts.map((a) =>
        a.id === appointment.id ? { ...a, status: "COMPLETED" as const } : a
      );
      setStorageData("resilio_appointments", updatedApts);

      setTimeout(() => {
        router.push("/nakes");
      }, 2000);
    } catch (err: any) {
      alert(`Gagal memproses kriptografi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
        <Link href="/nakes" className="hover:underline">
          Stasiun Nakes
        </Link>
        <span>/</span>
        <span>Pemeriksaan Klinis (SOAP & Kriptografi Klien)</span>
      </div>

      {/* Header Info Pasien */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Tiket Pemeriksaan: {appointment.id}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Poli: {appointment.poli}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Pasien: {patient.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              NIK: <span className="font-mono font-bold text-slate-700">{patient.nik}</span> • Usia:{" "}
              {patient.age} Thn • Gol. Darah: <strong>{patient.bloodType}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Faskes Bertugas</span>
            <p className="text-xs font-bold text-slate-800">{appointment.faskesNama}</p>
            <p className="text-[10px] text-slate-500 font-mono">STR: {session.strNumber}</p>
          </div>
        </div>

        {/* Banner Alert Alergi Obat Kritis (UR-P06 & UR-T03) */}
        {patient.allergies.length > 0 && (
          <div className="p-4 bg-red-100 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-xs font-bold">
            <div>
              <span>PERINGATAN ALERGI KRITIS: </span>
              <span className="text-red-700 underline">{patient.allergies.join(", ")}</span>
              <span className="block text-[11px] font-normal text-red-800 mt-0.5">
                Hindari meresepkan golongan obat atau derivat terkait di bawah ini!
              </span>
            </div>
          </div>
        )}
      </div>

      {submitStatus && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {submitStatus}
        </div>
      )}

      {/* Formulir SOAP Klinis */}
      <form onSubmit={handleSaveAndSign} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
          Dokumen Rekam Medis Elektronik Terstandarisasi (Format SOAP)
        </h2>

        {/* 1. Subjective (S) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Subjective (S) — Anamnesis & Keluhan Utama Pasien *
          </label>
          <textarea
            required
            rows={3}
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            placeholder="Jelaskan keluhan utama pasien, onset kejadian, dan riwayat pengobatan mandiri..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* 2. Objective (O) - Vital Signs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
            Objective (O) — Pemeriksaan Fisik & Tanda-Tanda Vital *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Sistolik (mmHg)</span>
              <input
                type="number"
                required
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Diastolik (mmHg)</span>
              <input
                type="number"
                required
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Detak Jantung (bpm)</span>
              <input
                type="number"
                required
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Suhu Tubuh (°C)</span>
              <input
                type="number"
                step="0.1"
                required
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Saturasi O2 (%)</span>
              <input
                type="number"
                required
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>
          </div>
        </div>

        {/* 3. Assessment (A) - ICD-10 */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Assessment (A) — Kode Diagnosis Terstandarisasi ICD-10 *
          </label>
          <select
            value={icd10}
            onChange={(e) => setIcd10(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
          >
            <option value="I10">I10 — Hipertensi Esensial (Primer)</option>
            <option value="J06.9">J06.9 — Infeksi Saluran Pernapasan Akut (ISPA)</option>
            <option value="E11">E11 — Diabetes Melitus Tipe 2</option>
            <option value="K29.7">K29.7 — Gastritis, Unspecified</option>
            <option value="I20.9">I20.9 — Angina Pectoris (Nyeri Dada)</option>
          </select>
        </div>

        {/* 4. Plan (P) - e-Prescription & Edukasi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Plan: Resep Obat Elektronik (e-Prescription) *
            </label>
            <textarea
              required
              rows={3}
              value={planPrescription}
              onChange={(e) => setPlanPrescription(e.target.value)}
              placeholder="Contoh:&#10;Amlodipine 10mg tab No. XXX, S 1 dd 1 tab pagi&#10;Kandesartan 8mg tab No. XXX, S 1 dd 1 tab malam"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Plan: Tindakan / Edukasi Pasien / Rujukan *
            </label>
            <textarea
              required
              rows={3}
              value={planAction}
              onChange={(e) => setPlanAction(e.target.value)}
              placeholder="Contoh: Diet rendah garam, kontrol tensi ulang 2 minggu lagi..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tombol Simpan Kripto & Tanda Tangan */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Dilindungi oleh <strong>AES-256-GCM + HMAC-SHA256</strong> (Client-Side Encryption)
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition cursor-pointer disabled:bg-slate-400"
          >
            {isSubmitting ? "Mengenkripsi & Mengesahkan Dokumen..." : "Simpan & Tanda Tangani Berkas RME"}
          </button>
        </div>
      </form>
    </div>
  );
}
