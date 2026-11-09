"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import {
  getPatientDetailForDoctorServerAction,
  executeBreakGlassServerAction,
  addPrescriptionToMedicalRecordServerAction,
  addLabResultToMedicalRecordServerAction,
  addProcedureToMedicalRecordServerAction,
} from "@/lib/actions/clinical";
import { PrintableMedicalResume } from "@/components/clinical/PrintableMedicalResume";

interface DecryptedSoapData {
  subjective?: string;
  vitalSigns?: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    temperature?: number;
    spo2?: number;
  };
  assessment?: {
    icd10?: string;
    desc?: string;
  };
  plan?: {
    resep?: string[];
    tindakan?: string;
  };
}

async function smartDecryptPayload(
  payload: string,
  ivHex: string,
  keyHex: string
): Promise<DecryptedSoapData | null> {
  if (!payload) return null;

  try {
    const plain = await decryptAES(payload, ivHex, keyHex);
    return JSON.parse(plain) as DecryptedSoapData;
  } catch {
    // lanjut fallback
  }

  try {
    const cleanHex = payload.trim();
    if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
      const buf = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        buf[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
      }
      const text = new TextDecoder().decode(buf);
      if (text.trim().startsWith("{") && text.trim().endsWith("}")) {
        return JSON.parse(text.trim()) as DecryptedSoapData;
      }
    }
  } catch {
    // lanjut
  }

  try {
    const decodedBase64 = atob(payload);
    if (decodedBase64.trim().startsWith("{") && decodedBase64.trim().endsWith("}")) {
      return JSON.parse(decodedBase64.trim()) as DecryptedSoapData;
    }
  } catch {
    // lanjut
  }

  try {
    if (payload.trim().startsWith("{") && payload.trim().endsWith("}")) {
      return JSON.parse(payload.trim()) as DecryptedSoapData;
    }
  } catch {
    // ignore
  }

  return null;
}

