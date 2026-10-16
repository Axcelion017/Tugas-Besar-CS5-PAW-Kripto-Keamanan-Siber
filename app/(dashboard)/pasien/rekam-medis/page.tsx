"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import { getStorageData, EncryptedMedicalRecord } from "@/lib/db/mockData";

export default function RekamMedisPasienPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [records, setRecords] = useState<EncryptedMedicalRecord[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, any>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});
  const [isDecryptingAll, setIsDecryptingAll] = useState(false);

  const defaultRecords: EncryptedMedicalRecord[] = [
    {
      recordId: "REC-2026-001",
      patientId: "P-101",
      patientName: "Budi Santoso",
      faskesId: "FAS-01",
      faskesNama: "RSUP Dr. Sardjito",
      dokterStr: "31.1.1.100.2.22.123456",
      dokterNama: "dr. Andi Pratama, Sp.PD",
      primaryIcd10: "I10",
      diagnosisShort: "Hipertensi Esensial (Primer)",
      encryptedPayload:
        "7b227375626a656374697665223a2250617369656e206d656e67656c75682074656e676b756b2062657261742064616e20707573696e67222c22766974616c5369676e73223a7b22737973746f6c6963223a3134352c2264696173746f6c6963223a39322c22686561727452617465223a38322c2274656d7065726174757265223a33362e367d2c226173736573736d656e74223a7b226963643130223a22493130222c2264657363223a22486970657274656e7369204573656e7369616c227d2c22706c616e223a7b227265736570223a5b22416d6c6f646970696e652031306d6720317831222c224b616e646573617274616e20386d6720317831225d2c2274696e64616b616e223a224b6f6e74726f6c2074656e73692032206d696e676775206c616769227d7d",
      ivHex: "1a2b3c4d5e6f7a8b9c0d1e2f",
      hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
      timestamp: "10 Oktober 2026, 10:30 WIB",
      version: 1,
    },
    {
      recordId: "REC-2026-002",
      patientId: "P-101",
      patientName: "Budi Santoso",
      faskesId: "FAS-01",
      faskesNama: "RSUP Dr. Sardjito",
      dokterStr: "31.1.1.100.2.22.123456",
      dokterNama: "dr. Andi Pratama, Sp.PD",
      primaryIcd10: "E11",
      diagnosisShort: "Diabetes Melitus Tipe 2",
      encryptedPayload:
        "7b227375626a656374697665223a224c656d61732064616e20736572696e672068617573222c22766974616c5369676e73223a7b22737973746f6c6963223a3133302c2264696173746f6c6963223a38352c22686561727452617465223a37362c2274656d7065726174757265223a33362e357d2c226173736573736d656e74223a7b226963643130223a22453131222c2264657363223a224469616265746573204d656c6974757320546970652032227d2c22706c616e223a7b227265736570223a5b224d6574666f726d696e203530306d6720327831225d2c2274696e64616b616e223a22446965742072656e6461682067756c61227d7d",
      ivHex: "2b3c4d5e6f7a8b9c0d1e2f3a",
      hmacDigest: "6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6071",
      timestamp: "25 September 2026, 09:15 WIB",
      version: 1,
    },
  ];

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const stored = getStorageData<EncryptedMedicalRecord[]>("resilio_records", defaultRecords);
      const filtered = stored.filter((r) => r.patientId === s.id || r.patientId === "P-101");
      setRecords(filtered.length > 0 ? filtered : defaultRecords);
    }
  }, []);

  const patientKey =
    session?.encryptionKeyHex ||
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const handleDecryptSingle = async (rec: EncryptedMedicalRecord) => {
    try {
      // 1. Verifikasi Integritas HMAC
      const isIntegrityValid = await verifyHMAC(rec.encryptedPayload, rec.hmacDigest, patientKey);
      setHmacStatusMap((prev) => ({ ...prev, [rec.recordId]: isIntegrityValid }));

      // 2. Dekripsi Data
      // Cek apakah payload hex mentah atau enkripsi AES
      let parsedData: any = null;
      try {
        const decrypted = await decryptAES(rec.encryptedPayload, rec.ivHex, patientKey);
        parsedData = JSON.parse(decrypted);
      } catch {
        // Fallback jika berupa mock hex string sederhana
        const buf = new Uint8Array(rec.encryptedPayload.length / 2);
        for (let i = 0; i < rec.encryptedPayload.length; i += 2) {
          buf[i / 2] = parseInt(rec.encryptedPayload.substring(i, i + 2), 16);
        }
        const text = new TextDecoder().decode(buf);
        parsedData = JSON.parse(text);
      }

      setDecryptedMap((prev) => ({ ...prev, [rec.recordId]: parsedData }));
    } catch (e: any) {
      alert(`Gagal mendekripsi: ${e.message}`);
    }
  };

  const handleDecryptAll = async () => {
    setIsDecryptingAll(true);
    for (const rec of records) {
      await handleDecryptSingle(rec);
    }
    setIsDecryptingAll(false);
  };

  // Data Vital Signs untuk diagram visualisasi fluktuasi tensi
  const chartPoints = [
    { date: "15 Ags", sys: 150, dia: 95, hr: 88 },
    { date: "01 Sep", sys: 142, dia: 90, hr: 80 },
    { date: "15 Sep", sys: 138, dia: 88, hr: 78 },
    { date: "25 Sep", sys: 130, dia: 85, hr: 76 },
    { date: "10 Okt", sys: 145, dia: 92, hr: 82 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Link href="/pasien" className="hover:underline">
              Portal Pasien
            </Link>
            <span>/</span>
            <span>Rekam Medis Terenkripsi & Vital Signs (UR-P06)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Riwayat Rekam Medis Klinis (SOAP) & Fluktuasi Tanda Vital
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Data rekam medis disimpan secara <strong>Zero-Knowledge</strong> di server. Hanya Anda yang memiliki kunci privat untuk mendekripsi diagnosis dan resep di peramban ini.
          </p>
        </div>

        <button
          onClick={handleDecryptAll}
          disabled={isDecryptingAll}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
        >
          {isDecryptingAll ? "Mendekripsi Kripto..." : "Dekripsi Semua Berkas Medis"}
        </button>
      </div>

      {/* Visualisasi Grafik Tanda Vital (Tekanan Darah) */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Grafik Tren Fluktuasi Tekanan Darah (Sistolik / Diastolik)
            </h2>
            <p className="text-xs text-slate-500">
              Pemantauan berkala tanda vital pasien sepanjang riwayat pemeriksaan dokter.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-red-600">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
              Sistolik (mmHg)
            </span>
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              Diastolik (mmHg)
            </span>
          </div>
        </div>

        {/* Visualisasi Batang Adaptif */}
        <div className="pt-6 pb-2 grid grid-cols-5 gap-3 sm:gap-6 items-end h-48 border-b border-slate-200 px-4">
          {chartPoints.map((pt, i) => {
            const sysHeight = `${(pt.sys / 180) * 100}%`;
            const diaHeight = `${(pt.dia / 180) * 100}%`;

            return (
              <div key={i} className="flex flex-col items-center h-full justify-end gap-1">
                <span className="text-[10px] font-mono font-bold text-red-600 mb-1">
                  {pt.sys}
                </span>
                <div className="w-full flex items-end justify-center gap-1.5 h-32">
                  <div
                    style={{ height: sysHeight }}
                    className="w-1/2 bg-red-500 rounded-t-md transition-all duration-500 hover:bg-red-600"
                    title={`Sistolik: ${pt.sys} mmHg`}
                  />
                  <div
                    style={{ height: diaHeight }}
                    className="w-1/2 bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600"
                    title={`Diastolik: ${pt.dia} mmHg`}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600 mt-2">
                  {pt.date}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 text-center">
          Kategori: Tekanan darah sistolik terakhir 145 mmHg (Hipertensi Grade 1). Perlu pemantauan diet rendah garam.
        </p>
      </div>

      {/* Linimasa Rekam Medis Terenkripsi */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">
          Linimasa Dokumen Rekam Medis (SOAP)
        </h2>

        <div className="space-y-4">
          {records.map((rec) => {
            const isDecrypted = !!decryptedMap[rec.recordId];
            const data = decryptedMap[rec.recordId];
            const hmacValid = hmacStatusMap[rec.recordId];

            return (
              <div
                key={rec.recordId}
                className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {rec.recordId}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Versi {rec.version} (Immutable Addendum)
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-1">
                      {rec.faskesNama} — {rec.diagnosisShort} (ICD-10: {rec.primaryIcd10})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pemeriksa: <strong className="text-slate-700">{rec.dokterNama}</strong> • STR:{" "}
                      <span className="font-mono">{rec.dokterStr}</span> • {rec.timestamp}
                    </p>
                  </div>

                  <div>
                    {!isDecrypted ? (
                      <button
                        onClick={() => handleDecryptSingle(rec)}
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase rounded-xl transition cursor-pointer"
                      >
                        Dekripsi Medis
                      </button>
                    ) : (
                      <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Terdekripsi di Peramban
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Kriptografi & HMAC */}
                <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                  <div className="truncate max-w-xl text-slate-600">
                    <span className="font-bold text-slate-800">Payload Kripto (AES-256-GCM): </span>
                    <span className="text-[11px]">{rec.encryptedPayload.slice(0, 32)}...</span>
                  </div>
                  <div>
                    {hmacValid !== undefined && (
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          hmacValid
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {hmacValid ? "HMAC-SHA256 Utuh" : "HMAC Rusak (Tampered!)"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tampilan Data Terdekripsi (SOAP) */}
                {isDecrypted && data && (
                  <div className="mt-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* S & O */}
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-900 uppercase text-[10px]">
                            Subjective (S) - Keluhan Pasien:
                          </p>
                          <p className="text-slate-800 font-semibold mt-1">
                            {data.subjective || "Tidak ada catatan keluhan."}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-900 uppercase text-[10px]">
                            Objective (O) - Tanda Vital Fisik:
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-1 font-semibold text-slate-800">
                            <p>• Tekanan Darah: {data.vitalSigns?.systolic}/{data.vitalSigns?.diastolic} mmHg</p>
                            <p>• Detak Jantung: {data.vitalSigns?.heartRate} bpm</p>
                            <p>• Suhu Tubuh: {data.vitalSigns?.temperature} °C</p>
                          </div>
                        </div>
                      </div>

                      {/* A & P */}
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-900 uppercase text-[10px]">
                            Assessment (A) - Diagnosis ICD-10:
                          </p>
                          <p className="text-slate-800 font-semibold mt-1">
                            {data.assessment?.icd10 || rec.primaryIcd10} —{" "}
                            {data.assessment?.desc || rec.diagnosisShort}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-900 uppercase text-[10px]">
                            Plan (P) - e-Prescription & Tindakan:
                          </p>
                          <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-800 font-semibold">
                            {data.plan?.resep?.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                          {data.plan?.tindakan && (
                            <p className="text-[11px] text-slate-600 mt-1">
                              Anjuran: {data.plan.tindakan}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-blue-200 text-right">
                      <Link
                        href={`/pasien/rekam-medis/${rec.recordId}`}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Buka Tampilan Bukti Hukum & Addendum Lengkap →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
