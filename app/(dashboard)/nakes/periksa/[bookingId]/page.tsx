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
  EncryptedMedicalImage,
} from "@/lib/db/mockData";


function generateRecordId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

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

  // Citra Medis Terlampir (UR-T07)
  const [attachedImages, setAttachedImages] = useState<EncryptedMedicalImage[]>([]);
  const [selectedImageType, setSelectedImageType] = useState<"RONTGEN" | "USG" | "LAB" | "EKG">("RONTGEN");
  const [imageTitle, setImageTitle] = useState("");

  // Addendum State (UR-T09)
  const [isAddendum, setIsAddendum] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getUserSession();
      if (s) {
        setSession(s);
        const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
        const aptList = allApts.length > 0 ? allApts : MOCK_APPOINTMENTS;
        const apt = aptList.find((a) => a.id === bookingId) || MOCK_APPOINTMENTS.find((a) => a.id === bookingId);
        
        if (!apt) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setAppointment(apt);
        setSubjective(apt.keluhanAwal);
        // Jika ada tanda vital dari perawat triase, otomatis isi
        if (apt.triaseVitals) {
          setSystolic(apt.triaseVitals.systolic.toString());
          setDiastolic(apt.triaseVitals.diastolic.toString());
          setHeartRate(apt.triaseVitals.heartRate.toString());
          setTemperature(apt.triaseVitals.temperature.toString());
          setSpo2(apt.triaseVitals.spo2.toString());
        }

        const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
        const patientList = allPatients.length > 0 ? allPatients : MOCK_PATIENTS;
        const foundPatient =
          patientList.find((pt) => pt.id === apt.pasienId || (apt.pasienNik && pt.nik === apt.pasienNik)) ||
          MOCK_PATIENTS.find((pt) => pt.id === apt.pasienId || (apt.pasienNik && pt.nik === apt.pasienNik));
        
        if (!foundPatient) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const safePatient: Patient = {
          ...foundPatient,
          allergies: Array.isArray(foundPatient.allergies) ? foundPatient.allergies : [],
          emergencyContact: foundPatient.emergencyContact || {
            name: "Keluarga Terdaftar",
            relation: "Keluarga",
            phone: "-",
          },
        };

        setPatient(safePatient);
      }
      setIsLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [bookingId]);

  if (notFound) {
    return (
      <div className="p-8 md:p-12 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-12 text-center space-y-5">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-2xl">
          !
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
            404 - DATA TIDAK DITEMUKAN
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
            Jadwal Pemeriksaan Tidak Ditemukan
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Tidak ditemukan jadwal pemeriksaan klinis dengan ID:{" "}
            <span className="font-mono font-bold text-slate-800">{bookingId}</span>
          </p>
        </div>
        <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left font-mono space-y-1">
          <p className="font-bold text-slate-800 uppercase text-[10px]">Pemberitahuan Keamanan:</p>
          <p>
            Prinsip <strong>Zero-Trust</strong> & <strong>Least Privilege</strong>: Sistem menolak memberikan akses ke data pasien lain saat ID yang diminta tidak valid untuk mencegah kerentanan BOLA/IDOR.
          </p>
        </div>
        <div>
          <Link
            href="/nakes"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
          >
            ← Kembali ke Antrean Pasien Dokter
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !session || !appointment || !patient) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memverifikasi Otorisasi Sesi Pemeriksaan...
        </p>
      </div>
    );
  }

  const icd10Map: Record<string, string> = {
    I10: "Hipertensi Esensial (Primer)",
    "J06.9": "Infeksi Saluran Pernapasan Akut (ISPA)",
    E11: "Diabetes Melitus Tipe 2",
    "K29.7": "Gastritis, Unspecified",
    "I20.9": "Angina Pectoris (Nyeri Dada Iskemik)",
  };

  // Deteksi Otomatis Kontraindikasi Alergi Obat (UR-T10)
  const patientAllergies = Array.isArray(patient?.allergies) ? patient.allergies : [];
  const detectedAllergies = patientAllergies.filter((allergy) =>
    planPrescription.toLowerCase().includes(allergy.toLowerCase())
  );

  const handleAddSampleImage = async () => {
    const title = imageTitle.trim() || `Pemeriksaan ${selectedImageType} Klinis`;
    const mockImagePayload = `BINARY_IMAGE_DATA_${selectedImageType}_${Date.now()}`;
    const encryptionKey =
      patient.encryptionKeyHex ||
      "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

    const { ciphertext, iv } = await encryptAES(mockImagePayload, encryptionKey);
    const hmacTag = await generateHMAC(ciphertext, encryptionKey);

    const newImage: EncryptedMedicalImage = {
      id: `IMG-${Date.now().toString().slice(-4)}`,
      title,
      type: selectedImageType,
      encryptedBlobHex: ciphertext,
      ivHex: iv,
      hmacDigest: hmacTag,
      mimeType: "image/jpeg",
      timestamp: new Date().toLocaleTimeString("id-ID"),
      notes: "Terenkripsi AES-256-GCM + HMAC di sisi klien (IndexedDB Blob)",
    };

    setAttachedImages((prev) => [...prev, newImage]);
    setImageTitle("");
  };

  const handleSaveAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (detectedAllergies.length > 0) {
      if (
        !confirm(
          `PERINGATAN KLINIS: Pasien memiliki riwayat alergi terhadap (${detectedAllergies.join(
            ", "
          )}). Apakah Anda yakin ingin melanjutkan peresepan ini?`
        )
      ) {
        return;
      }
    }

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

      const newRecordId = generateRecordId("REC");
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
        version: isAddendum ? 2 : 1,
        addendumReason: isAddendum ? addendumReason : undefined,
        medicalImages: attachedImages,
      };

      if (isOfflineMode) {
        // Simpan ke antrean lokal offline (UR-T05 & UR-T07: IndexedDB Blob)
        const offlineQueue = getStorageData<EncryptedMedicalRecord[]>("resilio_offline_queue", []);
        setStorageData("resilio_offline_queue", [record, ...offlineQueue]);
        window.dispatchEvent(new Event("storage"));

        setSubmitStatus(
          "OFFLINE MODE: Rekam medis dan citra medis terenkripsi tersimpan aman di penyimpanan lokal peramban (IndexedDB). Akan otomatis disinkronkan saat koneksi pulih."
        );
      } else {
        // Simpan ke records pusat
        const existingRecords = getStorageData<EncryptedMedicalRecord[]>("resilio_records", []);
        setStorageData("resilio_records", [record, ...existingRecords]);
        setSubmitStatus("SUKSES: Rekam medis dan citra medis berhasil dienkripsi (AES-256-GCM) dan disahkan.");
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Gagal memproses kriptografi: ${msg}`);
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
        <span>Pemeriksaan Klinis DPJP (SOAP, Citra Medis & Kriptografi)</span>
      </div>

      {/* Header Info Pasien & Triase */}
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
              {appointment.triaseLevel && (
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    appointment.triaseLevel === "MERAH"
                      ? "bg-red-100 text-red-800 border-red-300"
                      : appointment.triaseLevel === "KUNING"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}
                >
                  Triase: {appointment.triaseLevel}
                </span>
              )}
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
            <span className="text-[10px] font-bold text-slate-400 uppercase">Dokter DPJP Bertugas</span>
            <p className="text-xs font-bold text-slate-800">{session.name}</p>
            <p className="text-[10px] text-slate-500 font-mono">STR: {session.strNumber}</p>
          </div>
        </div>

        {/* Banner Alert Alergi Obat Kritis */}
        {patientAllergies.length > 0 && (
          <div className="p-4 bg-red-100 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-xs font-bold">
            <div>
              <span>PERINGATAN ALERGI KRITIS: </span>
              <span className="text-red-700 underline">{patientAllergies.join(", ")}</span>
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-black text-slate-900">
            Dokumen Rekam Medis Elektronik Terstandarisasi (Format SOAP)
          </h2>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={isAddendum}
              onChange={(e) => setIsAddendum(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <span>Mode Addendum Revisi (Permenkes 24/2022)</span>
          </label>
        </div>

        {isAddendum && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs">
            <label className="block font-bold text-amber-900 uppercase text-[10px]">
              Alasan Klinis Revisi Addendum (Immutable Record Versioning) *
            </label>
            <input
              type="text"
              required={isAddendum}
              value={addendumReason}
              onChange={(e) => setAddendumReason(e.target.value)}
              placeholder="Contoh: Koreksi dosis obat setelah hasil rontgen paru diterima..."
              className="w-full px-3 py-2 border rounded-xl bg-white text-sm"
            />
          </div>
        )}

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
            <option value="I20.9">I20.9 — Angina Pectoris (Nyeri Dada Iskemik)</option>
          </select>
        </div>

        {/* Lampiran Citra Medis Terenkripsi (Rontgen/USG/Lab/EKG) - UR-T07 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase">
                Lampiran Citra Medis Terenkripsi (Rontgen, USG, Lab, EKG) — UR-T07
              </p>
              <p className="text-[11px] text-slate-500">
                Disimpan dalam format biner terenkripsi di IndexedDB (kapasitas besar) dan diverifikasi dengan HMAC-SHA256.
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
                setSelectedImageType(
                  e.target.value as "RONTGEN" | "USG" | "LAB" | "EKG"
                )
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
              onClick={handleAddSampleImage}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl whitespace-nowrap"
            >
              + Lampirkan & Enkripsi Citra
            </button>
          </div>

          {attachedImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {attachedImages.map((img) => (
                <div key={img.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-700">{img.type}</span>
                    <p className="font-bold text-slate-800">{img.title}</p>
                    <p className="text-[10px] text-emerald-700 font-mono truncate max-w-xs">
                      HMAC: {img.hmacDigest.slice(0, 16)}...
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{img.timestamp}</span>
                </div>
              ))}
            </div>
          )}
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

            {/* Clinical Alert: Kontraindikasi Alergi (UR-T10) */}
            {detectedAllergies.length > 0 && (
              <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 text-xs font-bold animate-pulse">
                PERINGATAN KONTRAINDIKASI KLINIS (UR-T10): Resep memuat zat berbahaya bagi pasien ini:{" "}
                <span className="underline uppercase">{detectedAllergies.join(", ")}</span>!
              </div>
            )}
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
            {isSubmitting
              ? "Mengenkripsi & Mengesahkan Dokumen..."
              : isAddendum
              ? "Sahkan Revisi Addendum (Versi 2)"
              : "Simpan & Tanda Tangani Berkas RME"}
          </button>
        </div>
      </form>
    </div>
  );
}
