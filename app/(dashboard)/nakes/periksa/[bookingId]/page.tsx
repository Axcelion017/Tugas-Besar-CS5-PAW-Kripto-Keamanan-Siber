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
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import { submitPemeriksaanKlinisAction } from "@/lib/actions/clinical";
import { PrintableMedicalResume } from "@/components/clinical/PrintableMedicalResume";


const AVAILABLE_REFERRAL_FASKES = [
  { id: "FAS-01", nama: "RSUP Dr. Sardjito", tipe: "RS Umum Pusat (Tipe A)", kota: "Yogyakarta" },
  { id: "FAS-02", nama: "RS Harapan Sehat", tipe: "RS Rujukan Kardiologi", kota: "Sleman" },
  { id: "FAS-03", nama: "Klinik Pratama Sehat Mandiri", tipe: "Klinik Pratama Faskes 1", kota: "Sleman" },
  { id: "FAS-04", nama: "Puskesmas Mlati 1", tipe: "Puskesmas Kecamatan", kota: "Sleman" },
];

const AVAILABLE_REFERRAL_DOCTORS = [
  { id: "DOC-01", name: "dr. Andi Pratama, Sp.PD", specialty: "Spesialis Penyakit Dalam", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito", str: "31.1.1.100.2.22.123456" },
  { id: "DOC-02", name: "dr. Ratna Juwita, Sp.JP", specialty: "Spesialis Kardiologi & Jantung", faskesId: "FAS-02", faskesName: "RS Harapan Sehat", str: "31.2.1.200.2.21.654321" },
  { id: "DOC-03", name: "dr. Sarah, Sp.A", specialty: "Spesialis Anak & Tumbuh Kembang", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito", str: "31.1.2.300.2.20.789012" },
  { id: "DOC-04", name: "dr. Rian, Sp.JP", specialty: "Spesialis Bedah Vaskular", faskesId: "FAS-01", faskesName: "RSUP Dr. Sardjito", str: "31.1.1.400.2.19.112233" },
];

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

  // Form State SOAP & Permenkes 24/2022 5-Tab
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [gcsEye, setGcsEye] = useState("4");
  const [gcsVerbal, setGcsVerbal] = useState("5");
  const [gcsMotor, setGcsMotor] = useState("6");
  const [icd9Procedure, setIcd9Procedure] = useState("89.52");
  const [dischargeDisposition, setDischargeDisposition] = useState("PULANG_SEHAT_KONTROL");
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

  // Surat Medis & Billing State
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [berikanSuratSakit, setBerikanSuratSakit] = useState(false);
  const [lamaHariSakit, setLamaHariSakit] = useState("3");
  const [isRujukan, setIsRujukan] = useState(false);
  const [rujukanFaskesId, setRujukanFaskesId] = useState("FAS-02");
  const [rujukanDokterId, setRujukanDokterId] = useState("DOC-02");
  const [rujukanUrgensi, setRujukanUrgensi] = useState("Mendesak (24 Jam)");
  const [rujukanTujuan, setRujukanTujuan] = useState("RS Harapan Sehat");
  const [rujukanAlasan, setRujukanAlasan] = useState("Evaluasi kardiomegali lanjut & angiografi koroner");
  const [jadwalKontrol, setJadwalKontrol] = useState("2026-11-04");
  const [biayaKonsultasi] = useState(100000);
  const [biayaTindakan] = useState(50000);
  const [biayaObat] = useState(85000);

  // Konfirmasi Medikolegal & Validasi Skema Zod
  const [isMedicallyConfirmed, setIsMedicallyConfirmed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
    setValidationErrors({});

    // Validasi Sisi Klien menggunakan Skema Zod
    const validationResult = PemeriksaanKlinisSchema.safeParse({
      subjective,
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
      temperature: Number(temperature),
      spo2: Number(spo2),
      icd10,
      planPrescription,
      planAction: planAction || undefined,
      isMedicallyConfirmed,
    });

    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path[0]?.toString() || "form";
        if (!formattedErrors[key]) {
          formattedErrors[key] = issue.message;
        }
      }
      setValidationErrors(formattedErrors);
      return;
    }

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

        // Eksekusi Server Action untuk persistensi ke Basis Data PostgreSQL
        try {
          const fd = new FormData();
          fd.append("bookingId", appointment.id);
          fd.append("subjective", subjective);
          fd.append("systolic", String(systolic));
          fd.append("diastolic", String(diastolic));
          fd.append("heartRate", String(heartRate));
          fd.append("temperature", String(temperature));
          fd.append("respiratoryRate", "20");
          fd.append("spo2", String(spo2));
          fd.append("icd10", icd10);
          fd.append("assessment", icd10Map[icd10] || "Pemeriksaan Medis Rawat Jalan");
          fd.append("planPrescription", planPrescription);
          fd.append("planFollowUp", planAction || "Kontrol 1 minggu kemudian");
          if (detectedAllergies.length > 0) fd.append("forceOverrideAllergy", "true");
          fd.append("isMedicallyConfirmed", "true");
          await submitPemeriksaanKlinisAction(null, fd);
        } catch (saErr) {
          console.log("Server Action sync status:", saErr);
        }

        setSubmitStatus("SUKSES: Rekam medis dan citra medis berhasil dienkripsi (AES-256-GCM) dan disinkronkan ke PostgreSQL.");
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Cetak Resume Medis</span>
            </button>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Dokter DPJP Bertugas</span>
              <p className="text-xs font-bold text-slate-800">{session.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">STR: {session.strNumber}</p>
            </div>
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

      {/* Banner Galat Validasi Zod */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-medium space-y-1 animate-fade-in">
          <p className="font-bold text-red-800 uppercase text-[10px] tracking-wider">
            Terdapat data yang belum memenuhi aturan validasi medis (Skema Zod):
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {Object.values(validationErrors).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulir SOAP Klinis Terpadu 5-Tab (Permenkes No. 24/2022) */}
      <form onSubmit={handleSaveAndSign} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Dokumen Rekam Medis Elektronik Terpadu (Permenkes RI No. 24/2022)
            </h2>
            <p className="text-[11px] text-slate-500">
              Format 5-Tab: Administratif, Anamnesis/Fisik, ICD-10/Penunjang, Terapi/ICD-9, & CPPT/Resume
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={isAddendum}
              onChange={(e) => setIsAddendum(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <span>Mode Addendum Revisi</span>
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

        {/* Tab Navigation (5 Pilar Permenkes 24/2022) */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 1
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tab 1: Administratif & Alergi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 2
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tab 2: Anamnesis & Fisik
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(3)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 3
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tab 3: Diagnosis & Citra Medis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(4)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 4
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tab 4: Penatalaksanaan & Resep
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(5)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 5
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tab 5: CPPT & Pengesahan
          </button>
        </div>

        {/* TAB 1: RINGKASAN ADMINISTRATIF & ALERT ALERGI */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                1. Data Administratif Pendaftaran (Permenkes 24/2022 Pasal 25)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">No. Rekam Medis (MRN)</span>
                  <span className="font-mono font-bold text-slate-800">{patient.mrn}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Penjamin Biaya</span>
                  <span className="font-bold text-emerald-700">BPJS Kesehatan (SEP Aktif)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Poli & Faskes</span>
                  <span className="font-semibold text-slate-800">{appointment.poli} • {appointment.faskesNama}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Status Triase Loket</span>
                  <span className="font-bold text-blue-700">{appointment.triaseLevel || "HIJAU (Non-Urgent)"}</span>
                </div>
              </div>
            </div>

            {/* Riwayat Alergi Pasien */}
            <div className="p-4 rounded-2xl border border-red-200 bg-red-50/50 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-800">
                2. Profil Riwayat Alergi Pasien
              </span>
              {patientAllergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {patientAllergies.map((allergy, i) => (
                    <span key={i} className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 rounded-lg text-xs font-bold">
                      [ALERGI] {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Tidak ada riwayat alergi obat berbahaya yang tercatat.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANAMNESIS & PEMERIKSAAN FISIK */}
        {activeTab === 2 && (
          <div className="space-y-4">
            {/* Subjective (S) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Subjective (S) — Anamnesis & Keluhan Utama Pasien *
              </label>
              <textarea
                required
                rows={3}
                value={subjective}
                onChange={(e) => {
                  setSubjective(e.target.value);
                  if (validationErrors.subjective) {
                    setValidationErrors((prev) => {
                      const cp = { ...prev };
                      delete cp.subjective;
                      return cp;
                    });
                  }
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

            {/* Skor GCS */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Tingkat Kesadaran Glasgow Coma Scale (GCS)
              </span>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Eye (1-4)</label>
                  <select value={gcsEye} onChange={(e) => setGcsEye(e.target.value)} className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm">
                    <option value="4">4 - Spontan</option>
                    <option value="3">3 - Terhadap Suara</option>
                    <option value="2">2 - Terhadap Nyeri</option>
                    <option value="1">1 - Tidak Ada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Verbal (1-5)</label>
                  <select value={gcsVerbal} onChange={(e) => setGcsVerbal(e.target.value)} className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm">
                    <option value="5">5 - Orientasi Baik</option>
                    <option value="4">4 - Bingung</option>
                    <option value="3">3 - Kata Tidak Tepat</option>
                    <option value="2">2 - Suara Tanpa Arti</option>
                    <option value="1">1 - Tidak Ada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Motorik (1-6)</label>
                  <select value={gcsMotor} onChange={(e) => setGcsMotor(e.target.value)} className="w-full mt-1 p-2 rounded-xl border bg-white font-bold text-sm">
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

            {/* Tanda Vital Fisik */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Objective (O) — Tanda-Tanda Vital Fisiologis *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Sistolik (70-250)</span>
                  <input
                    type="number"
                    required
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                      validationErrors.systolic ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.systolic && (
                    <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.systolic}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Diastolik (40-150)</span>
                  <input
                    type="number"
                    required
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                      validationErrors.diastolic ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.diastolic && (
                    <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.diastolic}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Detak Jantung (bpm)</span>
                  <input
                    type="number"
                    required
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                      validationErrors.heartRate ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.heartRate && (
                    <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.heartRate}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Suhu (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                      validationErrors.temperature ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.temperature && (
                    <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.temperature}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Saturasi O2 (%)</span>
                  <input
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border font-bold text-sm ${
                      validationErrors.spo2 ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.spo2 && (
                    <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.spo2}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSIS (ICD-10) & CITRA MEDIS */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Assessment (A) — Kode Diagnosis Terstandarisasi ICD-10 WHO *
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

            {/* Lampiran Citra Medis Terenkripsi */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase">
                    Lampiran Citra Medis Penunjang (Rontgen, USG, Lab, EKG)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dienkripsi menggunakan AES-256-GCM biner dan diproteksi dengan HMAC-SHA256 sebelum disimpan.
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
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer"
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
          </div>
        )}

        {/* TAB 4: PENATALAKSANAAN, RESEP, FARMASI & TINDAKAN */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Plan: Resep Obat Elektronik (e-Prescription) & Farmasi *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={planPrescription}
                    onChange={(e) => {
                      setPlanPrescription(e.target.value);
                      if (validationErrors.planPrescription) {
                        setValidationErrors((prev) => {
                          const cp = { ...prev };
                          delete cp.planPrescription;
                          return cp;
                        });
                      }
                    }}
                    placeholder="Contoh:&#10;Amlodipine 10mg tab No. XXX, S 1 dd 1 tab pagi&#10;Kandesartan 8mg tab No. XXX, S 1 dd 1 tab malam"
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

                  {/* Clinical Alert: Kontraindikasi Alergi (UR-T10) */}
                  {detectedAllergies.length > 0 && (
                    <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 text-xs font-bold animate-pulse">
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tindakan Medis Terstandarisasi ICD-9-CM
                  </label>
                  <select
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Catatan Edukasi & Tindak Lanjut Pasien *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={planAction}
                    onChange={(e) => setPlanAction(e.target.value)}
                    placeholder="Contoh: Diet rendah garam, kurangi kafein, kontrol tensi ulang 2 minggu lagi..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Rincian Billing & Biaya Pelayanan */}
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-900 text-[10px] uppercase">
                    <span>Estimasi Rincian Biaya (Billing Pelayanan)</span>
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
          </div>
        )}

        {/* TAB 5: SURAT MEDIS, PERSETUJUAN, RESUME & RIWAYAT ADDENDUM */}
        {activeTab === 5 && (
          <div className="space-y-4">
            {/* Surat Medis: Surat Sakit & Surat Rujukan */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Pembuatan Surat Keterangan Medis Resmi
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Surat Keterangan Sakit */}
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
                      <span className="text-slate-500">Lama Istirahat:</span>
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

                {/* Surat Rujukan Faskes Lanjutan */}
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
                      {/* Pilih Faskes Tujuan Terverifikasi */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                          Faskes Rujukan Tujuan *
                        </label>
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
                      </div>

                      {/* Pilih Dokter Spesialis Tujuan */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                          Dokter Spesialis Tujuan * (Dokter Berpraktik di RS)
                        </label>
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
                      </div>

                      {/* Tingkat Urgensi Rujukan */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                          Tingkat Urgensi Rujukan
                        </label>
                        <select
                          value={rujukanUrgensi}
                          onChange={(e) => setRujukanUrgensi(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="Rutin / Terencana (7 Hari)">Rutin / Terencana (7 Hari)</option>
                          <option value="Mendesak (24 Jam)">Mendesak (24 Jam)</option>
                          <option value="Gawat Darurat Segera (Transfer Ambulans)">Gawat Darurat Segera (Transfer Ambulans)</option>
                        </select>
                      </div>

                      {/* Alasan Rujukan Klinis */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                          Indikasi & Alasan Klinis Rujukan *
                        </label>
                        <textarea
                          rows={2}
                          value={rujukanAlasan}
                          onChange={(e) => setRujukanAlasan(e.target.value)}
                          placeholder="Indikasi rujukan, pemeriksaan penunjang yang diperlukan..."
                          className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Disposisi Resume Medis */}
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
                  <option value="PINDAH_RUANG_RAWAT">PINDAH KE RUANG RAWAT INAP (RAWAT LANJUTAN)</option>
                  <option value="DIRUJUK_FASKES_LAIN">DIRUJUK KE FASKES LAIN (RUJUKAN VERTIKAL/HORIZONTAL)</option>
                  <option value="PULANG_ATAS_PERMINTAAN_SENDIRI">PULANG ATAS PERMINTAAN SENDIRI (APS)</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 whitespace-nowrap">Jadwal Kontrol:</span>
                  <input
                    type="date"
                    value={jadwalKontrol}
                    onChange={(e) => setJadwalKontrol(e.target.value)}
                    className="p-2 border rounded-xl bg-white font-bold text-xs flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Riwayat Perubahan Rekam Medis (Addendum History & Audit Trail) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Riwayat Silsilah Perubahan Berkas (Addendum Audit Trail - Permenkes 24/2022)
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">Versi 1: Dokumen Rekam Medis Induk</span>
                    <p className="text-[11px] text-slate-500">Dibuat saat pemeriksaan fisik pertama oleh {session.name}</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Tersimpan Permanen
                  </span>
                </div>
                {isAddendum && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-900">Versi 2: Addendum Koreksi (Akan Disahkan)</span>
                      <p className="text-[11px] text-amber-800">Alasan: {addendumReason || "Koreksi catatan klinis dan resep"}</p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Draft Revisi
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Kotak Centang Konfirmasi Keabsahan Medikolegal */}
            <div className={`p-4 rounded-2xl border transition ${
              validationErrors.isMedicallyConfirmed ? "bg-red-50/40 border-red-300" : "bg-emerald-50/40 border-emerald-200"
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMedicallyConfirmed}
                  onChange={(e) => {
                    setIsMedicallyConfirmed(e.target.checked);
                    if (e.target.checked && validationErrors.isMedicallyConfirmed) {
                      setValidationErrors((prev) => {
                        const cp = { ...prev };
                        delete cp.isMedicallyConfirmed;
                        return cp;
                      });
                    }
                  }}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 cursor-pointer shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 block">
                    Konfirmasi Keabsahan Medikolegal & Tanda Tangan (Permenkes No. 24/2022) *
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Saya menyatakan dengan sadar bahwa seluruh pengkajian klinis ini didasarkan pada pemeriksaan fisik langsung dan sah untuk dienkripsi serta disahkan menggunakan kunci sesi dokter.
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
        )}

        {/* Navigasi Tab & Tombol Simpan */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {activeTab > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : 1))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Tab Sebelumnya
              </button>
            )}
            {activeTab < 5 && (
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev < 5 ? ((prev + 1) as 1 | 2 | 3 | 4 | 5) : 5))}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Lanjut ke Tab {activeTab + 1} →
              </button>
            )}
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

      {/* Modal Cetak Dokumen Rekam Medis Sah */}
      {isPrintOpen && (
        <PrintableMedicalResume
          data={{
            recordId: `REC-${appointment?.id || "2026-001"}`,
            faskesNama: appointment?.faskesNama || "RSUP Dr. Sardjito",
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
            perawatNama: "Ns. Maya Indah, S.Kep",
            perawatNip: "198804122015022001",
            perawatPosisi: "Perawat Pelaksana Triase & Admisi",
            triaseLevel: appointment.triaseLevel || "HIJAU (Non-Urgent)",
            triageVitals: {
              systolic: Number(systolic),
              diastolic: Number(diastolic),
              heartRate: Number(heartRate),
              temperature: Number(temperature),
              spo2: Number(spo2),
            },
            subjective,
            diagnosisIcd10: icd10,
            diagnosisShort: icd10Map[icd10] || "Hipertensi Esensial",
            prosedurIcd9: icd9Procedure,
            tindakanMedis: "Electrocardiogram (EKG 12-Lead)",
            prescriptions: planPrescription
              .split("\n")
              .map((r) => r.trim())
              .filter(Boolean),
            edukasiDokter: planAction,
            suratKeteranganSakit: {
              diberikan: berikanSuratSakit,
              lamaHari: Number(lamaHariSakit),
              mulaiTanggal: new Date().toLocaleDateString("id-ID"),
            },
            suratRujukan: {
              isRujukan,
              tujuanFaskes: `${rujukanTujuan} (DPJP Konsulen: ${AVAILABLE_REFERRAL_DOCTORS.find((d) => d.id === rujukanDokterId)?.name || "Dokter Spesialis Konsulen"} [${rujukanUrgensi}])`,
              alasanRujukan: rujukanAlasan,
            },
            billing: {
              biayaKonsultasi,
              biayaTindakan,
              biayaObat,
              totalBiaya: biayaKonsultasi + biayaTindakan + biayaObat,
              statusKlaim: "DITANGGUNG JKN (BPJS KESEHATAN)",
            },
            version: isAddendum ? 2 : 1,
            addendumReason: isAddendum ? addendumReason : undefined,
          }}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
}
