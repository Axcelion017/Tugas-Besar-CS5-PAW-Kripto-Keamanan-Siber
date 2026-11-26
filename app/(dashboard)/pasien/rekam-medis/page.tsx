"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { getStorageData, EncryptedMedicalRecord } from "@/lib/db/mockData";
import { getMedicalRecordsServerAction } from "@/lib/actions/clinical";
import { createAuditLogServerAction } from "@/lib/actions/audit";
import {
  CanonicalSoapPayload,
  decryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import { parsePrescriptionDetail } from "@/features/medical-records/prescription-parser";

type DecryptedRecordPayload = CanonicalSoapPayload;

interface EnrichedMedicalRecord extends EncryptedMedicalRecord {
  dokterSip?: string;
  dokterSpecialty?: string;
  perawatNama?: string;
  perawatNip?: string;
  perawatPosisi?: string;
  tindakanStaf?: string;
}

export default function RekamMedisPasienPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [records, setRecords] = useState<EnrichedMedicalRecord[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedRecordPayload>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});
  const [decryptErrorMap, setDecryptErrorMap] = useState<Record<string, string>>({});
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

      // 2. Fallback offline hanya mengambil berkas milik sesi pasien saat ini (Anti-BOLA, tidak pernah membocorkan P-101)
      if (recordList.length === 0) {
        const stored = getStorageData<EnrichedMedicalRecord[]>("resilio_records", []);
        recordList = stored.filter((r) => r.patientId === s.id);
      }

      setRecords(recordList);
    }

    loadData();
  }, []);

  const patientKey = session?.encryptionKeyHex;

  const handleDecryptSingle = async (rec: EnrichedMedicalRecord) => {
    setDecryptErrorMap((prev) => {
      const next = { ...prev };
      delete next[rec.recordId];
      return next;
    });

    const result = await decryptMedicalRecordPayload(
      {
        encryptedPayload: rec.encryptedPayload,
        ivHex: rec.ivHex,
        hmacDigest: rec.hmacDigest,
      },
      patientKey,
      {
        patientId: rec.patientId,
        recordId: rec.recordId,
        version: rec.version,
      }
    );

    if (result.ok) {
      setHmacStatusMap((prev) => ({ ...prev, [rec.recordId]: true }));
      setDecryptedMap((prev) => ({ ...prev, [rec.recordId]: result.data }));
      return;
    }

    // Fail-Closed Murni: Blokir tampilan konten klinis, hapus data dekripsi, dan catat SIEM
    setHmacStatusMap((prev) => ({ ...prev, [rec.recordId]: false }));
    setDecryptedMap((prev) => {
      const next = { ...prev };
      delete next[rec.recordId];
      return next;
    });
    setDecryptErrorMap((prev) => ({ ...prev, [rec.recordId]: result.message }));

    await createAuditLogServerAction({
      action: "HMAC_MISMATCH",
      targetResource: `/api/rme/record/${rec.recordId}`,
      severity: "CRITICAL",
      detail: `Fail-Closed Triggered di Portal Pasien (${result.errorCode}): ${result.message}`,
    }).catch(() => {});
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
                  {decryptErrorMap[rec.recordId] && (
                    <div
                      role="alert"
                      className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1"
                    >
                      <p className="font-black uppercase tracking-wider text-red-700">
                        PROSEDUR FAIL-CLOSED — VERIFIKASI INTEGRITAS GAGAL
                      </p>
                      <p className="font-semibold">{decryptErrorMap[rec.recordId]}</p>
                      <p className="text-[11px] font-mono text-red-700">
                        Insiden HMAC_MISMATCH telah dicatat ke audit keamanan. Konten medis diblokir demi keselamatan pasien.
                      </p>
                    </div>
                  )}
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
