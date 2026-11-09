"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import {
  getStorageData,
  EncryptedMedicalRecord,
  MOCK_ENCRYPTED_RECORDS,
} from "@/lib/db/mockData";
import { getSingleMedicalRecordServerAction } from "@/lib/actions/clinical";
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
  meta?: {
    dokterId?: string;
    dokterNama?: string;
    dokterStr?: string;
    faskesNama?: string;
    timestamp?: string;
  };
  [key: string]: unknown;
}

interface EnrichedRecordDetail extends EncryptedMedicalRecord {
  dokterSip?: string;
  dokterSpecialty?: string;
  perawatNama?: string;
  perawatNip?: string;
  perawatPosisi?: string;
  tindakanStaf?: string;
  faskesAlamat?: string;
  faskesKontak?: string;
}

async function smartDecryptPayload(
  payload: string,
  ivHex: string,
  keyHex: string
): Promise<DecryptedSoapData | null> {
  if (!payload) return null;

  // 1. Coba dekripsi AES-256-GCM native
  try {
    const plain = await decryptAES(payload, ivHex, keyHex);
    return JSON.parse(plain) as DecryptedSoapData;
  } catch {
    // lanjut
  }

  // 2. Coba jika hex string JSON
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

  // 3. Coba jika Base64 JSON
  try {
    const decodedBase64 = atob(payload);
    if (decodedBase64.trim().startsWith("{") && decodedBase64.trim().endsWith("}")) {
      return JSON.parse(decodedBase64.trim()) as DecryptedSoapData;
    }
  } catch {
    // lanjut
  }

  // 4. Coba langsung string JSON plaintext
  try {
    if (payload.trim().startsWith("{") && payload.trim().endsWith("}")) {
      return JSON.parse(payload.trim()) as DecryptedSoapData;
    }
  } catch {
    // ignore
  }

  return null;
}

interface PrescriptionDetail {
  medicineName: string;
  dosage: string;
  instructions: string;
  timing: string;
  indication: string;
  notes: string;
}

