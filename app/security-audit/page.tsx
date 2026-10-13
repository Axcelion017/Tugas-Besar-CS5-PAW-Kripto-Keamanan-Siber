"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateHMAC, verifyHMAC } from "../../lib/crypto/hmac";
import { MOCK_PATIENTS, MOCK_DOCTORS, Patient, AuthorizedDoctor } from "../../lib/db/mockData";
import { getSession, clearSession, UserSession } from "../../lib/auth/auth";
import { LogoutModal } from "../../components/ui/LogoutModal";

export default function SecurityAuditAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [doctors] = useState<AuthorizedDoctor[]>(MOCK_DOCTORS);

  // State untuk Fitur Penugasan Admin (Assign Dokter ke Pasien)
  const [selectedPatientForAssign, setSelectedPatientForAssign] = useState("P-101");
  const [selectedDoctorForAssign, setSelectedDoctorForAssign] = useState("DOC-01");
  const [assignNotification, setAssignNotification] = useState<string | null>(null);

  // State Pengujian Integritas Kriptografis
  const [rawText, setRawText] = useState("Paracetamol 500mg 3x1");
  const [secretKey] = useState("SessionKey2026!");
  const [hmacTag, setHmacTag] = useState("a1b2c3d4e5f6789012345678abcdef01");
  const [tamperStatus, setTamperStatus] = useState<"clean" | "tampered" | null>(null);

  // Log Audit Aktivitas
  const [auditLogs, setAuditLogs] = useState([
    { id: "LOG-01", waktu: "10 Oktober 2026, 15:30 WIB", aktor: "Administrator", aksi: "Penugasan Dokter (dr. Hendra ke Budi Santoso)", status: "Berhasil", target: "P-101", ip: "10.0.1.1" },
    { id: "LOG-02", waktu: "10 Oktober 2026, 14:10 WIB", aktor: "dr. Hendra Sp.PD", aksi: "Enkripsi Rekam Medis Pasien Ter-assign", status: "Terotorisasi", target: "P-101", ip: "192.168.1.42" },
    { id: "LOG-03", waktu: "10 Oktober 2026, 11:20 WIB", aktor: "Gateway Pengawas", aksi: "Pemeriksaan Hubungan Penugasan (BOLA)", status: "Validasi Lulus", target: "P-101", ip: "10.0.4.15" },
    { id: "LOG-04", waktu: "9 Oktober 2026, 16:05 WIB", aktor: "dr. Rian Sp.JP", aksi: "Membuka Pasien Tanpa Penugasan", status: "Ditolak oleh Sistem", target: "P-104", ip: "192.168.1.88" },
  ]);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/");
    } else {
      setCurrentUser(session);
    }
  }, [router]);

  // Handler Admin Menugaskan Dokter ke Pasien
  const handleAssignDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPatient = patients.find((p) => p.id === selectedPatientForAssign);
    const targetDoctor = doctors.find((d) => d.id === selectedDoctorForAssign);

    if (targetPatient && targetDoctor) {
      setPatients((prev) =>
        prev.map((p) => (p.id === selectedPatientForAssign ? { ...p, hasAccess: true } : p))
      );

      const msg = `Berhasil: ${targetDoctor.name} telah ditugaskan untuk menangani pasien ${targetPatient.name}. Dokter sekarang memiliki izin akses rekam medis.`;
      setAssignNotification(msg);
      setTimeout(() => setAssignNotification(null), 4000);

      setAuditLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          waktu: "10 Oktober 2026, Baru saja",
          aktor: "Administrator",
          aksi: `Penugasan Dokter (${targetDoctor.name} ke ${targetPatient.name})`,
          status: "Berhasil",
          target: targetPatient.id,
          ip: "10.0.1.1 (Admin Terminal)",
        },
        ...prev,
      ]);
    }
  };

  const testIntegrity = async (textToTest: string) => {
    const validTag = await generateHMAC("Paracetamol 500mg 3x1", secretKey);
    setHmacTag(validTag);
    const isValid = await verifyHMAC(textToTest, validTag, secretKey);
    setTamperStatus(isValid ? "clean" : "tampered");
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
                    Pusat Kontrol Admin
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
                className="w-full flex items-center px-6 py-3.5 text-sm sm:text-base font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
              >
                Portal Pasien
              </Link>
              <Link
                href="/security-audit"
                className="w-full flex items-center px-6 py-3.5 text-sm sm:text-base font-extrabold bg-red-50 text-red-700 border-r-4 border-red-600 transition-all"
              >
                Security Audit
              </Link>
            </nav>
          </div>

          <div className="p-4 m-4 rounded-xl bg-red-50/60 border border-red-100 text-xs space-y-1.5">
            <span className="font-extrabold text-red-700 text-sm block">Prinsip Need to Know</span>
            <p className="text-neutral-600 leading-relaxed">
              Sebagai Administrator, Anda mengelola penugasan dokter dan audit sistem, namun tidak memiliki kunci untuk membaca isi rekam medis pasien.
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
                Pusat Kontrol Admin dan Audit Keamanan
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full hidden sm:inline">
                Peran: Administrator Keamanan
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
            {assignNotification && (
              <div className="p-4 rounded-xl bg-neutral-900 text-white text-xs font-bold transition-all shadow-md">
                {assignNotification}
              </div>
            )}

            {/* 1. Fitur Utama Admin: Menugaskan Dokter ke Pasien */}
            <div className="bg-white border border-red-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div>
                <span className="text-xs font-extrabold uppercase text-red-600">
                  Wewenang Administrator Sistem
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 mt-0.5">
                  Penugasan Dokter ke Pasien (Authorization Binding)
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Dokter tidak dapat membuka rekam medis pasien sebelum ditugaskan oleh admin. Penugasan ini membentuk hak akses sah di gateway sistem.
                </p>
              </div>

              <form onSubmit={handleAssignDoctor} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Pilih Pasien</label>
                  <select
                    value={selectedPatientForAssign}
                    onChange={(e) => setSelectedPatientForAssign(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-2.5 text-xs text-neutral-800 font-semibold"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mrn})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Pilih Dokter yang Ditugaskan</label>
                  <select
                    value={selectedDoctorForAssign}
                    onChange={(e) => setSelectedDoctorForAssign(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-2.5 text-xs text-neutral-800 font-semibold"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} - {d.specialty}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 transition-all cursor-pointer"
                >
                  Tugaskan Dokter ke Pasien
                </button>
              </form>
            </div>

            {/* 2. Informasi Status Pasien dan Dokter (Zero-Knowledge: Tanpa Membaca Isi Medis) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Informasi Pasien */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                  <h4 className="text-sm font-extrabold text-neutral-900">Status Informasi Pasien</h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    Rekam Medis Terkunci Enkripsi
                  </span>
                </div>

                <div className="divide-y divide-neutral-100 text-xs">
                  {patients.map((pat) => (
                    <div key={pat.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-neutral-900">{pat.name}</p>
                        <p className="text-neutral-500 text-[11px]">{pat.mrn} • Usia {pat.age} tahun ({pat.gender})</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            pat.hasAccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {pat.hasAccess ? "Dokter Ditugaskan" : "Belum Ada Penugasan"}
                        </span>
                        <p className="text-[10px] text-neutral-400 mt-1">Diagnosis: Terenkripsi Sisi Klien</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Informasi Dokter */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                  <h4 className="text-sm font-extrabold text-neutral-900">Daftar Tenaga Medis Aktif</h4>
                  <span className="text-[10px] font-bold text-neutral-500">
                    {doctors.length} Dokter Terdaftar
                  </span>
                </div>

                <div className="divide-y divide-neutral-100 text-xs">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-neutral-900">{doc.name}</p>
                        <p className="text-red-600 text-[11px] font-semibold">{doc.specialty}</p>
                        <p className="text-neutral-400 text-[10px]">{doc.hospital}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-mono">
                        {doc.id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Panel Pengujian Integritas Kriptografis (HMAC-SHA256) */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <span className="text-xs font-extrabold uppercase text-red-600">
                  Pengujian Integritas Kriptografis
                </span>
                <h4 className="text-base font-extrabold text-neutral-900 mt-0.5">
                  Simulasi Pendeteksian Manipulasi Data Lokal
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Isi Resep Obat Asli
                  </label>
                  <input
                    type="text"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-2.5 text-xs text-neutral-800"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1 font-mono">HMAC Tag: {hmacTag}</p>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={() => testIntegrity(rawText)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Uji Data Asli
                  </button>
                  <button
                    onClick={() => {
                      const tampered = rawText + " (Dosis Diubah Peretas)";
                      testIntegrity(tampered);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Simulasi Manipulasi Data
                  </button>
                </div>
              </div>

              {tamperStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    tamperStatus === "clean"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {tamperStatus === "clean"
                    ? "Integritas Valid: Data rekam medis asli dan terjamin keasliannya."
                    : "Peringatan Keamanan: Terdeteksi manipulasi data! Tag HMAC rusak."}
                </div>
              )}
            </div>

            {/* 4. Tabel Audit Trail Aktivitas Keamanan */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <div>
                  <h4 className="text-base font-extrabold text-neutral-900">Catatan Audit Trail Keamanan</h4>
                  <p className="text-xs text-neutral-500">Transparansi seluruh penugasan dokter dan akses sistem</p>
                </div>
                <span className="text-xs font-bold text-neutral-500">{auditLogs.length} Aktivitas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-medium min-w-[650px]">
                  <thead className="bg-neutral-50 text-neutral-500 text-[11px] uppercase tracking-wider border-b border-neutral-200 font-bold">
                    <tr>
                      <th className="py-3 px-3">Waktu</th>
                      <th className="py-3 px-3">Aktor</th>
                      <th className="py-3 px-3">Aktivitas</th>
                      <th className="py-3 px-3">Target Pasien</th>
                      <th className="py-3 px-3">Alamat IP</th>
                      <th className="py-3 px-3">Status Otorisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 text-neutral-400 whitespace-nowrap">{log.waktu}</td>
                        <td className="py-3 px-3 font-bold text-neutral-900">{log.aktor}</td>
                        <td className="py-3 px-3 text-red-700 font-semibold">{log.aksi}</td>
                        <td className="py-3 px-3 text-neutral-600 font-mono">{log.target}</td>
                        <td className="py-3 px-3 text-neutral-400 font-mono">{log.ip}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              log.status.includes("Berhasil") || log.status.includes("Terotorisasi") || log.status.includes("Lulus")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>

        {/* Navigasi Bawah Layar Ponsel */}
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 z-30 lg:hidden flex justify-around py-3 shadow-lg">
          <Link href="/beranda" className="text-neutral-500 font-bold text-xs">Form EHR</Link>
          <Link href="/patient-portal" className="text-neutral-500 font-bold text-xs">Portal Pasien</Link>
          <Link href="/security-audit" className="text-red-600 font-extrabold text-xs">Security Audit</Link>
        </nav>

        {/* Modal Konfirmasi Keluar Desain Baru */}
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