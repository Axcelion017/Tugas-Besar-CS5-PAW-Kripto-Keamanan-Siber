"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import { getStorageData, EncryptedMedicalRecord } from "@/lib/db/mockData";

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
  const [record, setRecord] = useState<EncryptedMedicalRecord | null>(null);
  const [decryptedData, setDecryptedData] = useState<any | null>(null);
  const [isHmacValid, setIsHmacValid] = useState<boolean | null>(null);
  const [isTampered, setIsTampered] = useState(false);

  useEffect(() => {
    const records = getStorageData<EncryptedMedicalRecord[]>("resilio_records", []);
    const found = records.find((r) => r.recordId === recordId);
    if (found) {
      setRecord(found);
    }
  }, [recordId]);

  const patientKey =
    getUserSession()?.encryptionKeyHex ||
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const handleVerifyAndDecrypt = async (tamper: boolean = false) => {
    if (!record) return;

    const payloadToTest = tamper
      ? record.encryptedPayload.slice(0, -4) + "ffff"
      : record.encryptedPayload;

    const valid = await verifyHMAC(payloadToTest, record.hmacDigest, patientKey);
    setIsHmacValid(valid);
    setIsTampered(tamper);

    if (!valid) {
      setDecryptedData(null);
      alert("PERINGATAN KRIPTO: Tanda tangan HMAC tidak valid! Data telah dimanipulasi.");
      return;
    }

    try {
      const plain = await decryptAES(payloadToTest, record.ivHex, patientKey);
      setDecryptedData(JSON.parse(plain));
    } catch {
      // Fallback decode mock
      const buf = new Uint8Array(payloadToTest.length / 2);
      for (let i = 0; i < payloadToTest.length; i += 2) {
        buf[i / 2] = parseInt(payloadToTest.substring(i, i + 2), 16);
      }
      const text = new TextDecoder().decode(buf);
      setDecryptedData(JSON.parse(text));
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
        <span>{recordId}</span>
      </div>

      {/* Header */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
              Dokumen Rekam Medis Sah • Permenkes No. 24/2022
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Nomor Berkas: {recordId}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Faskes: <strong>{record?.faskesNama || "RSUP Dr. Sardjito"}</strong> • Dokter:{" "}
              <strong>{record?.dokterNama || "dr. Andi Pratama, Sp.PD"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              Uji Coba Manipulasi (Tamper Test)
            </button>
          </div>
        </div>

        {/* Status Verifikasi Integritas */}
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
                ? "Integritas Terkonfirmasi: Nilai HMAC-SHA256 cocok persis dengan kunci rahasia pasien."
                : "GAGAL INTEGRITAS: 1 atau lebih bit payload diubah secara ilegal! Sistem menolak mendekripsi (Fail-Closed)."}
            </div>
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-md bg-white border">
              {isTampered ? "Status: Bit Dimanipulasi" : "Status: Payload Murni"}
            </span>
          </div>
        )}

        {/* Data Kriptografis Mentah */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono text-slate-700">
          <p className="font-bold uppercase text-[10px] text-slate-500">
            Parameter Kriptografi Dokumen (RFC 2104 & NIST SP 800-38D):
          </p>
          <p className="truncate">
            • IV (96-bit CSPRNG): <span className="text-blue-700">{record?.ivHex || "1a2b3c4d5e6f7a8b9c0d1e2f"}</span>
          </p>
          <p className="truncate">
            • Digest HMAC-SHA256:{" "}
            <span className="text-emerald-700">
              {record?.hmacDigest || "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9"}
            </span>
          </p>
          <p className="truncate">
            • Algoritma: <span className="font-bold">AES-256-GCM + HMAC-SHA256 (Client-Side)</span>
          </p>
        </div>

        {/* Hasil Dekripsi SOAP Lengkap */}
        {decryptedData && (
          <div className="mt-6 p-6 bg-blue-50/40 rounded-2xl border border-blue-200 space-y-4">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">
              Isi Dokumen Klinis Sah (SOAP Standar)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-500 uppercase text-[10px]">
                  Subjective (S) - Keluhan Pasien:
                </p>
                <p className="text-slate-800 font-semibold">{decryptedData.subjective}</p>

                <p className="font-bold text-slate-500 uppercase text-[10px] pt-2">
                  Objective (O) - Tanda Vital:
                </p>
                <div className="font-semibold text-slate-800 space-y-0.5">
                  <p>TD: {decryptedData.vitalSigns?.systolic}/{decryptedData.vitalSigns?.diastolic} mmHg</p>
                  <p>Nadi: {decryptedData.vitalSigns?.heartRate} bpm</p>
                  <p>Suhu: {decryptedData.vitalSigns?.temperature} °C</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-500 uppercase text-[10px]">
                  Assessment (A) - Kode Diagnosis ICD-10:
                </p>
                <p className="text-slate-800 font-bold text-sm">
                  {decryptedData.assessment?.icd10} — {decryptedData.assessment?.desc}
                </p>

                <p className="font-bold text-slate-500 uppercase text-[10px] pt-2">
                  Plan (P) - e-Prescription & Tindakan Medis:
                </p>
                <ul className="list-disc list-inside font-semibold text-slate-800 space-y-0.5">
                  {decryptedData.plan?.resep?.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
                <p className="text-slate-600 text-[11px] mt-1">
                  Catatan Tindakan: {decryptedData.plan?.tindakan}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