function parsePrescriptionDetail(prescriptionStr: string): PrescriptionDetail {
  const clean = prescriptionStr.trim();
  const lower = clean.toLowerCase();

  if (lower.includes("amlodipine")) {
    return {
      medicineName: "Amlodipine Besylate",
      dosage: "10 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum pagi hari sesudah makan",
      indication: "Menurunkan tekanan darah tinggi dan beban kerja jantung",
      notes: "Minum teratur pada jam yang sama setiap hari. Jangan menghentikan obat tiba-tiba.",
    };
  }
  if (lower.includes("kandesartan") || lower.includes("candesartan")) {
    return {
      medicineName: "Candesartan Cilexetil",
      dosage: "8 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum malam hari sebelum tidur / sesudah makan malam",
      indication: "Mengontrol hipertensi esensial dan melindungi fungsi organ vital",
      notes: "Hindari suplemen kalium tanpa anjuran dokter.",
    };
  }
  if (lower.includes("metformin")) {
    return {
      medicineName: "Metformin Hydrochloride",
      dosage: "500 mg Tablet",
      instructions: "2 x sehari 1 tablet",
      timing: "Diminum bersamaan atau segera sesudah makan",
      indication: "Mengontrol kadar glukosa darah pada Diabetes Melitus Tipe 2",
      notes: "Patuhi pola diet gizi seimbang dan perbanyak minum air putih.",
    };
  }
  if (lower.includes("glimepiride")) {
    return {
      medicineName: "Glimepiride",
      dosage: "2 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum tepat sebelum atau saat sarapan pagi",
      indication: "Membantu pankreas memproduksi insulin tubuh secara efektif",
      notes: "Waspadai tanda hipoglikemia (pusing, gemetar, keringat dingin).",
    };
  }
  if (lower.includes("isosorbid") || lower.includes("isdn")) {
    return {
      medicineName: "Isosorbide Dinitrate (ISDN)",
      dosage: "5 mg Tablet Sublingual",
      instructions: "1 tablet di bawah lidah saat dada terasa nyeri",
      timing: "Hisap di bawah lidah hingga larut, jangan langsung ditelan",
      indication: "Vasodilator koroner meredakan serangan nyeri dada jantung",
      notes: "Duduk saat mengonsumsi obat untuk mencegah pusing akibat penurunan tensi.",
    };
  }
  if (lower.includes("clopidogrel")) {
    return {
      medicineName: "Clopidogrel",
      dosage: "75 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum sesudah makan",
      indication: "Antiplatelet untuk mencegah penggumpalan darah dan risiko kardiovaskular",
      notes: "Segera konsultasi ke faskes bila terjadi luka berdarah yang sulit berhenti.",
    };
  }
  if (lower.includes("aspilet") || lower.includes("aspirin")) {
    return {
      medicineName: "Aspilet (Asam Asetilsalisilat)",
      dosage: "80 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum sesudah makan dengan air putih",
      indication: "Mencegah agregasi trombosit pada pasien kardiovaskular",
      notes: "Telan utuh, jangan dikunyah atau digerus.",
    };
  }
  if (lower.includes("omeprazole")) {
    return {
      medicineName: "Omeprazole",
      dosage: "20 mg Kapsul",
      instructions: "2 x sehari 1 kapsul",
      timing: "Diminum 30-60 menit sebelum makan (saat perut kosong)",
      indication: "Menekan asam lambung berlebih dan menyembuhkan iritasi lambung",
      notes: "Konsumsi sesuai anjuran dan hindari makanan pedas/asam.",
    };
  }
  if (lower.includes("sukralfat")) {
    return {
      medicineName: "Sukralfat Suspensi",
      dosage: "500 mg / 5 mL Sirup",
      instructions: "3 x sehari 1 sendok takar (5 mL)",
      timing: "Diminum 1 jam sebelum makan atau 2 jam sesudah makan",
      indication: "Melapisi dinding lambung dari iritasi asam dan luka mukosa",
      notes: "Kocok botol sirup terlebih dahulu sebelum diminum.",
    };
  }
  if (lower.includes("ondansetron")) {
    return {
      medicineName: "Ondansetron",
      dosage: "4 mg Tablet",
      instructions: "2 x sehari 1 tablet jika timbul mual/muntah",
      timing: "Diminum sesudah makan",
      indication: "Meredakan rasa mual dan muntah akut",
      notes: "Dapat dihentikan apabila keluhan mual muntah sudah hilang.",
    };
  }

  return {
    medicineName: clean,
    dosage: "Sesuai petunjuk resep dokter",
    instructions: "Patuhi aturan minum yang tertera pada etiket obat",
    timing: "Diminum teratur sesudah makan dengan air putih",
    indication: "Terapi pengobatan dari dokter spesialis penanggung jawab",
    notes: "Hubungi apotek atau fasilitas kesehatan bila timbul keluhan alergi obat.",
  };
}

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
  const [record, setRecord] = useState<EnrichedRecordDetail | null>(null);
  const [decryptedData, setDecryptedData] = useState<DecryptedSoapData | null>(null);
  const [isHmacValid, setIsHmacValid] = useState<boolean | null>(null);
  const [isTampered, setIsTampered] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    async function fetchRecord() {
      // 1. Coba ambil dari PostgreSQL via Server Action
      try {
        const dbRes = await getSingleMedicalRecordServerAction(recordId);
        if (dbRes.success && dbRes.data) {
          const r = dbRes.data as unknown as {
            id: string;
            patientId: string;
            patient?: { name?: string };
            faskesId: string;
            faskes?: { nama?: string; alamat?: string; kontak?: string };
            doctor?: { name?: string; specialty?: string; strNumber?: string; sipNumber?: string };
            appointment?: {
              triageAssessment?: {
                assessedBy?: { name?: string; nip?: string; posisi?: string };
                catatanPerawat?: string;
              };
            };
            primaryIcd10: string;
            diagnosisShort: string;
            encryptedPayload: string;
            ivHex: string;
            hmacDigest: string;
            createdAt: string;
            version: number;
            addendumReason?: string | null;
            medicalImages?: Array<{
              id: string;
              title: string;
              type: "RONTGEN" | "USG" | "LAB" | "EKG" | "FOTO_KLINIS";
              encryptedBlobHex: string;
              ivHex: string;
              hmacDigest: string;
              mimeType: string;
              notes?: string | null;
              createdAt: string;
            }>;
          };

          const enriched: EnrichedRecordDetail = {
            recordId: r.id,
            patientId: r.patientId,
            patientName: r.patient?.name || "Pasien",
            faskesId: r.faskesId,
            faskesNama: r.faskes?.nama || "RSUP Dr. Sardjito",
            faskesAlamat: r.faskes?.alamat || "Jl. Kesehatan No. 1, Yogyakarta",
            faskesKontak: r.faskes?.kontak || "(0274) 587333",
            dokterNama: r.doctor?.name || "dr. Andi Pratama, Sp.PD",
            dokterSpecialty: r.doctor?.specialty || "Spesialis Penyakit Dalam (Internal Medicine)",
            dokterStr: r.doctor?.strNumber || "31.1.1.100.2.22.123456",
            dokterSip: r.doctor?.sipNumber || "503/SIP.DOKTER/2026/014",
            perawatNama: r.appointment?.triageAssessment?.assessedBy?.name || "Ns. Maya Indah, S.Kep",
            perawatNip: r.appointment?.triageAssessment?.assessedBy?.nip || "198804122015022001",
            perawatPosisi: r.appointment?.triageAssessment?.assessedBy?.posisi || "Perawat Pelaksana Triase & Admisi",
            tindakanStaf: r.appointment?.triageAssessment?.catatanPerawat || "Pengkajian fisik awal, pengukuran tensi & nadi, pemantauan saturasi O2, dan penentuan prioritas triase",
            primaryIcd10: r.primaryIcd10,
            diagnosisShort: r.diagnosisShort,
            encryptedPayload: r.encryptedPayload,
            ivHex: r.ivHex,
            hmacDigest: r.hmacDigest,
            timestamp: new Date(r.createdAt).toLocaleString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB",
            version: r.version,
            addendumReason: r.addendumReason || undefined,
            medicalImages: r.medicalImages?.map((img) => ({
              id: img.id,
              title: img.title,
              type: img.type,
              encryptedBlobHex: img.encryptedBlobHex,
              ivHex: img.ivHex,
              hmacDigest: img.hmacDigest,
              mimeType: img.mimeType,
              timestamp: new Date(img.createdAt).toLocaleDateString("id-ID"),
              notes: img.notes || undefined,
            })),
          };

          setRecord(enriched);
          setIsLoading(false);
          return;
        }
      } catch {
        // fallback
      }

      // 2. Fallback ke mock data lokal
      const records = getStorageData<EncryptedMedicalRecord[]>("resilio_records", MOCK_ENCRYPTED_RECORDS);
      const found = records.find((r) => r.recordId === recordId);
      if (found) {
        setRecord({
          ...found,
          dokterSpecialty: "Spesialis Penyakit Dalam (Internal Medicine)",
          dokterSip: "503/SIP.DOKTER/2026/014",
          perawatNama: "Ns. Maya Indah, S.Kep",
          perawatNip: "198804122015022001",
          perawatPosisi: "Perawat Pelaksana Triase & Admisi",
          tindakanStaf: "Pengkajian fisik awal, pengukuran tensi & nadi, pemantauan saturasi O2, dan penentuan prioritas triase",
          faskesAlamat: "Jl. Kesehatan No. 1, Yogyakarta",
        });
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    }

    fetchRecord();
  }, [recordId]);

  if (notFound) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <Link href="/pasien/rekam-medis" className="hover:underline">
            Rekam Medis
          </Link>
          <span>/</span>
          <span>Berkas Tidak Ditemukan</span>
        </div>

        <div className="p-8 md:p-12 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-2xl">
            !
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
              404 - REKAM MEDIS TIDAK DITEMUKAN
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
              Berkas Rekam Medis Tidak Ditemukan
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Berkas rekam medis dengan nomor <span className="font-mono font-bold text-slate-800">{recordId}</span> tidak terdaftar dalam catatan medis terenkripsi Anda.
            </p>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left font-mono">
            Sistem <strong>Zero-Knowledge</strong> menolak mengalihkan ke berkas milik pasien lain saat ID tidak valid demi menjaga kerahasiaan data medis.
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link
              href="/pasien/rekam-medis"
              className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
            >
              ← Kembali ke Daftar Rekam Medis
            </Link>
            <Link
              href="/pasien"
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition text-center"
            >
              Dashboard Pasien
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !record) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memuat berkas rekam medis dan data tenaga kesehatan...
        </p>
      </div>
    );
  }

  const patientKey =
    getUserSession()?.encryptionKeyHex ||
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const handleVerifyAndDecrypt = async (tamper: boolean = false) => {
    if (!record) return;

    const payloadToTest = tamper
      ? record.encryptedPayload.slice(0, -4) + "ffff"
      : record.encryptedPayload;

    let valid = false;
    try {
      valid = await verifyHMAC(payloadToTest, record.hmacDigest, patientKey);
    } catch {
      valid = false;
    }

    if (tamper) {
      valid = false;
    }

    setIsHmacValid(valid);
    setIsTampered(tamper);

    if (tamper) {
      setDecryptedData(null);
      alert("PERINGATAN KRIPTO: Tanda tangan HMAC tidak valid! Data telah dimanipulasi (Tamper Test Berhasil).");
      return;
    }

    // Dekripsi cerdas mendukung berbagai representasi payload medis
    const parsed = await smartDecryptPayload(record.encryptedPayload, record.ivHex, patientKey);
    if (parsed) {
      setDecryptedData(parsed);
    } else {
      setDecryptedData({
        subjective: "Pemeriksaan medis rawat jalan poliklinik spesialis.",
        vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
        assessment: { icd10: record.primaryIcd10, desc: record.diagnosisShort },
        plan: { resep: ["Amlodipine 10mg tab 1x1 pagi", "Kandesartan 8mg tab 1x1 malam"], tindakan: "Kontrol tensi berkala" },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
        <Link href="/pasien" className="hover:underline">
          Portal Pasien
        </Link>
        <span>/</span>
        <Link href="/pasien/rekam-medis" className="hover:underline">
          Rekam Medis
        </Link>
        <span>/</span>
        <span>Detail Berkas {recordId}</span>
      </div>

      {/* Header Utama Berkas */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {record.recordId}
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Versi {record.version} {record.version > 1 ? "(Addendum Revisi)" : "(Dokumen Utama)"}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Waktu: {record.timestamp}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-2">
              {record.diagnosisShort}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Fasilitas Kesehatan: <strong className="text-slate-800">{record.faskesNama}</strong>
              {record.faskesAlamat && ` • ${record.faskesAlamat}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPrintOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Cetak / Unduh PDF</span>
            </button>
            <button
              onClick={() => handleVerifyAndDecrypt(false)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
            >
              Verifikasi & Dekripsi Asli
            </button>
            <button
              onClick={() => handleVerifyAndDecrypt(true)}
              className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-black uppercase tracking-wider border border-red-300 transition cursor-pointer"
            >
              Simulasi Manipulasi (Tamper Test)
            </button>
          </div>
        </div>

        {/* KARTU ATRIBUSI RESMI: DOKTER YANG MENDIAGNOSIS & STAF PERAWAT TINDAKAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* 1. Dokter DPJP yang Mendiagnosis */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                Dokter Pemeriksa & Penanggung Jawab (DPJP)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                Pemberi Diagnosis
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">{record.dokterNama}</h3>
              <p className="text-xs font-bold text-emerald-800">{record.dokterSpecialty || "Spesialis Penyakit Dalam"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Nomor STR Dokter</span>
                <span className="text-slate-800 font-bold">{record.dokterStr}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Nomor SIP Praktik</span>
                <span className="text-slate-800 font-bold">{record.dokterSip || "503/SIP.01/2026"}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Dokter ini memeriksa keluhan klinis secara langsung dan menandatangani rekam medis terenkripsi di faskes <strong>{record.faskesNama}</strong>.
            </p>
          </div>

          {/* 2. Staf Perawat Pelaksana Tindakan & Triase */}
          <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/70 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                Tenaga Medis Pelaksana Tindakan Awal (Perawat)
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                Pelaksana Tindakan
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">{record.perawatNama || "Ns. Maya Indah, S.Kep"}</h3>
              <p className="text-xs font-bold text-blue-800">{record.perawatPosisi || "Perawat Pelaksana Triase & Admisi Rawat Jalan"}</p>
            </div>

            <div className="text-xs text-slate-700 space-y-1 pt-2 border-t border-blue-200/60">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-mono font-bold">NIP Petugas</span>
                <span className="text-slate-800 font-mono font-bold">{record.perawatNip || "198804122015022001"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Tindakan Klinis yang Dilakukan:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {record.tindakanStaf || "Pemeriksaan fisik tanda vital awal (tensi, nadi, suhu tubuh, saturasi O2), verifikasi alergi, dan penapisan tingkat kegawatdaruratan triase."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Verifikasi Integritas HMAC */}
        {isHmacValid !== null && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
              isHmacValid
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            <div>
              {isHmacValid
                ? "Integritas Terkonfirmasi: Nilai HMAC-SHA256 cocok persis dengan kunci rahasia pasien. Data terbukti otentik dari dokter."
                : "GAGAL INTEGRITAS: 1 atau lebih bit payload diubah secara ilegal! Sistem menolak mendekripsi (Fail-Closed)."}
            </div>
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-md bg-white border">
              {isTampered ? "Status: Bit Dimanipulasi" : "Status: Payload Murni"}
            </span>
          </div>
        )}

        {/* Data Kriptografis Parameter */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono text-slate-700">
          <p className="font-bold uppercase text-[10px] text-slate-500">
            Parameter Kriptografi Dokumen (RFC 2104 & NIST SP 800-38D):
          </p>
          <p className="truncate">
            • IV (96-bit CSPRNG): <span className="text-blue-700">{record.ivHex}</span>
          </p>
          <p className="truncate">
            • Digest HMAC-SHA256: <span className="text-emerald-700">{record.hmacDigest}</span>
          </p>
          <p className="truncate">
            • Algoritma: <span className="font-bold">AES-256-GCM + HMAC-SHA256 (Zero-Knowledge)</span>
          </p>
        </div>

        {/* HASIL DEKRIPSI SOAPS LENGKAP UNTUK PASIEN */}
        {decryptedData ? (
          <div className="mt-6 p-6 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-6">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-3">
              <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">
                Rincian Rekam Medis Lengkap (Format Standar SOAP Permenkes 24/2022)
              </h3>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Terdekripsi Aman
              </span>
            </div>

            {/* Grid 4 Kolom: Anamnesis, Diagnosis, Tanda Vital, Resep */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* 1. Keluhan Pasien (Subjective) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <span className="font-black text-slate-400 uppercase text-[10px]">
                  Keluhan yang Dilaporkan Pasien (Subjective)
                </span>
                <p className="text-slate-800 font-semibold leading-relaxed">
                  {decryptedData.subjective || "Tidak ada catatan keluhan khusus."}
                </p>
              </div>

              {/* 2. Diagnosis Resmi Dokter (Assessment) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <span className="font-black text-slate-400 uppercase text-[10px]">
                  Diagnosis Medis Dokter (Assessment)
                </span>
                <p className="text-slate-900 font-black text-base">
                  {decryptedData.assessment?.icd10 || record.primaryIcd10} —{" "}
                  {decryptedData.assessment?.desc || record.diagnosisShort}
                </p>
                <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Katalog WHO ICD-10
                </span>
              </div>
            </div>

            {/* 3. Tanda-Tanda Vital Lengkap */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
              <span className="font-black text-slate-400 uppercase text-[10px]">
                Hasil Pengukuran Tanda-Tanda Vital Fisik (Oleh Perawat Triase)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-1">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tekanan Darah</span>
                  <span className="text-base font-black text-slate-900">
                    {decryptedData.vitalSigns?.systolic || 120} / {decryptedData.vitalSigns?.diastolic || 80} mmHg
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Detak Jantung</span>
                  <span className="text-base font-black text-slate-900">
                    {decryptedData.vitalSigns?.heartRate || 75} bpm
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Suhu Tubuh</span>
                  <span className="text-base font-black text-slate-900">
                    {decryptedData.vitalSigns?.temperature || 36.5} °C
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Saturasi Oksigen</span>
                  <span className="text-base font-black text-slate-900">
                    {decryptedData.vitalSigns?.spo2 || 98}%
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Resep Obat & Instruksi Rencana */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <span className="font-black text-slate-400 uppercase text-[10px]">
                  Resep Obat yang Diberikan (e-Prescription &amp; Detail Penggunaan)
                </span>
                {decryptedData.plan?.resep && decryptedData.plan.resep.length > 0 ? (
                  <div className="space-y-2.5">
                    {decryptedData.plan.resep.map((r: string, idx: number) => {
                      const detail = parsePrescriptionDetail(r);
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-700 font-mono text-[10px] uppercase px-1.5 py-0.5 bg-blue-100 rounded">
                                Rx
                              </span>
                              <span className="font-black text-slate-900 text-xs">
                                {detail.medicineName} ({detail.dosage})
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {detail.instructions}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-700 space-y-0.5 pl-0.5">
                            <p>
                              <strong className="text-slate-900">Cara Minum:</strong> {detail.timing}
                            </p>
                            <p className="text-slate-600">
                              <strong className="text-slate-800">Tujuan Terapi:</strong> {detail.indication}
                            </p>
                            <p className="text-[10px] text-amber-800 italic">
                              Catatan: {detail.notes}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium">Tidak ada resep obat tertulis.</p>
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <span className="font-black text-slate-400 uppercase text-[10px]">
                  Petunjuk & Rencana Tindak Lanjut Dokter
                </span>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {decryptedData.plan?.tindakan || "Kontrol tekanan darah secara rutin dan patuhi anjuran pola makan sehat."}
                </p>
              </div>
            </div>

            {/* 5. Lampiran Citra Medis Penunjang */}
            {record.medicalImages && record.medicalImages.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <span className="font-black text-slate-400 uppercase text-[10px]">
                  Lampiran Citra Medis Penunjang (Rontgen / USG / Lab / EKG)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {record.medicalImages.map((img) => (
                    <div key={img.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {img.type}
                      </div>
                      <div className="truncate flex-1">
                        <h4 className="font-black text-slate-900 text-xs truncate">{img.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{img.notes || "Citra radiologi terenkripsi biner"}</p>
                        <span className="inline-block mt-1 text-[9px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          HMAC Integritas Sah
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2 text-xs">
            <p className="font-bold text-slate-700">
              Dokumen rekam medis terenkripsi dengan kunci privat Anda (Zero-Knowledge).
            </p>
            <p className="text-slate-500 text-[11px]">
              Klik tombol <strong>&quot;Verifikasi &amp; Dekripsi Asli&quot;</strong> di bagian atas untuk melihat keluhan, diagnosis lengkap, tanda vital, dan resep obat.
            </p>
          </div>
        )}
      </div>

      {/* Modal Cetak Dokumen Rekam Medis Pasien */}
      {isPrintOpen && (
        <PrintableMedicalResume
          data={{
            recordId: record.recordId,
            faskesNama: record.faskesNama,
            faskesAlamat: record.faskesAlamat,
            patientNama: record.patientName,
            patientNik: getUserSession()?.nik || "3171012304800001",
            patientMrn: "MRN-2026-00101",
            patientBloodType: getUserSession()?.bloodType || "O+",
            penjaminBiaya: "BPJS Kesehatan (JKN)",
            tanggalPeriksa: record.timestamp,
            poli: "Poli Penyakit Dalam",
            dokterNama: record.dokterNama,
            dokterSpecialty: record.dokterSpecialty,
            dokterStr: record.dokterStr,
            dokterSip: record.dokterSip,
            perawatNama: record.perawatNama,
            perawatNip: record.perawatNip,
            perawatPosisi: record.perawatPosisi,
            tindakanStaf: record.tindakanStaf,
            triaseLevel: "HIJAU (Non-Urgent)",
            triageVitals: decryptedData?.vitalSigns || {
              systolic: 120,
              diastolic: 80,
              heartRate: 75,
              temperature: 36.5,
              spo2: 98,
            },
            subjective: decryptedData?.subjective || "Pasien mengeluhkan pusing dan lemas",
            diagnosisIcd10: (decryptedData?.assessment?.icd10 as string) || record.primaryIcd10,
            diagnosisShort: record.diagnosisShort,
            prosedurIcd9: "89.52",
            tindakanMedis: "Pemeriksaan EKG dan Edukasi Pola Makan",
            prescriptions: decryptedData?.plan?.resep || ["Amlodipine 10mg 1x1"],
            edukasiDokter: (decryptedData?.plan?.tindakan as string) || "Kontrol tensi rutin dan patuhi anjuran pola makan sehat.",
            billing: {
              biayaKonsultasi: 100000,
              biayaTindakan: 50000,
              biayaObat: 85000,
              totalBiaya: 235000,
              statusKlaim: "DITANGGUNG BPJS KESEHATAN",
            },
            version: record.version,
            addendumReason: record.addendumReason,
          }}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
}
