"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MOCK_DOCTORS, AuthorizedDoctor } from "../../lib/db/mockData";
import { getSession, clearSession, UserSession } from "../../lib/auth/auth";
import { LogoutModal } from "../../components/ui/LogoutModal";

interface PatientPersonalRecord {
  id: string;
  tanggal: string;
  dokterPemeriksa: string;
  diagnosisTerenkripsi: string;
  resepTerenkripsi: string;
  statusKripto: string;
}

export default function PatientPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [doctors, setDoctors] = useState<AuthorizedDoctor[]>(MOCK_DOCTORS);
  const [notification, setNotification] = useState<string | null>(null);

  // Rekam Medis Khusus Pasien Terkait
  const [personalRecords] = useState<PatientPersonalRecord[]>([
    {
      id: "REC-01",
      tanggal: "1 Oktober 2026",
      dokterPemeriksa: "dr. Hendra Sp.PD",
      diagnosisTerenkripsi: "ENC-GCM256: Hipertensi Grade 1 dan Dislipidemia",
      resepTerenkripsi: "ENC-GCM256: Amlodipine 5mg 1x1, Atorvastatin 20mg 0-0-1",
      statusKripto: "AES-256-GCM Terverifikasi",
    },
    {
      id: "REC-02",
      tanggal: "15 September 2026",
      dokterPemeriksa: "dr. Hendra Sp.PD",
      diagnosisTerenkripsi: "ENC-GCM256: Pemeriksaan Rutin Tekanan Darah",
      resepTerenkripsi: "ENC-GCM256: Terapi Modifikasi Pola Makan Rendah Garam",
      statusKripto: "AES-256-GCM Terverifikasi",
    },
  ]);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/");
    } else {
      setCurrentUser(session);
    }
  }, [router]);

  const toggleDoctorAccess = (doctorId: string) => {
    setDoctors((prev) =>
      prev.map((doc) => {
        if (doc.id === doctorId) {
          const updatedStatus = doc.accessStatus === "ACTIVE" ? "REVOKED" : "ACTIVE";
          const message =
            updatedStatus === "REVOKED"
              ? `Izin akses untuk ${doc.name} berhasil dicabut secara instan.`
              : `Izin akses untuk ${doc.name} berhasil diaktifkan kembali.`;
          setNotification(message);
          setTimeout(() => setNotification(null), 3000);
          return { ...doc, accessStatus: updatedStatus };
        }
        return doc;
      })
    );
  };

  const handleConfirmLogout = () => {
    clearSession();
    setShowLogoutModal(false);
    router.push("/");
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Montserrat', sans-serif !important; }
      `}</style>

      <div className="min-h-screen bg-[#F8FAFC] text-neutral-800 flex antialiased pb-20 lg:pb-0">
        {/* ======================================================== */}
        {/* SIDEBAR PUTIH MENTOK KIRI (TULISAN BESAR & TANPA SIMBOL) */}
        {/* ======================================================== */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-neutral-200 text-neutral-700 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
        >
          <div>
            <div className="h-20 px-6 flex items-center justify-between border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-red-600/30">
                  R
                </div>
                <div>
                  <h1 className="font-extrabold text-lg text-neutral-900 leading-none">
                    Resilio<span className="text-red-600">-Health</span>
                  </h1>
                  <span className="text-xs text-neutral-400 font-bold tracking-wider uppercase mt-1 block">
                    Portal Kedaulatan Pasien
                  </span>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sm font-bold text-neutral-500">
                Tutup
              </button>
            </div>

            <nav className="py-5 space-y-1.5">
              <Link
                href="/beranda"
                className="w-full flex items-center px-6 py-3.5 text-sm sm:text-base font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
              >
                Form Input Rekam Medis
              </Link>
              <Link
                href="/patient-portal"
                className="w-full flex items-center px-6 py-3.5 text-sm sm:text-base font-extrabold bg-red-50 text-red-700 border-r-4 border-red-600 transition-all"
              >
                Portal Pasien
              </Link>
              <Link
                href="/security-audit"
                className="w-full flex items-center px-6 py-3.5 text-sm sm:text-base font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
              >
                Security Audit
              </Link>
            </nav>
          </div>

          <div className="p-4 m-4 rounded-xl bg-red-50/60 border border-red-100 text-xs space-y-1.5">
            <span className="font-extrabold text-red-700 text-sm block">Kedaulatan Data Mandiri</span>
            <p className="text-neutral-600 leading-relaxed">
              Anda hanya memiliki akses ke rekam medis pribadi Anda. Dokter tidak dapat membaca riwayat penyakit tanpa izin aktif dari Anda.
            </p>
          </div>
        </aside>

        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />}

        {/* WORKSPACE AREA */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-neutral-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-800 text-xs font-bold"
              >
                Menu
              </button>
              <h2 className="text-sm font-extrabold text-neutral-900">
                Portal Pasien: {currentUser?.name || "Budi Santoso"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full hidden sm:inline">
                ID Pasien: P-101
              </span>
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="text-xs font-bold text-neutral-600 hover:text-red-700 hover:bg-red-50 border border-neutral-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Keluar
              </button>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 space-y-6">
            {notification && (
              <div className="p-4 rounded-xl bg-neutral-900 text-white text-xs font-bold transition-all shadow-md">
                {notification}
              </div>
            )}

            {/* Banner Hak Otonomi Data Pasien */}
            <div className="bg-white border border-red-200 p-6 rounded-2xl shadow-xs space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-red-600">
                Prinsip Kedaulatan Pasien dan Perlindungan Privasi
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900">
                Kontrol Hak Akses Dokter Terhadap Catatan Medis Anda
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
                Sesuai prinsip Zero-Trust, hanya dokter yang ditugaskan oleh admin dan memiliki status izin aktif yang berhak melakukan dekripsi rekam medis. Anda dapat mencabut wewenang dokter kapan saja.
              </p>
            </div>

            {/* 1. Manajemen Dokter yang Di-assign */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <div>
                  <h4 className="text-base font-extrabold text-neutral-900">
                    Daftar Dokter yang Ditugaskan ke Anda
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Dokter-dokter di bawah ini ditugaskan oleh rumah sakit untuk memeriksa kondisi Anda
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {doctors.filter((d) => d.accessStatus === "ACTIVE").length} Dokter Berizin Aktif
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      doc.accessStatus === "ACTIVE"
                        ? "bg-white border-neutral-200 shadow-2xs"
                        : "bg-neutral-50 border-neutral-200 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            doc.accessStatus === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {doc.accessStatus === "ACTIVE" ? "Izin Aktif" : "Izin Dicabut"}
                        </span>
                        <span className="text-xs text-neutral-400 font-mono">{doc.id}</span>
                      </div>

                      <h5 className="text-sm font-extrabold text-neutral-900">{doc.name}</h5>
                      <p className="text-xs text-red-600 font-bold">{doc.specialty}</p>
                      <p className="text-xs text-neutral-500 mt-1">{doc.hospital}</p>
                      <p className="text-xs text-neutral-400 mt-2">Akses Terakhir: {doc.lastAccess}</p>
                    </div>

                    <button
                      onClick={() => toggleDoctorAccess(doc.id)}
                      className={`mt-4 w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        doc.accessStatus === "ACTIVE"
                          ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                          : "bg-neutral-900 hover:bg-black text-white"
                      }`}
                    >
                      {doc.accessStatus === "ACTIVE" ? "Cabut Izin Akses" : "Berikan Izin Akses"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Catatan Medis Khusus Pasien Terkait */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <div>
                  <h4 className="text-base font-extrabold text-neutral-900">
                    Rekam Medis Pribadi Terenkripsi
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Hanya Anda dan dokter berizin aktif yang dapat mendekripsi data ini
                  </p>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                  Privasi Terproteksi
                </span>
              </div>

              <div className="divide-y divide-neutral-100">
                {personalRecords.map((rec) => (
                  <div key={rec.id} className="py-3.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-neutral-900">
                        Pemeriksaan Medis: {rec.tanggal}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {rec.statusKripto}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 font-medium">
                      Pemeriksa: <strong className="text-neutral-900">{rec.dokterPemeriksa}</strong>
                    </p>
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-xs space-y-1 mt-1">
                      <p className="text-neutral-600 font-mono text-[11px]">{rec.diagnosisTerenkripsi}</p>
                      <p className="text-neutral-600 font-mono text-[11px]">{rec.resepTerenkripsi}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* Navigasi Bawah Khusus Layar Ponsel */}
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 z-30 lg:hidden flex justify-around py-3 shadow-lg">
          <Link href="/beranda" className="text-neutral-500 font-bold text-xs">Form EHR</Link>
          <Link href="/patient-portal" className="text-red-600 font-extrabold text-xs">Portal Pasien</Link>
          <Link href="/security-audit" className="text-neutral-500 font-bold text-xs">Security Audit</Link>
        </nav>

        {/* Modal Konfirmasi Keluar */}
        <LogoutModal
          isOpen={showLogoutModal}
          userName={currentUser?.name}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleConfirmLogout}
        />
      </div>
    </>
  );
}