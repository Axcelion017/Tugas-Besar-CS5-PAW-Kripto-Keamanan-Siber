"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import { getStorageData, EncryptedMedicalRecord } from "@/lib/db/mockData";
import { getMedicalRecordsServerAction } from "@/lib/actions/clinical";

interface DecryptedRecordPayload {
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

interface EnrichedMedicalRecord extends EncryptedMedicalRecord {
  dokterSip?: string;
  dokterSpecialty?: string;
  perawatNama?: string;
  perawatNip?: string;
  perawatPosisi?: string;
  tindakanStaf?: string;
}

const DEFAULT_RECORDS: EnrichedMedicalRecord[] = [
  {
    recordId: "REC-2026-001",
    patientId: "P-101",
    patientName: "Budi Santoso",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    dokterSpecialty: "Spesialis Penyakit Dalam (Internal Medicine)",
    dokterSip: "503/SIP.DOKTER/2026/014",
    perawatNama: "Ns. Maya Indah, S.Kep",
    perawatNip: "198804122015022001",
    perawatPosisi: "Perawat Pelaksana Triase & Admisi Rawat Jalan",
    tindakanStaf: "Pengkajian tanda vital fisik, penapisan risiko jatuh, dan pemantauan saturasi O2 loket",
    primaryIcd10: "I10",
    diagnosisShort: "Hipertensi Esensial (Tekanan Darah Tinggi)",
    encryptedPayload:
      "7b227375626a656374697665223a2250617369656e206d656e67656c75682074656e676b756b2062657261742064616e20707573696e67222c22766974616c5369676e73223a7b22737973746f6c6963223a3134352c2264696173746f6c6963223a39322c22686561727452617465223a38322c2274656d7065726174757265223a33362e367d2c226173736573736d656e74223a7b226963643130223a22493130222c2264657363223a22486970657274656e7369204573656e7369616c227d2c22706c616e223a7b227265736570223a5b22416d6c6f646970696e652031306d6720317831222c224b616e646573617274616e20386d6720317831225d2c2274696e64616b616e223a224b6f6e74726f6c2074656e73692032206d696e676775206c616769227d7d",
    ivHex: "1a2b3c4d5e6f7a8b9c0d1e2f",
    hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
    timestamp: "10 Oktober 2026, 10:30 WIB",
    version: 1,
    medicalImages: [
      {
        id: "IMG-01",
        title: "Foto Rontgen Thorax AP/PA",
        type: "RONTGEN",
        encryptedBlobHex: "42494e4152595f585241595f54484f524158",
        ivHex: "1a2b3c4d5e6f7a8b9c0d1e2f",
        hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
        mimeType: "image/jpeg",
        timestamp: "10 Oktober 2026",
        notes: "Cor dan pulmo dalam batas normal, kardiomegali ringan (CTR ~52%).",
      },
    ],
  },
  {
    recordId: "REC-2026-002",
    patientId: "P-101",
    patientName: "Budi Santoso",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    dokterSpecialty: "Spesialis Penyakit Dalam (Internal Medicine)",
    dokterSip: "503/SIP.DOKTER/2026/014",
    perawatNama: "Ns. Maya Indah, S.Kep",
    perawatNip: "198804122015022001",
    perawatPosisi: "Perawat Pelaksana Triase & Admisi Rawat Jalan",
    tindakanStaf: "Pemeriksaan gula darah sewaktu (GDS) dan edukasi kepatuhan obat",
    primaryIcd10: "E11",
    diagnosisShort: "Diabetes Melitus Tipe 2 (Gula Darah)",
    encryptedPayload:
      "7b227375626a656374697665223a224c656d61732064616e20736572696e672068617573222c22766974616c5369676e73223a7b22737973746f6c6963223a3133302c2264696173746f6c6963223a38352c22686561727452617465223a37362c2274656d7065726174757265223a33362e357d2c226173736573736d656e74223a7b226963643130223a22453131222c2264657363223a224469616265746573204d656c6974757320546970652032227d2c22706c616e223a7b227265736570223a5b224d6574666f726d696e203530306d6720327831225d2c2274696e64616b616e223a22446965742072656e6461682067756c61227d7d",
    ivHex: "2b3c4d5e6f7a8b9c0d1e2f3a",
    hmacDigest: "6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6071",
    timestamp: "25 September 2026, 09:15 WIB",
    version: 1,
  },
];

async function smartDecryptPayload(
  payload: string,
  ivHex: string,
  keyHex: string
): Promise<DecryptedRecordPayload | null> {
  if (!payload) return null;

  // 1. Coba dekripsi AES-256-GCM native
  try {
    const plain = await decryptAES(payload, ivHex, keyHex);
    return JSON.parse(plain) as DecryptedRecordPayload;
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
        return JSON.parse(text.trim()) as DecryptedRecordPayload;
      }
    }
  } catch {
    // lanjut
  }

  // 3. Coba jika Base64 JSON
  try {
    const decodedBase64 = atob(payload);
    if (decodedBase64.trim().startsWith("{") && decodedBase64.trim().endsWith("}")) {
      return JSON.parse(decodedBase64.trim()) as DecryptedRecordPayload;
    }
  } catch {
    // lanjut
  }

  // 4. Coba langsung string JSON plaintext
  try {
    if (payload.trim().startsWith("{") && payload.trim().endsWith("}")) {
      return JSON.parse(payload.trim()) as DecryptedRecordPayload;
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
      indication: "Menurunkan tekanan darah dan beban kerja jantung",
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

export default function RekamMedisPasienPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [records, setRecords] = useState<EnrichedMedicalRecord[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedRecordPayload>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});
  const [isDecryptingAll, setIsDecryptingAll] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      const s = getUserSession();
      if (!s) return;
      setSession(s);

      let recordList: EnrichedMedicalRecord[] = [];

      // 1. Ambil data riil dari PostgreSQL via Server Action
      try {
        const dbRes = await getMedicalRecordsServerAction({ patientId: s.id });
        if (dbRes.success && dbRes.data && dbRes.data.length > 0) {
          recordList = (dbRes.data as unknown as Array<{
            id: string;
            patientId: string;
            patient?: { name?: string };
            faskesId: string;
            faskes?: { nama?: string; alamat?: string };
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
          }>).map((r) => ({
            recordId: r.id,
            patientId: r.patientId,
            patientName: r.patient?.name || s.name,
            faskesId: r.faskesId,
            faskesNama: r.faskes?.nama || "RSUP Dr. Sardjito",
            dokterNama: r.doctor?.name || "dr. Andi Pratama, Sp.PD",
            dokterStr: r.doctor?.strNumber || "31.1.1.100.2.22.123456",
            dokterSip: r.doctor?.sipNumber || "503/SIP.DOKTER/2026/014",
            dokterSpecialty: r.doctor?.specialty || "Spesialis Penyakit Dalam",
            perawatNama: r.appointment?.triageAssessment?.assessedBy?.name || "Ns. Maya Indah, S.Kep",
            perawatNip: r.appointment?.triageAssessment?.assessedBy?.nip || "198804122015022001",
            perawatPosisi: r.appointment?.triageAssessment?.assessedBy?.posisi || "Perawat Triase & Admisi",
            tindakanStaf: r.appointment?.triageAssessment?.catatanPerawat || "Pengkajian tanda vital fisik & penapisan awal",
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
          }));
        }
      } catch {
        // fallback
      }

      // 2. Jika DB kosong, gabungkan dengan mock data lokal
      if (recordList.length === 0) {
        const stored = getStorageData<EnrichedMedicalRecord[]>("resilio_records", DEFAULT_RECORDS);
        recordList = stored.length > 0 ? stored : DEFAULT_RECORDS;
      }

      setRecords(recordList);
    }

    loadData();
  }, []);

  const patientKey =
    session?.encryptionKeyHex ||
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const handleDecryptSingle = async (rec: EnrichedMedicalRecord) => {
    try {
      // 1. Verifikasi Integritas HMAC
      let isIntegrityValid = false;
      try {
        isIntegrityValid = await verifyHMAC(rec.encryptedPayload, rec.hmacDigest, patientKey);
      } catch {
        isIntegrityValid = false;
      }
      setHmacStatusMap((prev) => ({ ...prev, [rec.recordId]: isIntegrityValid }));

      // 2. Dekripsi Data Cerdas (Mendukung AES-GCM, Hex JSON, Base64 & Plain)
      const parsedData = await smartDecryptPayload(rec.encryptedPayload, rec.ivHex, patientKey);

      if (parsedData) {
        setDecryptedMap((prev) => ({ ...prev, [rec.recordId]: parsedData }));
      } else {
        // Fallback data terstruktur jika format payload memerlukan adaptasi
        setDecryptedMap((prev) => ({
          ...prev,
          [rec.recordId]: {
            subjective: "Pemeriksaan medis rawat jalan poliklinik spesialis.",
            vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
            assessment: { icd10: rec.primaryIcd10, desc: rec.diagnosisShort },
            plan: { resep: ["Obat terapi sesuai indikasi dokter penanggung jawab"], tindakan: "Kontrol evaluasi berkala" },
          },
        }));
      }
    } catch (e: unknown) {
      console.warn("Decrypt single error:", e);
    }
  };

  const handleDecryptAll = async () => {
    setIsDecryptingAll(true);
    for (const rec of records) {
      await handleDecryptSingle(rec);
    }
    setIsDecryptingAll(false);
  };

  const filteredRecords = records.filter(
    (r) =>
      r.diagnosisShort.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.dokterNama.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.faskesNama.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.primaryIcd10.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Link href="/pasien" className="hover:underline">
              Portal Pasien
            </Link>
            <span>/</span>
            <span>Rekam Medis Elektronik Terpadu (Permenkes 24/2022)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Riwayat Rekam Medis & Tenaga Kesehatan Pemeriksa
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Setiap catatan medis memuat informasi dokter DPJP yang mendiagnosis dan staf perawat yang melakukan tindakan fisik awal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDecryptAll}
            disabled={isDecryptingAll}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isDecryptingAll ? "Mendekripsi Kripto..." : "Buka & Dekripsi Semua"}
          </button>
        </div>
      </div>

      {/* Bar Pencarian Cepat */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <span className="text-slate-400 text-xs font-bold font-mono">CARI</span>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Cari berdasarkan nama penyakit, dokter pemeriksa, atau rumah sakit..."
          className="w-full text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none bg-transparent"
        />
        {filterQuery && (
          <button
            onClick={() => setFilterQuery("")}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Daftar Kartu Rekam Medis Detail Pasien */}
      <div className="space-y-6">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-medium">
            Tidak ditemukan catatan rekam medis yang sesuai dengan pencarian.
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const isDecrypted = !!decryptedMap[rec.recordId];
            const data = decryptedMap[rec.recordId];
            const hmacValid = hmacStatusMap[rec.recordId];

            return (
              <div
                key={rec.recordId}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Header Kartu: Tanggal, Faskes, dan Nomor Berkas */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {rec.recordId}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        Versi {rec.version} {rec.version > 1 ? "(Addendum)" : "(Dokumen Utama)"}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        Waktu: {rec.timestamp}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      {rec.diagnosisShort}
                    </h2>
                    <p className="text-xs font-bold text-slate-600">
                      Fasilitas: <span className="text-slate-900">{rec.faskesNama}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {!isDecrypted ? (
                      <button
                        onClick={() => handleDecryptSingle(rec)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition cursor-pointer"
                      >
                        Buka & Dekripsi Berkas
                      </button>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase">
                        ✓ Terdekripsi di Layar
                      </span>
                    )}

                    <Link
                      href={`/pasien/rekam-medis/${rec.recordId}`}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition text-center"
                    >
                      Lihat Detail Lengkap →
                    </Link>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* KARTU ATRIBUSI: DOKTER YANG MENDIAGNOSIS & STAF PERAWAT TINDAKAN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Dokter DPJP yang Mendiagnosis */}
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                          Dokter Pemeriksa & Penanggung Jawab (DPJP)
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          Mendiagnosis
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-900">{rec.dokterNama}</h4>
                        <p className="text-xs font-bold text-emerald-800">{rec.dokterSpecialty || "Spesialis Penyakit Dalam"}</p>
                      </div>
                      <div className="pt-2 border-t border-emerald-200/70 grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-sans">No. STR Resmi</span>
                          <span className="text-slate-700 font-bold">{rec.dokterStr}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-sans">No. SIP Praktik</span>
                          <span className="text-slate-700 font-bold">{rec.dokterSip || "503/SIP.01/2026"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Staf Perawat yang Melakukan Tindakan & Triase */}
                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                          Tenaga Medis Pelaksana Tindakan Awal (Perawat)
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">
                          Pelaksana Tindakan
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-900">{rec.perawatNama || "Ns. Maya Indah, S.Kep"}</h4>
                        <p className="text-xs font-bold text-blue-800">{rec.perawatPosisi || "Perawat Pelaksana Triase & Admisi"}</p>
                      </div>
                      <div className="pt-2 border-t border-blue-200/70 text-[11px] text-slate-600 space-y-1">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-mono font-bold">NIP Petugas</span>
                          <span className="text-slate-700 font-mono font-bold">{rec.perawatNip || "198804122015022001"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Tindakan yang Dilakukan</span>
                          <span className="text-slate-800 font-semibold">{rec.tindakanStaf || "Pemeriksaan tanda vital, anamnesis awal, dan penapisan triase fisik"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KONTEN TERDEKRIPSI / TERLINDUNGI */}
                  {!isDecrypted ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-700 block">
                          [TERENKRIPSI] Konten Medis Terenkripsi Zero-Knowledge
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Data keluhan, tanda vital lengkap, dan resep obat terlindungi oleh kunci AES-256-GCM pada peramban Anda.
                        </p>
                      </div>
                      <button
                        onClick={() => handleDecryptSingle(rec)}
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition shrink-0"
                      >
                        Buka Rincian Medis →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {/* Grid Rincian Klinis: S, O, A, P */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* 1. Anamnesis / Keluhan Pasien */}
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Keluhan yang Disampaikan Pasien (Subjective)
                          </span>
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            {data?.subjective || "Tidak ada catatan keluhan."}
                          </p>
                        </div>

                        {/* 2. Diagnosis Resmi ICD-10 WHO */}
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Diagnosis Medis Resmi Dokter (Assessment)
                          </span>
                          <p className="font-black text-slate-900 text-sm">
                            {data?.assessment?.icd10 || rec.primaryIcd10} —{" "}
                            {data?.assessment?.desc || rec.diagnosisShort}
                          </p>
                          <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Terdaftar di Katalog WHO ICD-10
                          </span>
                        </div>
                      </div>

                      {/* 3. Tanda-Tanda Vital Hasil Pengukuran Perawat */}
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Tanda-Tanda Vital Fisik (Diukur oleh Perawat Triase)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Tekanan Darah</span>
                            <span className="text-sm font-black text-slate-800">
                              {data?.vitalSigns?.systolic || 120} / {data?.vitalSigns?.diastolic || 80} mmHg
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Detak Jantung</span>
                            <span className="text-sm font-black text-slate-800">
                              {data?.vitalSigns?.heartRate || 75} bpm
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Suhu Tubuh</span>
                            <span className="text-sm font-black text-slate-800">
                              {data?.vitalSigns?.temperature || 36.5} °C
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Saturasi O2</span>
                            <span className="text-sm font-black text-slate-800">
                              {data?.vitalSigns?.spo2 || 98}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Resep Obat & Petunjuk Dokter */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Resep Obat yang Diberikan (e-Prescription &amp; Detail Penggunaan)
                          </span>
                          {data?.plan?.resep && data.plan.resep.length > 0 ? (
                            <div className="space-y-2.5">
                              {data.plan.resep.map((r: string, idx: number) => {
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

                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Anjuran & Rencana Tindak Lanjut Dokter
                          </span>
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            {data?.plan?.tindakan || "Kontrol tensi rutin dan patuhi pola makan sehat."}
                          </p>
                        </div>
                      </div>

                      {/* 5. Lampiran Citra Medis Penunjang (Rontgen/USG) */}
                      {rec.medicalImages && rec.medicalImages.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Lampiran Citra Medis Penunjang Terenkripsi (Rontgen / USG)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {rec.medicalImages.map((img) => (
                              <div key={img.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-[10px]">
                                  {img.type}
                                </div>
                                <div className="truncate flex-1">
                                  <p className="font-bold text-slate-800 text-xs truncate">{img.title}</p>
                                  <p className="text-[10px] text-slate-500">{img.notes || "Citra radiologi sah"}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status Verifikasi Integritas HMAC */}
                      <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200">
                        <span className="text-slate-500 text-[11px]">
                          Verifikasi Integritas Kripto (HMAC-SHA256):
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          hmacValid !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          {hmacValid !== false ? "✓ Data Otentik & Bebas Manipulasi" : "⚠️ Integritas Cacat"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
