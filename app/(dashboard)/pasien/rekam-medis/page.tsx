"use client";

import { Breadcrumb } from "@/components/ui/Breadcrumb";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import type { EncryptedMedicalRecord } from "@/lib/db/mockData";
import { getMedicalRecordsServerAction } from "@/lib/actions/clinical";
import { createAuditLogServerAction } from "@/lib/actions/audit";
import {
  CanonicalSoapPayload,
  decryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import { parsePrescriptionDetail } from "@/features/medical-records/prescription-parser";
import {
  IconAlertTriangle,
  IconCheck,
  IconFileText,
  IconLock,
  IconSearch,
  IconStethoscope,
  IconUnlock,
  IconUsers,
} from "@/components/ui/Icons";

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
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedRecordPayload>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});
  const [decryptErrorMap, setDecryptErrorMap] = useState<Record<string, string>>({});
  const [isDecryptingAll, setIsDecryptingAll] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<"ALL" | "LOCKED" | "UNLOCKED" | "ADDENDUM">("ALL");

  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      const s = getUserSession();
      if (!s || !active) {
        if (active) setIsLoading(false);
        return;
      }
      setSession(s);

      let recordList: EnrichedMedicalRecord[] = [];
      try {
        const dbRes = await getMedicalRecordsServerAction({ patientId: s.id });
        if (dbRes.success && dbRes.data && dbRes.data.length > 0) {
          recordList = (
            dbRes.data as unknown as Array<{
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
            }>
          ).map((r) => ({
            recordId: r.id,
            patientId: r.patientId,
            patientName: r.patient?.name || s.name,
            faskesId: r.faskesId,
            faskesNama: r.faskes?.nama || "Fasilitas Kesehatan Terdaftar",
            dokterNama: r.doctor?.name || "Dokter Pemeriksa (DPJP)",
            dokterStr: r.doctor?.strNumber || "-",
            dokterSip: r.doctor?.sipNumber || "-",
            dokterSpecialty: r.doctor?.specialty || "Poliklinik Spesialis",
            perawatNama: r.appointment?.triageAssessment?.assessedBy?.name || "Perawat Triase",
            perawatNip: r.appointment?.triageAssessment?.assessedBy?.nip || "-",
            perawatPosisi: r.appointment?.triageAssessment?.assessedBy?.posisi || "Perawat Triase & Admisi",
            tindakanStaf:
              r.appointment?.triageAssessment?.catatanPerawat ||
              "Pengkajian tanda vital fisik & penapisan triase awal",
            primaryIcd10: r.primaryIcd10,
            diagnosisShort: r.diagnosisShort,
            encryptedPayload: r.encryptedPayload,
            ivHex: r.ivHex,
            hmacDigest: r.hmacDigest,
            timestamp:
              new Date(r.createdAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
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
        // Biarkan kosong secara jujur bila server tidak terjangkau (Fail-Closed & Anti-BOLA)
      }

      if (active) {
        setRecords(recordList);
        setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
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

  const decryptedCount = Object.keys(decryptedMap).length;
  const totalImages = useMemo(
    () => records.reduce((acc, r) => acc + (r.medicalImages?.length || 0), 0),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return records.filter((r) => {
      const isOpen = Boolean(decryptedMap[r.recordId]);
      if (viewFilter === "LOCKED" && isOpen) return false;
      if (viewFilter === "UNLOCKED" && !isOpen) return false;
      if (viewFilter === "ADDENDUM" && r.version <= 1) return false;
      if (!q) return true;
      return (
        r.diagnosisShort.toLowerCase().includes(q) ||
        r.dokterNama.toLowerCase().includes(q) ||
        r.faskesNama.toLowerCase().includes(q) ||
        r.primaryIcd10.toLowerCase().includes(q) ||
        r.recordId.toLowerCase().includes(q)
      );
    });
  }, [records, filterQuery, viewFilter, decryptedMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: "Portal Pasien", href: "/pasien" },
              { label: "Rekam Medis (RME)" },
            ]}
          />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Riwayat Rekam Medis Elektronik
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5 max-w-2xl">
            Seluruh catatan pemeriksaan SOAP, tanda vital, dan resep obat dienkripsi di sisi klien sesuai{" "}
            <strong>Permenkes No. 24/2022</strong> dan hanya dapat didekripsi dengan kunci privat Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDecryptAll}
          disabled={isDecryptingAll || records.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50 self-start"
        >
          <IconUnlock size={15} />
          <span>{isDecryptingAll ? "Mendekripsi Berkas..." : "Buka & Dekripsi Semua"}</span>
        </button>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Berkas RME</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{records.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dokumen permanen (immutable)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
            <IconFileText size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Terbuka di Layar</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {decryptedCount} <span className="text-sm font-bold text-slate-400">/ {records.length}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Lolos verifikasi HMAC-SHA256</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <IconUnlock size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lampiran Citra</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalImages}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Rontgen, USG, Lab, &amp; EKG terenkripsi</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
            <IconLock size={18} />
          </div>
        </div>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <IconSearch
            size={15}
            className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Cari diagnosis, kode ICD-10, dokter pemeriksa, atau faskes..."
            aria-label="Cari catatan rekam medis"
            className="w-full pl-10 pr-16 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-400 focus:outline-none"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-red-600 hover:underline font-bold px-1.5 py-0.5 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
          {(
            [
              { id: "ALL", label: "Semua" },
              { id: "LOCKED", label: "Terkunci" },
              { id: "UNLOCKED", label: "Terbuka" },
              { id: "ADDENDUM", label: "Addendum" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFilter === tab.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar Kartu RME */}
      <div className="space-y-5">
        {isLoading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs font-medium">
            Memuat berkas rekam medis terenkripsi dari PostgreSQL...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-1">
            <p className="text-sm font-bold text-slate-700">
              Tidak ada catatan rekam medis ditemukan
            </p>
            <p className="text-xs text-slate-500">
              Coba ubah kata kunci pencarian atau pilih filter &ldquo;Semua&rdquo;.
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const isDecrypted = Boolean(decryptedMap[rec.recordId]);
            const data = decryptedMap[rec.recordId];
            const hmacValid = hmacStatusMap[rec.recordId];

            return (
              <article
                key={rec.recordId}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Header Kartu */}
                <div className="p-5 sm:p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                        {rec.recordId}
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                        ICD-10: {rec.primaryIcd10}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          rec.version > 1
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        v{rec.version} {rec.version > 1 ? "Addendum" : "Dokumen Utama"}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{rec.timestamp}</span>
                    </div>

                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      {rec.diagnosisShort}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      {rec.faskesNama}
                      {rec.addendumReason && (
                        <span className="text-amber-800 ml-2">• Alasan: {rec.addendumReason}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {!isDecrypted ? (
                      <button
                        type="button"
                        onClick={() => handleDecryptSingle(rec)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <IconUnlock size={14} />
                        <span>Dekripsi Berkas</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                        <IconCheck size={14} />
                        <span>Terdekripsi</span>
                      </span>
                    )}

                    <Link
                      href={`/pasien/rekam-medis/${rec.recordId}`}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition text-center"
                    >
                      Detail &amp; Cetak A4 →
                    </Link>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  {/* Atribusi Tenaga Kesehatan — ringkas & bersih */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                        <IconStethoscope size={16} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                          Dokter Penanggung Jawab (DPJP)
                        </span>
                        <p className="text-sm font-black text-slate-900 truncate">{rec.dokterNama}</p>
                        <p className="text-xs font-semibold text-slate-600">{rec.dokterSpecialty}</p>
                        <p className="text-[11px] font-mono text-slate-500 pt-1">
                          STR: {rec.dokterStr} • SIP: {rec.dokterSip}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                        <IconUsers size={16} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                          Perawat Pelaksana Triase
                        </span>
                        <p className="text-sm font-black text-slate-900 truncate">{rec.perawatNama}</p>
                        <p className="text-xs font-semibold text-slate-600">{rec.perawatPosisi}</p>
                        <p className="text-[11px] text-slate-500 pt-1 line-clamp-1">
                          {rec.tindakanStaf}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Error Fail-Closed */}
                  {decryptErrorMap[rec.recordId] && (
                    <div
                      role="alert"
                      className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1"
                    >
                      <p className="font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                        <IconAlertTriangle size={14} />
                        <span>Prosedur Fail-Closed — Verifikasi Integritas Gagal</span>
                      </p>
                      <p className="font-semibold">{decryptErrorMap[rec.recordId]}</p>
                      <p className="text-[11px] font-mono text-red-700">
                        Insiden HMAC_MISMATCH telah dicatat ke audit keamanan. Konten medis diblokir.
                      </p>
                    </div>
                  )}

                  {/* Konten Terkunci vs Terdekripsi */}
                  {!isDecrypted ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                            <IconLock size={16} />
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">
                              Rekam Medis Terlindungi &amp; Asli
                            </span>
                            <p className="text-xs text-slate-600">
                              Catatan dokter, hasil pemeriksaan, dan resep obat Anda dijaga secara privat dan hanya dapat dibuka oleh Anda atau dokter berizin.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDecryptSingle(rec)}
                          className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition shrink-0"
                        >
                          Buka Rincian Medis →
                        </button>
                      </div>

                      <details className="pt-2.5 border-t border-slate-200 text-slate-600">
                        <summary className="cursor-pointer font-bold text-[11px] text-slate-700 hover:text-slate-900">
                          Lihat Bukti Kriptografi (Opsional — AES-256-GCM &amp; HMAC-SHA256)
                        </summary>
                        <div className="mt-2 p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] space-y-1 overflow-x-auto">
                          <p className="truncate">ID Berkas: {rec.recordId} (v{rec.version})</p>
                          <p className="truncate">IV 96-bit: {rec.ivHex}</p>
                          <p className="truncate">HMAC-SHA256: {rec.hmacDigest}</p>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Subjective & Assessment */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Keluhan Pasien (Subjective)
                          </span>
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            {data?.subjective || "Tidak ada catatan keluhan."}
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            Diagnosis Resmi (Assessment)
                          </span>
                          <p className="font-black text-slate-900 text-sm">
                            {data?.assessment?.icd10 || rec.primaryIcd10} —{" "}
                            {data?.assessment?.desc || rec.diagnosisShort}
                          </p>
                          <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Katalog WHO ICD-10
                          </span>
                        </div>
                      </div>

                      {/* Tanda Vital */}
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                          Tanda Vital Fisik (Objective)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Tekanan Darah
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {data?.vitalSigns?.systolic || 120}/{data?.vitalSigns?.diastolic || 80}{" "}
                              <span className="text-[11px] font-semibold text-slate-500">mmHg</span>
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Detak Jantung
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {data?.vitalSigns?.heartRate || 75}{" "}
                              <span className="text-[11px] font-semibold text-slate-500">bpm</span>
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Suhu Tubuh
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {data?.vitalSigns?.temperature || 36.5}{" "}
                              <span className="text-[11px] font-semibold text-slate-500">°C</span>
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Saturasi O2
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {data?.vitalSigns?.spo2 || 98}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Resep & Rencana Tindak Lanjut */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                            Resep Obat (e-Prescription)
                          </span>
                          {data?.plan?.resep && data.plan.resep.length > 0 ? (
                            <div className="space-y-2">
                              {data.plan.resep.map((r: string, idx: number) => {
                                const detail = parsePrescriptionDetail(r);
                                return (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-black text-slate-900 text-xs">
                                        {detail.medicineName} ({detail.dosage})
                                      </span>
                                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                                        {detail.instructions}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600">
                                      <strong className="text-slate-800">Cara Minum:</strong> {detail.timing} •{" "}
                                      {detail.indication}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-slate-500 font-medium">Tidak ada resep obat tertulis.</p>
                          )}
                        </div>

                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                            Anjuran &amp; Rencana Tindak Lanjut
                          </span>
                          <p className="font-semibold text-slate-800 leading-relaxed">
                            {data?.plan?.tindakan || "Kontrol rutin dan patuhi anjuran pola hidup sehat."}
                          </p>
                        </div>
                      </div>

                      {/* Lampiran Citra Medis */}
                      {rec.medicalImages && rec.medicalImages.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                            Lampiran Citra Medis Terenkripsi
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {rec.medicalImages.map((img) => (
                              <div
                                key={img.id}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                              >
                                <div className="px-2.5 py-2 bg-slate-900 text-white rounded-lg font-mono font-bold text-[10px] shrink-0">
                                  {img.type}
                                </div>
                                <div className="truncate flex-1">
                                  <p className="font-bold text-slate-900 text-xs truncate">{img.title}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {img.notes || "Citra penunjang terenkripsi"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status Integritas HMAC */}
                      <div className="px-4 py-3 bg-slate-50 rounded-xl flex items-center justify-between gap-3 text-xs border border-slate-200">
                        <span className="text-slate-600 font-medium">
                          Verifikasi Integritas Kriptografi (HMAC-SHA256)
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-2.5 py-1 rounded-lg ${
                            hmacValid !== false
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {hmacValid !== false ? (
                            <>
                              <IconCheck size={13} />
                              <span>Data Otentik &amp; Bebas Manipulasi</span>
                            </>
                          ) : (
                            <>
                              <IconAlertTriangle size={13} />
                              <span>Integritas Cacat</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
