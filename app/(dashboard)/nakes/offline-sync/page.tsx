"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  OfflineOutboxItem,
  clearOutbox,
  getOutboxItems,
  removeOutboxItem,
  saveToOutbox,
  OUTBOX_UPDATED_EVENT,
} from "@/lib/storage/indexedDb";
import { encryptMedicalRecordPayload } from "@/features/medical-records/crypto-service";
import { getPatientDetailForDoctorServerAction } from "@/lib/actions/clinical";
import { getUserSession } from "@/lib/auth/auth";

export default function OfflineSyncPage() {
  const [queue, setQueue] = useState<OfflineOutboxItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadQueue = useCallback(async () => {
    const items = await getOutboxItems();
    setQueue(items);
  }, []);

  const handleSyncNow = useCallback(async () => {
    const currentItems = await getOutboxItems();
    if (currentItems.length === 0) {
      setNotice({ type: "err", text: "Antrean IndexedDB kosong — tidak ada berkas yang perlu disinkronkan." });
      return;
    }

    setIsSyncing(true);
    setNotice(null);

    try {
      const response = await fetch("/api/sync/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: currentItems.map((item) => ({
            recordId: item.recordId,
            patientId: item.patientId,
            encounterId: item.encounterId || null,
            faskesId: item.faskesId || "FAS-01",
            primaryIcd10: item.primaryIcd10 || "I10",
            diagnosisShort: item.diagnosisShort || "Pemeriksaan Klinis Offline",
            encryptedPayload: item.encryptedPayload,
            ivHex: item.ivHex,
            hmacDigest: item.hmacDigest,
            version: item.version || 1,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok && !Array.isArray(data.results)) {
        setNotice({
          type: "err",
          text: data.message || `Sinkronisasi ditolak server (HTTP ${response.status}).`,
        });
        setSyncLogs([`[GAGAL HTTP ${response.status}] ${data.message || "Gagal menyinkronkan outbox."}`]);
        return;
      }

      const logs: string[] = [];
      for (const res of (data.results || []) as Array<{
        recordId: string;
        status: "SYNCED" | "ALREADY_EXISTS" | "REJECTED";
        reason?: string;
      }>) {
        if (res.status === "SYNCED" || res.status === "ALREADY_EXISTS") {
          await removeOutboxItem(res.recordId);
          logs.push(
            `[SUKSES] Berkas ${res.recordId} — ${
              res.status === "SYNCED"
                ? "Verifikasi HKDF+AEAD+HMAC lolos & tersimpan ke PostgreSQL."
                : res.reason || "Sudah tercatat di PostgreSQL."
            }`
          );
        } else {
          logs.push(`[DITOLAK] Berkas ${res.recordId} — ${res.reason || "Verifikasi HMAC gagal."}`);
        }
      }

      setSyncLogs(logs);
      await loadQueue();
      setNotice({
        type: data.rejectedCount > 0 ? "err" : "ok",
        text: `Sinkronisasi selesai: ${data.syncedCount || 0} berkas tersimpan ke PostgreSQL, ${
          data.rejectedCount || 0
        } ditolak.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Koneksi ke server pusat terputus";
      setNotice({
        type: "err",
        text: `Tidak dapat menghubungi /api/sync/outbox: ${msg}. Data tetap aman di IndexedDB lokal.`,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [loadQueue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadQueue();
    }, 0);

    const onOutboxChange = () => {
      void loadQueue();
    };
    const onAutoSync = () => {
      void handleSyncNow();
    };

    window.addEventListener(OUTBOX_UPDATED_EVENT, onOutboxChange);
    window.addEventListener("jagamedis-sync-requested", onAutoSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OUTBOX_UPDATED_EVENT, onOutboxChange);
      window.removeEventListener("jagamedis-sync-requested", onAutoSync);
    };
  }, [loadQueue, handleSyncNow]);

  const handleCreateEncryptedOfflineSample = async () => {
    setIsSimulating(true);
    setNotice(null);
    try {
      const session = getUserSession();
      if (!session?.id) {
        setNotice({
          type: "err",
          text: "Sesi dokter aktif tidak ditemukan. Silakan masuk ulang sebelum membuat antrean luring.",
        });
        return;
      }
      const detail = await getPatientDetailForDoctorServerAction("P-101");
      if (!detail.success || !detail.accessAllowed || !detail.patient?.encryptionKeyHex) {
        setNotice({
          type: "err",
          text: "Tidak dapat mengambil kunci enkripsi pasien P-101 dari sesi aktif (pastikan login sebagai Dokter DPJP berizin).",
        });
        return;
      }

      const recordId = `REC-OFF-${Date.now().toString().slice(-6)}`;
      const bundle = await encryptMedicalRecordPayload(
        {
          subjective: "Pemeriksaan rawat jalan luring saat jaringan faskes terputus (IndexedDB Outbox).",
          vitalSigns: { systolic: 132, diastolic: 84, heartRate: 78, temperature: 36.6, spo2: 98 },
          assessment: { icd10: "I10", desc: "Hipertensi Esensial Terkontrol (Offline PWA)" },
          plan: {
            resep: ["Amlodipine 10mg 1x1 pagi sesudah makan"],
            tindakan: "Kontrol tekanan darah ulang 14 hari",
          },
          meta: {
            dokterId: session.id,
            dokterNama: session.name || "Dokter DPJP",
            faskesNama: session.faskesName || "RSUP Dr. Sardjito",
            timestamp: new Date().toISOString(),
          },
        },
        detail.patient.encryptionKeyHex,
        { patientId: detail.patient.id, recordId, version: 1 }
      );

      await saveToOutbox({
        recordId,
        encounterId: "",
        patientId: detail.patient.id,
        patientName: detail.patient.name,
        faskesId: session?.faskesId || "FAS-01",
        faskesNama: session?.faskesName || "RSUP Dr. Sardjito",
        dokterNama: session?.name || "dr. Andi Pratama, Sp.PD",
        primaryIcd10: "I10",
        diagnosisShort: "Hipertensi Esensial Terkontrol (Offline PWA)",
        encryptedPayload: bundle.encryptedPayload,
        ivHex: bundle.ivHex,
        hmacDigest: bundle.hmacDigest,
        version: 1,
        clientCreatedAt: new Date().toISOString(),
        status: "PENDING_SYNC",
        retryCount: 0,
      });

      await loadQueue();
      setNotice({
        type: "ok",
        text: `Berkas ${recordId} dienkripsi nyata (HKDF + AES-256-GCM + AAD + HMAC) dan disimpan ke IndexedDB resilio_offline_db.`,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearQueue = async () => {
    await clearOutbox();
    setQueue([]);
    setNotice({ type: "ok", text: "Seluruh antrean IndexedDB lokal telah dikosongkan." });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <span>Ketahanan Offline PWA (UR-T05 & UR-T06)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pengelolaan Antrean Sinkronisasi Offline (IndexedDB & REST Sync)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Seluruh berkas luring disimpan terenkripsi AES-256-GCM + HMAC-SHA256 pada{" "}
          <code className="font-mono font-bold text-slate-700">IndexedDB (resilio_offline_db)</code>{" "}
          dan disinkronkan ke PostgreSQL melalui{" "}
          <code className="font-mono font-bold text-slate-700">POST /api/sync/outbox</code>.
        </p>
      </div>

      {notice && (
        <div
          role={notice.type === "err" ? "alert" : "status"}
          className={`p-4 rounded-2xl border text-xs font-bold ${
            notice.type === "err"
              ? "bg-red-50 border-red-300 text-red-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Kontrol & Statistik Antrean */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500">
              Antrean Berkas Medis Lokal (IndexedDB: offline_clinical_outbox)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{queue.length}</span>
              <span className="text-xs font-bold text-slate-500">Berkas Menunggu Sinkron</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={isSyncing || queue.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:bg-slate-300"
            >
              {isSyncing ? "Menyinkronkan ke PostgreSQL..." : "Sinkronkan ke Server Pusat"}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateEncryptedOfflineSample()}
              disabled={isSimulating}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase transition cursor-pointer disabled:opacity-50"
            >
              {isSimulating ? "Mengenkripsi..." : "+ Buat Berkas Offline Terenkripsi"}
            </button>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => void handleClearQueue()}
                className="px-3 py-2.5 text-xs text-red-600 font-bold hover:underline cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>
        </div>

        {syncLogs.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs font-mono">
            <p className="font-bold text-slate-700 font-sans">Hasil Validasi Protokol Sinkron:</p>
            {syncLogs.map((l, i) => (
              <p
                key={i}
                className={l.includes("[SUKSES]") ? "text-emerald-700" : "text-red-700 font-bold"}
              >
                {l}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tabel Antrean IndexedDB */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Daftar Berkas Terenkripsi dalam IndexedDB Lokal
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            Enkripsi AEAD + HKDF + HMAC Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">ID Berkas</th>
                <th className="p-4">Pasien</th>
                <th className="p-4">Diagnosis (ICD-10)</th>
                <th className="p-4">IV 96-Bit & Digest HMAC</th>
                <th className="p-4">Waktu Dibuat Offline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-sans text-xs">
                    Semua berkas telah tersinkronisasi penuh dengan PostgreSQL.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.recordId} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-900">{item.recordId}</td>
                    <td className="p-4 font-sans font-bold text-slate-800">
                      {item.patientName || item.patientId}
                    </td>
                    <td className="p-4 font-sans text-slate-600">
                      {item.diagnosisShort} ({item.primaryIcd10})
                    </td>
                    <td className="p-4 text-emerald-700">
                      <span className="block text-[10px] text-slate-500">IV: {item.ivHex}</span>
                      <span>HMAC: {item.hmacDigest.slice(0, 20)}...</span>
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(item.clientCreatedAt).toLocaleString("id-ID")}
                    </td>
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
