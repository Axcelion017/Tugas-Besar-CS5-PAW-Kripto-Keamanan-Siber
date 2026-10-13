"use client";

import React, { useState, useEffect } from "react";
import { decryptAES } from "@/lib/crypto/aes";
import { verifyHMAC } from "@/lib/crypto/hmac";
import * as mockDataModule from "@/lib/db/mockData";
import { UserSession } from "@/lib/auth/auth";

const MOCK_PATIENTS = (mockDataModule as any).MOCK_PATIENTS || [
  { id: "P-101", name: "Budi Santoso", room: "Mawar 01", assignedDoctorId: "DOC-01", encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90" }
];

const MOCK_DOCTORS = (mockDataModule as any).MOCK_DOCTORS || [
  { id: "DOC-01", name: "dr. Andi Pratama, Sp.PD", specialization: "Penyakit Dalam" },
  { id: "DOC-02", name: "dr. Ratna Juwita, Sp.JP", specialization: "Kardiologi" }
];

interface PasienViewProps {
  session: UserSession;
  onLogoutClick: () => void;
}

export default function PasienView({ session, onLogoutClick }: PasienViewProps) {
  const [activeTab, setActiveTab] = useState<"medis" | "otorisasi" | "integritas">("medis");
  const [records, setRecords] = useState<any[]>([]);
  const [decryptedRecordMap, setDecryptedRecordMap] = useState<Record<string, any>>({});
  const [verifikasiStatusMap, setVerifikasiStatusMap] = useState<Record<string, boolean>>({});

  const currentPatient = MOCK_PATIENTS.find((p: any) => p.id === session.id) || MOCK_PATIENTS[0];

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("resilio_records") : null;
    if (stored) {
      try {
        const all = JSON.parse(stored);
        setRecords(all.filter((r: any) => r.patientId === session.id));
      } catch {
        setRecords([]);
      }
    }
  }, [session.id]);

  const handleDekripsi = async (record: any) => {
    try {
      const isIntegrityValid = await verifyHMAC(
        record.encryptedPayload,
        record.hmacDigest,
        currentPatient.encryptionKeyHex
      );

      setVerifikasiStatusMap((prev) => ({
        ...prev,
        [record.recordId]: isIntegrityValid,
      }));

      if (!isIntegrityValid) {
        alert("Peringatan Keamanan: HMAC tidak cocok! Data rekam medis telah dimanipulasi.");
        return;
      }

      const plaintext = await decryptAES(
        record.encryptedPayload,
        record.ivHex,
        currentPatient.encryptionKeyHex
      );

      setDecryptedRecordMap((prev) => ({
        ...prev,
        [record.recordId]: JSON.parse(plaintext),
      }));
    } catch {
      alert("Gagal melakukan dekripsi. Kunci kriptografis tidak cocok.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* TOP BAR PUTIH DI ATAS DENGAN KARTU PASIEN DI KANAN ATAS */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-red-200">
            R
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              RESILIO-HEALTH
            </h1>
            <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-wider mt-0.5">
              Portal Pasien Mandiri
            </p>
          </div>
        </div>

        {/* KARTU PROFIL PASIEN DI KANAN ATAS */}
        <div className="flex items-center gap-3">
          <div className="p-2 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Pasien Terautentikasi
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight mt-0.5">
              {session.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-slate-500 font-semibold hidden md:inline">
                Ruang {currentPatient.room}
              </span>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase">
                No. RM: {session.id}
              </span>
            </div>
          </div>

          <button
            onClick={onLogoutClick}
            className="py-2.5 px-3.5 rounded-xl text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all shadow-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* SIDEBAR PASIEN */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-2 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2">
            Menu Navigasi
          </p>

          <button
            onClick={() => setActiveTab("medis")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "medis"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Rekam Medis Pribadi</span>
            {activeTab === "medis" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>

          <button
            onClick={() => setActiveTab("otorisasi")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "otorisasi"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Otorisasi Akses Dokter</span>
            {activeTab === "otorisasi" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>

          <button
            onClick={() => setActiveTab("integritas")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "integritas"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Pemeriksaan Integritas</span>
            {activeTab === "integritas" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>
        </aside>

        {/* ISI FITUR PASIEN */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl">
          {activeTab === "medis" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Catatan Medis Terenkripsi Anda
              </h3>

              {records.length === 0 ? (
                <p className="text-sm text-slate-500 font-semibold py-8 text-center">
                  Belum ada catatan rekam medis yang diterbitkan untuk akun Anda.
                </p>
              ) : (
                records.map((rec) => {
                  const isDecrypted = Boolean(decryptedRecordMap[rec.recordId]);
                  const data = decryptedRecordMap[rec.recordId];
                  const doc = MOCK_DOCTORS.find((d: any) => d.id === rec.doctorId);

                  return (
                    <div key={rec.recordId} className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <span className="font-mono text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            {rec.recordId}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold ml-3">
                            {new Date(rec.timestamp).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <span className="text-xs text-slate-700 font-bold">
                          Pemeriksa: {doc?.name || rec.doctorId}
                        </span>
                      </div>

                      {!isDecrypted ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <p className="text-xs font-mono text-slate-600 truncate max-w-md">
                            Terkunci Enkripsi AES-256-GCM ({rec.encryptedPayload.slice(0, 32)}...)
                          </p>
                          <button
                            onClick={() => handleDekripsi(rec)}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all"
                          >
                            Buka & Dekripsi Catatan
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-400 font-bold uppercase">Keluhan Pasien</p>
                              <p className="text-sm font-extrabold text-slate-900">{data.keluhan}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 font-bold uppercase">Diagnosa Medis</p>
                              <p className="text-sm font-extrabold text-red-700">{data.diagnosa}</p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs text-slate-400 font-bold uppercase">Resep & Obat</p>
                              <p className="text-sm font-semibold text-slate-800">{data.resep}</p>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 pt-3 flex gap-4 text-xs font-bold text-slate-600">
                            <span>Tekanan: {rec.vitals.sistolik}/{rec.vitals.diastolik} mmHg</span>
                            <span>Suhu: {rec.vitals.suhuTubuh} °C</span>
                            <span>Detak: {rec.vitals.detakJantung} BPM</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "otorisasi" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Daftar Dokter dengan Akses ke Rekam Medis Anda
              </h3>
              {MOCK_DOCTORS.map((doc: any) => {
                const isAssigned = doc.id === currentPatient.assignedDoctorId;
                return (
                  <div key={doc.id} className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div>
                      <p className="font-extrabold text-slate-900 text-sm">{doc.name}</p>
                      <p className="text-xs text-slate-500 font-semibold">{doc.specialization}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-black rounded-full uppercase ${isAssigned ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {isAssigned ? "Dokter Penanggung Jawab" : "Tidak Memiliki Hak"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "integritas" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Status Integritas HMAC-SHA256
              </h3>
              {records.map((r) => (
                <div key={r.recordId} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-slate-900">{r.recordId}</span>
                    <span className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${verifikasiStatusMap[r.recordId] ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {verifikasiStatusMap[r.recordId] ? "Asli & Valid" : "Belum Dicek"}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400 mt-2 truncate">Digest: {r.hmacDigest}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MOBILE NAV BOTTOM */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around items-center md:hidden z-40">
        <button onClick={() => setActiveTab("medis")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "medis" ? "text-red-600" : "text-slate-500"}`}>
          Medis
        </button>
        <button onClick={() => setActiveTab("otorisasi")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "otorisasi" ? "text-red-600" : "text-slate-500"}`}>
          Otorisasi
        </button>
        <button onClick={() => setActiveTab("integritas")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "integritas" ? "text-red-600" : "text-slate-500"}`}>
          Integritas
        </button>
        <button onClick={onLogoutClick} className="py-1 px-3 text-xs font-extrabold text-red-600">
          Keluar
        </button>
      </nav>
    </div>
  );
}