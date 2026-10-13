"use client";

import React, { useState, useEffect } from "react";
import { UserSession } from "@/lib/auth/auth";

// Daftar Pasien Default
const DEFAULT_PATIENTS = [
  { id: "P-101", name: "Budi Santoso", room: "Mawar 01", assignedDoctorId: "DOC-01", encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90" },
  { id: "P-102", name: "Siti Rahmawati", room: "Melati 04", assignedDoctorId: "DOC-02", encryptionKeyHex: "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1" },
  { id: "P-103", name: "Ahmad Dahlan", room: "Anggrek 02", assignedDoctorId: "DOC-01", encryptionKeyHex: "c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2" }
];

// Daftar Dokter Lengkap yang Dapat Dipilih Admin
const DAFTAR_DOKTER = [
  { id: "DOC-01", name: "dr. Andi Pratama, Sp.PD", specialization: "Spesialis Penyakit Dalam" },
  { id: "DOC-02", name: "dr. Ratna Juwita, Sp.JP", specialization: "Spesialis Kardiologi" },
  { id: "DOC-03", name: "dr. Maya Safitri, Sp.A", specialization: "Spesialis Anak" }
];

interface AdminViewProps {
  session: UserSession;
  onLogoutClick: () => void;
}

export default function AdminView({ session, onLogoutClick }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<"penugasan" | "audit" | "pengujian">("penugasan");
  const [patients, setPatients] = useState<any[]>(DEFAULT_PATIENTS);
  const [records, setRecords] = useState<any[]>([]);
  
  // State untuk form penugasan cepat di atas
  const [targetPatientId, setTargetPatientId] = useState<string>("P-101");
  const [targetDoctorId, setTargetDoctorId] = useState<string>("DOC-01");
  const [notifSukses, setNotifSukses] = useState<string>("");

  const [auditLog, setAuditLog] = useState<string[]>([
    "Sistem Zero-Trust API Gateway diinisialisasi.",
    "Kebijakan Need-to-Know: Akses teks diagnosa dibatasi hanya untuk Tim Medis terkait."
  ]);

  // Muat data pasien & rekam medis
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPatients = localStorage.getItem("resilio_patients");
      if (storedPatients) {
        try {
          setPatients(JSON.parse(storedPatients));
        } catch {
          setPatients(DEFAULT_PATIENTS);
        }
      } else {
        localStorage.setItem("resilio_patients", JSON.stringify(DEFAULT_PATIENTS));
        setPatients(DEFAULT_PATIENTS);
      }

      const storedRecords = localStorage.getItem("resilio_records");
      if (storedRecords) {
        try {
          setRecords(JSON.parse(storedRecords));
        } catch {
          setRecords([]);
        }
      }
    }
  }, []);

  // FUNGSI UTAMA: PENUGASAN DOKTER KE PASIEN
  const handleAssignDoctor = (patientId: string, doctorId: string) => {
    const updated = patients.map((p) => (p.id === patientId ? { ...p, assignedDoctorId: doctorId } : p));
    setPatients(updated);

    // Simpan ke localStorage agar sesi Dokter langsung mendapatkan izin baru
    if (typeof window !== "undefined") {
      localStorage.setItem("resilio_patients", JSON.stringify(updated));
    }

    const doc = DAFTAR_DOKTER.find((d) => d.id === doctorId);
    const pat = patients.find((p) => p.id === patientId);
    
    const pesanNotif = `Berhasil! ${doc?.name || doctorId} kini resmi ditugaskan untuk menangani pasien ${pat?.name || patientId}.`;
    setNotifSukses(pesanNotif);
    setTimeout(() => setNotifSukses(""), 4000);

    const newEntry = `[${new Date().toLocaleTimeString()}] ADMIN ASSIGN: Dokter ${doc?.name || doctorId} ditugaskan ke Pasien ${pat?.name || patientId}`;
    setAuditLog((prev) => [newEntry, ...prev]);
  };

  const handleSimulasiSeranganHMAC = (recordId: string) => {
    const updated = records.map((r: any) => {
      if (r.recordId === recordId) {
        return { ...r, encryptedPayload: r.encryptedPayload + "MODIFIKASI_ILEGAL" };
      }
      return r;
    });
    setRecords(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("resilio_records", JSON.stringify(updated));
    }

    const newEntry = `[${new Date().toLocaleTimeString()}] SIMULASI: Manipulasi paksa pada Record ${recordId}. Verifikasi HMAC pada sesi pasien/dokter akan gagal!`;
    setAuditLog((prev) => [newEntry, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* TOP BAR PUTIH DENGAN PROFIL ADMIN DI KANAN ATAS */}
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
              Pusat Kendali Admin
            </p>
          </div>
        </div>

        {/* KARTU PROFIL ADMIN DI KANAN ATAS */}
        <div className="flex items-center gap-3">
          <div className="p-2 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Administrator Terverifikasi
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight mt-0.5">
              {session.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-slate-500 font-semibold hidden md:inline">
                Otoritas Tata Kelola Akses
              </span>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase">
                ID: {session.id}
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
        {/* SIDEBAR ADMIN */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-2 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2">
            Menu Navigasi
          </p>

          <button
            onClick={() => setActiveTab("penugasan")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "penugasan"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Penugasan Dokter & Pasien</span>
            {activeTab === "penugasan" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "audit"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Log Akses & Audit Trail</span>
            {activeTab === "audit" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>

          <button
            onClick={() => setActiveTab("pengujian")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-between ${
              activeTab === "pengujian"
                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>Simulasi Uji Integritas HMAC</span>
            {activeTab === "pengujian" && <span className="w-2 h-2 rounded-full bg-white" />}
          </button>
        </aside>

        {/* ISI FITUR ADMIN */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl space-y-6">
          {activeTab === "penugasan" && (
            <>
              {/* NOTIFIKASI SUKSES SETELAH PENUGASAN */}
              {notifSukses && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold shadow-sm animate-fade-in flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-black">
                    ✓
                  </span>
                  <span>{notifSukses}</span>
                </div>
              )}

              {/* CARD 1: FORMULIR PENUGASAN DOKTER (SANGAT JELAS) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  Formulir Penugasan Dokter Penanggung Jawab
                </h3>
                <p className="text-xs text-slate-500 font-semibold mb-5">
                  Tentukan dokter yang berhak mengakses dan menginput rekam medis pasien sesuai protokol Zero-Trust
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {/* DROPDOWN 1: PILIH PASIEN */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      1. Pilih Pasien:
                    </label>
                    <select
                      value={targetPatientId}
                      onChange={(e) => setTargetPatientId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                    >
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id}) - Ruang {p.room}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DROPDOWN 2: PILIH DOKTER (TERDAPAT dr. Andi Pratama) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                      2. Pilih Dokter Penanggung Jawab:
                    </label>
                    <select
                      value={targetDoctorId}
                      onChange={(e) => setTargetDoctorId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                    >
                      {DAFTAR_DOKTER.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TOMBOL TETAPKAN PENUGASAN */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleAssignDoctor(targetPatientId, targetDoctorId)}
                      className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-red-600/20 transition-all text-center"
                    >
                      Tugaskan Dokter Sekarang
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 2: TABEL RINGKASAN STATUS PENUGASAN */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Daftar Pasien & Penugasan Langsung di Tabel
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    Anda juga dapat mengubah penugasan dokter langsung melalui dropdown di tabel
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase font-black">
                        <th className="py-3 px-4">ID Pasien</th>
                        <th className="py-3 px-4">Nama Pasien</th>
                        <th className="py-3 px-4">Ruang Rawat</th>
                        <th className="py-3 px-4">Dokter yang Ditugaskan (Dropdown)</th>
                        <th className="py-3 px-4">Status Otorisasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {patients.map((p: any) => {
                        const currentDoc = DAFTAR_DOKTER.find((d) => d.id === p.assignedDoctorId);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{p.id}</td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900">{p.name}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-600">{p.room}</td>
                            
                            {/* DROPDOWN LANGSUNG DI SETIAP BARIS TABEL */}
                            <td className="py-3.5 px-4">
                              <select
                                value={p.assignedDoctorId}
                                onChange={(e) => handleAssignDoctor(p.id, e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                              >
                                {DAFTAR_DOKTER.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({d.specialization})
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 inline-block">
                                Aktif: {currentDoc?.name.split(",")[0] || p.assignedDoctorId}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "audit" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Catatan Aktivitas Zero-Trust API Gateway
              </h3>
              <div className="space-y-2">
                {auditLog.map((log, index) => (
                  <div key={index} className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "pengujian" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">
                Pengujian Keamanan: Simulasi Manipulasi Data (BOLA / Tampering)
              </h3>
              {records.length === 0 ? (
                <p className="text-sm text-slate-500 font-semibold py-4">Belum ada rekam medis tersimpan.</p>
              ) : (
                records.map((r: any) => (
                  <div key={r.recordId} className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">{r.recordId}</span>
                      <p className="text-xs text-slate-500 font-semibold">Pasien: {r.patientId}</p>
                    </div>
                    <button
                      onClick={() => handleSimulasiSeranganHMAC(r.recordId)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all"
                    >
                      Simulasi Manipulasi Ciphertext
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* MOBILE NAV BOTTOM */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around items-center md:hidden z-40">
        <button onClick={() => setActiveTab("penugasan")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "penugasan" ? "text-red-600" : "text-slate-500"}`}>
          Penugasan
        </button>
        <button onClick={() => setActiveTab("audit")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "audit" ? "text-red-600" : "text-slate-500"}`}>
          Audit
        </button>
        <button onClick={() => setActiveTab("pengujian")} className={`py-1 px-3 text-xs font-extrabold ${activeTab === "pengujian" ? "text-red-600" : "text-slate-500"}`}>
          Uji HMAC
        </button>
        <button onClick={onLogoutClick} className="py-1 px-3 text-xs font-extrabold text-red-600">
          Keluar
        </button>
      </nav>
    </div>
  );
}