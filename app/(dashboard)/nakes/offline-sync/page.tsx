"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import { verifyHMAC } from "@/lib/crypto/hmac";
import {
  MOCK_PATIENTS,
  getStorageData,
  setStorageData,
  EncryptedMedicalRecord,
  Patient,
} from "@/lib/db/mockData";

export default function OfflineSyncPage() {
  const [queue, setQueue] = useState<EncryptedMedicalRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const loadQueue = () => {
    const q = getStorageData<EncryptedMedicalRecord[]>("resilio_offline_queue", []);
    setQueue(q);
  };

  useEffect(() => {
    loadQueue();
    window.addEventListener("storage", loadQueue);
    return () => window.removeEventListener("storage", loadQueue);
  }, []);

  const handleSyncNow = async () => {
    if (queue.length === 0) {
      alert("Antrean offline kosong.");
      return;
    }

    setIsSyncing(true);
    const logs: string[] = [];
    const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
    const existingRecords = getStorageData<EncryptedMedicalRecord[]>("resilio_records", []);

    const remainingQueue: EncryptedMedicalRecord[] = [];
    const newSyncedRecords: EncryptedMedicalRecord[] = [...existingRecords];

    for (const item of queue) {
      const patient = allPatients.find((p) => p.id === item.patientId) || allPatients[0];
      const key = patient.encryptionKeyHex;

      // Verifikasi HMAC sebelum diterima server pusat (Integritas)
      const isValid = await verifyHMAC(item.encryptedPayload, item.hmacDigest, key);

      if (isValid) {
        newSyncedRecords.unshift({ ...item, isOfflineCreated: false });
        logs.push(`[SUKSES] Berkas ${item.recordId} (${item.patientName}) — HMAC valid & tersinkron.`);
      } else {
        remainingQueue.push(item);
        logs.push(`[GAGAL] Berkas ${item.recordId} — HMAC tidak valid! Ditolak oleh server pusat.`);
      }
    }

    setStorageData("resilio_records", newSyncedRecords);
    setStorageData("resilio_offline_queue", remainingQueue);
    setQueue(remainingQueue);
    setSyncLogs(logs);
    setIsSyncing(false);
    window.dispatchEvent(new Event("storage"));
  };

  const handleSimulateAddQueue = () => {
    const mockRecord: EncryptedMedicalRecord = {
      recordId: `REC-OFFLINE-${Date.now().toString().slice(-4)}`,
      patientId: "P-101",
      patientName: "Budi Santoso",
      faskesId: "FAS-01",
      faskesNama: "RSUP Dr. Sardjito",
      dokterStr: "31.1.1.100.2.22.123456",
      dokterNama: "dr. Andi Pratama, Sp.PD",
      primaryIcd10: "I10",
      diagnosisShort: "Hipertensi Esensial (Offline Batch)",
      encryptedPayload: "a1b2c3d4e5f60718293a4b5c6d7e8f90deadbeef12345678",
      ivHex: "123456789012345678901234",
      hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
      timestamp: new Date().toLocaleString("id-ID"),
      isOfflineCreated: true,
      version: 1,
    };

    const current = getStorageData<EncryptedMedicalRecord[]>("resilio_offline_queue", []);
    setStorageData("resilio_offline_queue", [mockRecord, ...current]);
    loadQueue();
    window.dispatchEvent(new Event("storage"));
  };

  const handleClearQueue = () => {
    setStorageData("resilio_offline_queue", []);
    setQueue([]);
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <span>Ketahanan Offline PWA (UR-T05 & UR-T06)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pengelolaan Antrean Sinkronisasi Offline (IndexedDB Engine)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Mekanisme pertahanan terhadap serangan <strong>Ransomware</strong> dan <strong>Downtime</strong> server pusat. Seluruh catatan medis dienkripsi dan disimpan di peramban lokal hingga koneksi dipulihkan.
        </p>
      </div>

      {/* Kontrol & Statistik Antrean */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">
              Antrean Berkas Medis Lokal (IndexedDB)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{queue.length}</span>
              <span className="text-xs font-bold text-slate-500">Berkas Menunggu Sinkron</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || queue.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:bg-slate-300"
            >
              {isSyncing ? "Menyinkronkan..." : "Sinkronkan ke Server Pusat"}
            </button>
            <button
              onClick={handleSimulateAddQueue}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase transition cursor-pointer"
            >
              Simulasi Tambah Antrean
            </button>
            {queue.length > 0 && (
              <button
                onClick={handleClearQueue}
                className="px-3 py-2.5 text-xs text-red-600 font-bold hover:underline cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Log Hasil Sinkronisasi */}
        {syncLogs.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs font-mono">
            <p className="font-bold text-slate-700 font-sans">Hasil Validasi Protokol Sinkron:</p>
            {syncLogs.map((l, i) => (
              <p
                key={i}
                className={l.includes("SUKSES") ? "text-emerald-700" : "text-red-700 font-bold"}
              >
                {l}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tabel Antrean */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">
            Daftar Berkas Terenkripsi dalam Antrean Lokal
          </h3>
          <span className="text-xs text-slate-500 font-semibold">
            Status: Enkripsi Klien Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">ID Berkas</th>
                <th className="p-4">Pasien</th>
                <th className="p-4">Diagnosis (ICD-10)</th>
                <th className="p-4">Digest HMAC</th>
                <th className="p-4">Waktu Dibuat Offline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans text-xs">
                    Semua berkas telah tersinkronisasi penuh dengan server pusat.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.recordId} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-900">{item.recordId}</td>
                    <td className="p-4 font-sans font-bold text-slate-800">{item.patientName}</td>
                    <td className="p-4 font-sans text-slate-600">
                      {item.diagnosisShort} ({item.primaryIcd10})
                    </td>
                    <td className="p-4 text-emerald-700 truncate max-w-xs">{item.hmacDigest.slice(0, 20)}...</td>
                    <td className="p-4 text-slate-500">{item.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