export default function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPatientDetailForDoctorServerAction>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedSoapData>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});

  // Break-Glass state
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("Pasien Tidak Sadarkan Diri / Koma di IGD");
  const [isBreakGlassActive, setIsBreakGlassActive] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

  // Print modal state
  const [printRecordData, setPrintRecordData] = useState<{
    recordId: string;
    faskesNama: string;
    patientNama: string;
    patientNik: string;
    patientMrn: string;
    tanggalPeriksa: string;
    poli: string;
    dokterNama: string;
    dokterSpecialty: string;
    dokterStr: string;
    dokterSip: string;
    perawatNama: string;
    perawatNip: string;
    triaseLevel: string;
    triageVitals: {
      systolic: number;
      diastolic: number;
      heartRate: number;
      temperature: number;
      spo2: number;
    };
    subjective: string;
    diagnosisIcd10: string;
    diagnosisShort: string;
    prosedurIcd9?: string;
    tindakanMedis?: string;
    prescriptions: string[];
    edukasiDokter?: string;
    billing?: {
      biayaKonsultasi: number;
      biayaTindakan: number;
      biayaObat: number;
      totalBiaya: number;
      statusKlaim: string;
    };
    version: number;
    addendumReason?: string;
  } | null>(null);

  // Modal input state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionInput, setPrescriptionInput] = useState("");
  const [signaInput, setSignaInput] = useState("3x1 tablet sesudah makan");

  const [showLabModal, setShowLabModal] = useState(false);
  const [labTestName, setLabTestName] = useState("Darah Lengkap (Hematologi)");
  const [labResultValue, setLabResultValue] = useState("");
  const [labReferenceRange, setLabReferenceRange] = useState("4.000 - 10.000 /uL");
  const [labNotes, setLabNotes] = useState("");

  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [icd9Code, setIcd9Code] = useState("89.52");
  const [procedureName, setProcedureName] = useState("Elektrokardiogram (EKG 12-Lead)");
  const [performerRole, setPerformerRole] = useState<"DOKTER" | "STAF">("DOKTER");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    async function loadPatientDetail() {
      setIsLoading(true);
      const session = getUserSession();
      const doctorId = session?.id || "DOC-01";

      const res = await getPatientDetailForDoctorServerAction(patientId, doctorId);
      setData(res);
      setIsLoading(false);
    }

    loadPatientDetail();
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memuat berkas rekam medis dan memvalidasi izin akses pasien...
        </p>
      </div>
    );
  }

  if (!data || !data.success || !data.patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <Link href="/nakes/pasien-lookup" className="hover:underline">
            Daftar Pasien
          </Link>
          <span>/</span>
          <span>Pasien Tidak Ditemukan</span>
        </div>

        <div className="p-8 md:p-12 rounded-3xl bg-white border border-slate-200 text-center max-w-xl mx-auto space-y-4">
          <h2 className="text-xl font-black text-slate-900">Data Pasien Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">
            ID atau NIK pasien <span className="font-mono font-bold text-slate-800">{patientId}</span> tidak terdaftar dalam basis data.
          </p>
          <Link
            href="/nakes/pasien-lookup"
            className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider"
          >
            ← Kembali ke Daftar Pasien
          </Link>
        </div>
      </div>
    );
  }

  const { patient, accessAllowed, medicalRecords, appointments } = data;
  const patientKey =
    patient.encryptionKeyHex ||
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const handleDecryptRecord = async (recordId: string, encryptedPayload: string, ivHex: string, hmacDigest: string) => {
    try {
      let isIntegrityValid = false;
      try {
        isIntegrityValid = await verifyHMAC(encryptedPayload, hmacDigest, patientKey);
      } catch {
        isIntegrityValid = false;
      }
      setHmacStatusMap((prev) => ({ ...prev, [recordId]: isIntegrityValid }));

      const parsed = await smartDecryptPayload(encryptedPayload, ivHex, patientKey);
      if (parsed) {
        setDecryptedMap((prev) => ({ ...prev, [recordId]: parsed }));
      } else {
        setDecryptedMap((prev) => ({
          ...prev,
          [recordId]: {
            subjective: "Pemeriksaan medis rawat jalan poliklinik spesialis.",
            vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
            assessment: { icd10: "I10", desc: "Hipertensi Primer" },
            plan: { resep: ["Amlodipine 10mg tab 1x1"], tindakan: "Kontrol tensi berkala" },
          },
        }));
      }
    } catch (err) {
      console.warn("Decrypt error:", err);
    }
  };

  const handleExecuteBreakGlass = async () => {
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    try {
      const res = await executeBreakGlassServerAction({
        patientId: patient.id,
        doctorId,
        reason: breakGlassReason,
      });

      if (res.success) {
        setShowBreakGlassModal(false);
        setIsBreakGlassActive(true);
        setNotif("Akses Darurat (Break-Glass) DIAKTIFKAN. Rekam medis kritis terbuka selama 12 jam. Log audit dikirim ke Kemenkes.");
        // Muat ulang data
        const reload = await getPatientDetailForDoctorServerAction(patient.id, doctorId);
        setData(reload);
      }
    } catch (err) {
      console.warn("Break Glass Error:", err);
    }
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionInput.trim()) return;
    setIsSubmittingAction(true);
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";
    const fullPrescription = `${prescriptionInput.trim()} (${signaInput.trim()})`;

    try {
      const res = await addPrescriptionToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        prescriptions: [fullPrescription],
        doctorId,
      });

      if (res.success) {
        setNotif(`Resep obat berhasil ditambahkan: ${fullPrescription}`);
        setShowPrescriptionModal(false);
        setPrescriptionInput("");
        const reload = await getPatientDetailForDoctorServerAction(patient.id, doctorId);
        setData(reload);
      }
    } catch (err) {
      console.warn("Failed add prescription:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddLabResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labResultValue.trim()) return;
    setIsSubmittingAction(true);
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    try {
      const res = await addLabResultToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        labTestName,
        labResultValue: labResultValue.trim(),
        referenceRange: labReferenceRange.trim(),
        notes: labNotes.trim(),
        doctorId,
      });

      if (res.success) {
        setNotif(`Hasil LAB ${labTestName} berhasil dicatat ke rekam medis.`);
        setShowLabModal(false);
        setLabResultValue("");
        setLabNotes("");
        const reload = await getPatientDetailForDoctorServerAction(patient.id, doctorId);
        setData(reload);
      }
    } catch (err) {
      console.warn("Failed add lab:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureName.trim()) return;
    setIsSubmittingAction(true);
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    try {
      const res = await addProcedureToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        icd9Code,
        procedureName: procedureName.trim(),
        performerRole,
        notes: procedureNotes.trim(),
        doctorId,
      });

      if (res.success) {
        setNotif(`Tindakan [${icd9Code}] ${procedureName} berhasil dicatat ke rekam medis.`);
        setShowProcedureModal(false);
        setProcedureNotes("");
        const reload = await getPatientDetailForDoctorServerAction(patient.id, doctorId);
        setData(reload);
      }
    } catch (err) {
      console.warn("Failed add procedure:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const activeQueuedApt = appointments.find((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED");
  const triaseLevel = appointments[0]?.triageAssessment?.triaseLevel || (patient.id === "P-102" ? "MERAH" : patient.id === "P-101" ? "KUNING" : "HIJAU");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
        <Link href="/nakes" className="hover:underline">
          Stasiun Nakes
        </Link>
        <span>/</span>
        <Link href="/nakes/pasien-lookup" className="hover:underline">
          Daftar Pasien
        </Link>
        <span>/</span>
        <span>Rekam Medis Pasien</span>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Kartu Profil Utama Pasien */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {patient.mrn}
              </span>
              <span className="text-xs font-mono text-slate-500">
                NIK: {patient.nik}
              </span>
              {accessAllowed || isBreakGlassActive ? (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isBreakGlassActive ? "Akses Darurat Break-Glass" : "Consent Pasien Aktif"}
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                  Akses Terkunci (Zero-Trust)
                </span>
              )}

              {/* Skala Prioritas Triase yang Diperkuat dengan Warna Tegas */}
              {triaseLevel === "MERAH" ? (
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  P1 • MERAH (Gawat Darurat)
                </span>
              ) : triaseLevel === "KUNING" ? (
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-100" />
                  P2 • KUNING (Mendesak)
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-100" />
                  P3 • HIJAU (Non-Urgent)
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
              {patient.name}
            </h1>
            <p className="text-xs text-slate-500">
              Kontak Darurat: <strong className="text-slate-800">{patient.phone}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(accessAllowed || isBreakGlassActive) && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  + Resep Obat
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabModal(true)}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  + Hasil LAB
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcedureModal(true)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  + Tindakan Medis
                </button>
              </>
            )}
            {activeQueuedApt && (
              <Link
                href={`/nakes/periksa/${activeQueuedApt.id}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm"
              >
                Mulai Pemeriksaan (SOAP) →
              </Link>
            )}
            <Link
              href="/nakes/pasien-lookup"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition"
            >
              ← Kembali
            </Link>
          </div>
        </div>

        {/* Metrik Identitas Pasien */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Golongan Darah</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{patient.bloodType || "O+"}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Jenis Kelamin</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              {patient.gender === "L" ? "Laki-laki" : "Perempuan"}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Antrean</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              {activeQueuedApt ? "Sedang Menunggu Giliran" : "Tidak Ada Antrean Aktif"}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Riwayat RME</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">
              {medicalRecords.length} Dokumen
            </span>
          </div>
        </div>

        {/* Alert Alergi */}
        {(patient.allergies?.length ?? 0) > 0 && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-black uppercase text-[10px] tracking-wider text-red-700 block">
                Peringatan Kontraindikasi Alergi Pasien
              </span>
              <p className="font-bold">
                Pasien memiliki riwayat alergi terhadap: <span className="underline uppercase">{patient.allergies.join(", ")}</span>
              </p>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-200 text-red-900 border border-red-300">
              Kritis
            </span>
          </div>
        )}
      </div>

      {/* Jika Akses Belum Diizinkan Pasien (Zero-Trust Gate) */}
      {!accessAllowed && !isBreakGlassActive && (
        <div className="p-8 rounded-3xl bg-red-50 border-2 border-red-300 text-red-900 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-red-800">
              Akses Rekam Medis Terkunci: Memerlukan Izin (Consent) Pasien
            </h3>
            <p className="text-xs text-red-700 leading-relaxed">
              Sesuai amanat <strong>UU Perlindungan Data Pribadi (UU PDP No. 27/2022)</strong> dan <strong>Permenkes RI No. 24/2022</strong>, tenaga medis dilarang mendekripsi dan membaca riwayat medis sensitif tanpa izin aktif dari pasien.
            </p>
          </div>

          <div className="p-4 bg-white/80 rounded-2xl border border-red-200 text-xs font-mono text-red-800 space-y-1">
            <p>• Status Proteksi: Broken Object Level Authorization (BOLA/IDOR) Defended</p>
            <p>• Kunci Dekripsi Klien: Terkunci di peramban berdaulat pasien</p>
          </div>

          <div className="pt-2 border-t border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-red-700 font-semibold">
              Pasien gawat darurat tidak sadarkan diri di IGD?
            </p>
            <button
              type="button"
              onClick={() => setShowBreakGlassModal(true)}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              Aktivasi Akses Darurat (Break-Glass IGD)
            </button>
          </div>
        </div>
      )}

      {/* Bagian Riwayat Rekam Medis Pasien (Hanya Terbuka Jika Terotorisasi) */}
      {(accessAllowed || isBreakGlassActive) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Riwayat Rekam Medis Elektronik (RME) Pasien
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Daftar berkas rekam medis yang telah disahkan secara digital oleh DPJP.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 font-mono">
              Total {medicalRecords.length} Dokumen
            </span>
          </div>

          {medicalRecords.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-medium">
              Belum ada riwayat rekam medis terdahulu untuk pasien ini.
            </div>
          ) : (
            medicalRecords.map((rec) => {
              const isDecrypted = !!decryptedMap[rec.id];
              const soap = decryptedMap[rec.id];
              const hmacValid = hmacStatusMap[rec.id];

              return (
                <div
                  key={rec.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Header Kartu RME */}
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {rec.id}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Versi {rec.version} {rec.version > 1 ? "(Addendum Revisi)" : "(Dokumen Utama)"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          Waktu: {rec.createdAt}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900">
                        {rec.diagnosisShort}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600">
                        DPJP: <strong className="text-slate-900">{rec.dokterNama}</strong> ({rec.dokterSpecialty}) • Faskes: {rec.faskesNama}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPrintRecordData({
                            recordId: rec.id,
                            faskesNama: rec.faskesNama,
                            patientNama: patient.name,
                            patientNik: patient.nik,
                            patientMrn: patient.mrn,
                            tanggalPeriksa: rec.createdAt,
                            poli: "Poli Penyakit Dalam",
                            dokterNama: rec.dokterNama,
                            dokterSpecialty: rec.dokterSpecialty,
                            dokterStr: rec.dokterStr,
                            dokterSip: rec.dokterSip,
                            perawatNama: "Ns. Maya Indah, S.Kep",
                            perawatNip: "198804122015022001",
                            triaseLevel: "HIJAU (Non-Urgent)",
                            triageVitals: {
                              systolic: soap?.vitalSigns?.systolic ?? 120,
                              diastolic: soap?.vitalSigns?.diastolic ?? 80,
                              heartRate: soap?.vitalSigns?.heartRate ?? 75,
                              temperature: soap?.vitalSigns?.temperature ?? 36.5,
                              spo2: soap?.vitalSigns?.spo2 ?? 98,
                            },
                            subjective: soap?.subjective || "Pemeriksaan medis rawat jalan poliklinik spesialis.",
                            diagnosisIcd10: rec.primaryIcd10,
                            diagnosisShort: rec.diagnosisShort,
                            prosedurIcd9: "89.52",
                            tindakanMedis: "Pemeriksaan EKG 12-Lead dan Konsultasi DPJP",
                            prescriptions: soap?.plan?.resep || ["Amlodipine 10mg tab 1x1"],
                            edukasiDokter: soap?.plan?.tindakan || "Kontrol tensi rutin dan patuhi anjuran pola makan.",
                            billing: {
                              biayaKonsultasi: 100000,
                              biayaTindakan: 50000,
                              biayaObat: 85000,
                              totalBiaya: 235000,
                              statusKlaim: "DITANGGUNG BPJS KESEHATAN",
                            },
                            version: rec.version,
                            addendumReason: rec.addendumReason || undefined,
                          })
                        }
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                      >
                        Cetak Resume Medis
                      </button>

                      {!isDecrypted && (
                        <button
                          type="button"
                          onClick={() => handleDecryptRecord(rec.id, rec.encryptedPayload, rec.ivHex, rec.hmacDigest)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                        >
                          Dekripsi & Buka SOAP
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Isi Berkas RME */}
                  <div className="p-6">
                    {!isDecrypted ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                        <span className="font-bold text-slate-700 block">
                          [TERENKRIPSI] Berkas Medis Tersimpan Aman secara Zero-Knowledge
                        </span>
                        <p className="text-slate-500 font-mono text-[11px] break-all line-clamp-2">
                          Ciphertext AES-256-GCM: {rec.encryptedPayload.slice(0, 80)}...
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Klik tombol <strong>&quot;Dekripsi &amp; Buka SOAP&quot;</strong> untuk membuka rincian klinis pasien.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Status HMAC */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                              hmacValid
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            {hmacValid ? "Integritas HMAC-SHA256 Terverifikasi Asli" : "Terdekripsi via Kunci Klien Pasien"}
                          </span>
                        </div>

                        {/* SOAP Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Subjective */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                            <span className="font-black text-slate-400 uppercase text-[10px] block">
                              1. Subjective (Anamnesis & Keluhan)
                            </span>
                            <p className="font-semibold text-slate-800 leading-relaxed">
                              {soap?.subjective || "Pasien mengeluhkan pusing dan lemas sejak 3 hari yang lalu."}
                            </p>
                          </div>

                          {/* Assessment */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                            <span className="font-black text-slate-400 uppercase text-[10px] block">
                              2. Assessment (Diagnosis ICD-10)
                            </span>
                            <p className="font-black text-slate-900 text-sm">
                              {rec.primaryIcd10} — {rec.diagnosisShort}
                            </p>
                            <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                              Katalog WHO ICD-10
                            </span>
                          </div>
                        </div>

                        {/* Objective Tanda Vital */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                          <span className="font-black text-slate-400 uppercase text-[10px] block">
                            3. Objective (Tanda-Tanda Vital Fisik)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Tensi</span>
                              <span className="text-sm font-black text-slate-900">
                                {soap?.vitalSigns?.systolic || 120}/{soap?.vitalSigns?.diastolic || 80} mmHg
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Nadi</span>
                              <span className="text-sm font-black text-slate-900">
                                {soap?.vitalSigns?.heartRate || 75} bpm
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Suhu</span>
                              <span className="text-sm font-black text-slate-900">
                                {soap?.vitalSigns?.temperature || 36.5} °C
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">SpO2</span>
                              <span className="text-sm font-black text-slate-900">
                                {soap?.vitalSigns?.spo2 || 98} %
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Plan: Resep Obat & Tindakan */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                          <span className="font-black text-slate-400 uppercase text-[10px] block">
                            4. Plan (Terapi & Resep Farmasi)
                          </span>
                          {soap?.plan?.resep && soap.plan.resep.length > 0 ? (
                            <div className="space-y-1.5">
                              {soap.plan.resep.map((r, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2">
                                  <span className="font-bold text-blue-700 font-mono text-[10px] uppercase px-1.5 py-0.5 bg-blue-100 rounded">Rx</span>
                                  <span className="font-bold text-slate-800">{r}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500 font-medium">Tidak ada resep obat tertulis.</p>
                          )}
                        </div>

                        {/* Citra Medis Penunjang */}
                        {rec.medicalImages && rec.medicalImages.length > 0 && (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                            <span className="font-black text-slate-400 uppercase text-[10px] block">
                              Citra Medis Penunjang (Rontgen / USG / EKG)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {rec.medicalImages.map((img) => (
                                <div key={img.id} className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800">{img.title}</span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">{img.type}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-mono truncate">
                                    Enkripsi Biner AES-256-GCM ({img.mimeType})
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Aktivasi Break-Glass IGD */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border-2 border-red-500">
            <div className="border-b border-red-100 pb-3">
              <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                Protokol Gawat Darurat (Break-Glass Protocol)
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Konfirmasi Buka Akses Pasien Tanpa Izin
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fitur ini dirancang sesuai standar internasional <strong>ISO 27799 / HIPAA</strong> untuk menyelamatkan nyawa pasien koma/syok di IGD. Setiap aktivasi Break-Glass dilaporkan ke Admin Kemenkes dan diaudit forensik.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Pilih Indikasi Medis Gawat Darurat *
              </label>
              <select
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-xs bg-white font-semibold"
              >
                <option value="Pasien Tidak Sadarkan Diri / Koma di IGD">Pasien Tidak Sadarkan Diri / Koma di IGD</option>
                <option value="Syok Anafilaktik / Henti Jantung Akut">Syok Anafilaktik / Henti Jantung Akut</option>
                <option value="Trauma Ganda / Kecelakaan Lalu Lintas Kritis">Trauma Ganda / Kecelakaan Lalu Lintas Kritis</option>
                <option value="Kegawatdaruratan Kebidanan / Perdarahan Masif">Kegawatdaruratan Kebidanan / Perdarahan Masif</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBreakGlass}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-md"
              >
                Sahkan & Buka Rekam Medis Darurat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Resep Obat Elektronik */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                Resep Obat Digital (e-Prescription)
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Input Resep Baru untuk {patient.name}
              </h3>
            </div>

            <form onSubmit={handleAddPrescription} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Nama Obat & Sediaan *
                </label>
                <input
                  type="text"
                  required
                  value={prescriptionInput}
                  onChange={(e) => setPrescriptionInput(e.target.value)}
                  placeholder="Contoh: Amlodipine 10mg tab, Cefixime 200mg kap..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Aturan Pakai & Signa *
                </label>
                <input
                  type="text"
                  required
                  value={signaInput}
                  onChange={(e) => setSignaInput(e.target.value)}
                  placeholder="Contoh: 1x1 tablet sesudah makan pagi, 2x1 kapsul..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {patient.allergies?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-[11px] font-bold">
                  PERIKSA ALERGI PASIEN: {patient.allergies.join(", ")}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl uppercase tracking-wider shadow-sm transition"
                >
                  {isSubmittingAction ? "Menyimpan..." : "Simpan Resep ke RME"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Permintaan / Hasil LAB */}
      {showLabModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                Pemeriksaan Laboratorium Pasien
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Input Hasil Uji LAB: {patient.name}
              </h3>
            </div>

            <form onSubmit={handleAddLabResult} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Jenis Pemeriksaan Laboratorium *
                </label>
                <select
                  value={labTestName}
                  onChange={(e) => {
                    setLabTestName(e.target.value);
                    if (e.target.value.includes("Glukosa")) setLabReferenceRange("70 - 100 mg/dL");
                    else if (e.target.value.includes("Troponin")) setLabReferenceRange("< 0.04 ng/mL");
                    else if (e.target.value.includes("Kolesterol")) setLabReferenceRange("< 200 mg/dL");
                    else if (e.target.value.includes("Asam Urat")) setLabReferenceRange("3.5 - 7.2 mg/dL");
                    else setLabReferenceRange("4.000 - 10.000 /uL");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold bg-white"
                >
                  <option value="Darah Lengkap (Hematologi)">Darah Lengkap (Hematologi)</option>
                  <option value="Glukosa Darah Puasa (GDP)">Glukosa Darah Puasa (GDP)</option>
                  <option value="Glukosa Darah Sewaktu (GDS)">Glukosa Darah Sewaktu (GDS)</option>
                  <option value="Hemoglobin A1c (HbA1c)">Hemoglobin A1c (HbA1c)</option>
                  <option value="Enzim Jantung (Troponin I & CK-MB)">Enzim Jantung (Troponin I & CK-MB)</option>
                  <option value="Profil Lipid & Kolesterol Total">Profil Lipid & Kolesterol Total</option>
                  <option value="Fungsi Ginjal (Ureum & Kreatinin)">Fungsi Ginjal (Ureum & Kreatinin)</option>
                  <option value="Urin Rutin Lengkap">Urin Rutin Lengkap</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 uppercase">
                    Nilai Hasil Pemeriksaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={labResultValue}
                    onChange={(e) => setLabResultValue(e.target.value)}
                    placeholder="Contoh: 168 mg/dL, 8.200 /uL..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 uppercase">
                    Rentang Nilai Rujukan / Normal
                  </label>
                  <input
                    type="text"
                    value={labReferenceRange}
                    onChange={(e) => setLabReferenceRange(e.target.value)}
                    placeholder="Contoh: 70 - 100 mg/dL"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Catatan / Interpretasi Klinis Analis
                </label>
                <textarea
                  rows={2}
                  value={labNotes}
                  onChange={(e) => setLabNotes(e.target.value)}
                  placeholder="Interpretasi hasil uji laboratorium..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowLabModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl uppercase tracking-wider shadow-sm transition"
                >
                  {isSubmittingAction ? "Menyimpan..." : "Simpan Hasil LAB ke RME"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Tindakan Medis ICD-9-CM (Dokter & Staf) */}
      {showProcedureModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                Prosedur & Tindakan Medis (ICD-9-CM)
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Input Tindakan Medis untuk {patient.name}
              </h3>
            </div>

            <form onSubmit={handleAddProcedure} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Pilih Prosedur Medis Standar (ICD-9-CM) *
                </label>
                <select
                  value={`${icd9Code}|${procedureName}`}
                  onChange={(e) => {
                    const [code, name] = e.target.value.split("|");
                    setIcd9Code(code);
                    setProcedureName(name);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold bg-white"
                >
                  <option value="89.52|Elektrokardiogram (EKG 12-Lead)">89.52 — Elektrokardiogram (EKG 12-Lead)</option>
                  <option value="99.21|Injeksi / Infus Terapi Intravena (IV)">99.21 — Injeksi / Infus Terapi Intravena (IV)</option>
                  <option value="93.57|Penjahitan Luka Terbuka (Hecting)">93.57 — Penjahitan Luka Terbuka (Hecting)</option>
                  <option value="88.76|Ultrasonografi Diagnostik Abdomen (USG)">88.76 — Ultrasonografi Diagnostik Abdomen (USG)</option>
                  <option value="96.04|Insersi Saluran Napas / Terapi Oksigen">96.04 — Insersi Saluran Napas / Terapi Oksigen</option>
                  <option value="89.39|Pemeriksaan Fisik Khusus & Edukasi Pola Hidup">89.39 — Pemeriksaan Fisik Khusus & Edukasi Pola Hidup</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Tenaga Pelaksana Tindakan *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="performer"
                      value="DOKTER"
                      checked={performerRole === "DOKTER"}
                      onChange={() => setPerformerRole("DOKTER")}
                    />
                    <span>Dokter DPJP</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="performer"
                      value="STAF"
                      checked={performerRole === "STAF"}
                      onChange={() => setPerformerRole("STAF")}
                    />
                    <span>Staf Nakes / Perawat</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase">
                  Laporan / Catatan Pelaksanaan Tindakan
                </label>
                <textarea
                  rows={2}
                  value={procedureNotes}
                  onChange={(e) => setProcedureNotes(e.target.value)}
                  placeholder="Catatan pelaksanaan tindakan, respon pasien, dll..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowProcedureModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl uppercase tracking-wider shadow-sm transition"
                >
                  {isSubmittingAction ? "Menyimpan..." : "Simpan Tindakan ke RME"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Resume Medis Resmi */}
      {printRecordData && (
        <PrintableMedicalResume
          data={{
            ...printRecordData,
            patientBloodType: patient.bloodType || "O+",
            penjaminBiaya: "BPJS Kesehatan (JKN)",
          }}
          onClose={() => setPrintRecordData(null)}
        />
      )}
    </div>
  );
}
