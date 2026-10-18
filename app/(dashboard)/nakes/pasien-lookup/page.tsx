"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  MOCK_ACCESS_GRANTS,
  MOCK_SECURITY_LOGS,
  getStorageData,
  setStorageData,
  Patient,
  AccessGrant,
  SecurityAuditLog,
} from "@/lib/db/mockData";

export default function PasienLookupPage() {
  const [nikSearch, setNikSearch] = useState("");
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [targetPatientBlocked, setTargetPatientBlocked] = useState<Patient | null>(null);

  // Break-Glass State
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("Pasien Tidak Sadarkan Diri / Koma di IGD");
  const [breakGlassActive, setBreakGlassActive] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setAccessDenied(false);
    setSearchResult(null);
    setTargetPatientBlocked(null);
    setBreakGlassActive(false);

    const cleanNik = nikSearch.trim();
    const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
    const targetPatient = allPatients.find((p) => p.nik === cleanNik || p.id === cleanNik);

    if (!targetPatient) {
      return;
    }

    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    // Pengecekan Pertahanan BOLA/IDOR (Zero-Trust Gatekeeper)
    const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const activeGrant = allGrants.find(
      (g) =>
        g.pasienId === targetPatient.id &&
        (g.entityId === doctorId || g.entityId === "DOC-01") &&
        !g.isRevoked
    );

    if (!activeGrant) {
      // Akses Ilegal / Tanpa Izin -> Catat ke SIEM Log
      setAccessDenied(true);
      setTargetPatientBlocked(targetPatient);

      const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
      const newLog: SecurityAuditLog = {
        id: `LOG-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toLocaleString("id-ID"),
        actorId: doctorId,
        actorName: session?.name || "Dokter Pemeriksa",
        actorRole: "NAKES",
        action: "IDOR_BLOCKED",
        targetResource: `/api/rme/patient/${targetPatient.id}`,
        ipAddress: "192.168.1.42 (Klinik LAN)",
        userAgent: navigator.userAgent,
        severity: "CRITICAL",
        detail: `BOLA Guard: Dokter mencoba mengakses NIK ${cleanNik} tanpa tiket consent aktif dari pasien. Akses diblokir otomatis.`,
      };
      setStorageData("resilio_security_logs", [newLog, ...logs]);
      return;
    }

    // Terotorisasi
    setSearchResult(targetPatient);
  };

  const handleExecuteBreakGlass = () => {
    if (!targetPatientBlocked) return;
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    // 1. Terbitkan Emergency AccessGrant
    const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const emergencyGrant: AccessGrant = {
      id: `GRANT-EMERGENCY-${Date.now().toString().slice(-4)}`,
      pasienId: targetPatientBlocked.id,
      pasienNama: targetPatientBlocked.name,
      entityId: doctorId,
      entityNama: session?.name || "Dokter IGD",
      entityType: "DOKTER",
      scope: `Akses Darurat IGD (Break-Glass): ${breakGlassReason}`,
      validUntil: "12 Jam ke Depan",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
      isBreakGlass: true,
    };
    setStorageData("resilio_access_grants", [emergencyGrant, ...allGrants]);

    // 2. Kirim High-Severity Alert ke SIEM
    const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
    const emergencyLog: SecurityAuditLog = {
      id: `LOG-BREAKGLASS-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleString("id-ID"),
      actorId: doctorId,
      actorName: session?.name || "Dokter IGD",
      actorRole: "NAKES",
      action: "BREAK_GLASS_ACCESS",
      targetResource: `/api/rme/break-glass/${targetPatientBlocked.id}`,
      ipAddress: "192.168.1.42 (IGD Terminal)",
      userAgent: navigator.userAgent,
      severity: "CRITICAL",
      detail: `BREAK-GLASS DIAKTIFKAN: ${session?.name} membuka rekam medis darurat ${targetPatientBlocked.name} (NIK: ${targetPatientBlocked.nik}). Alasan: ${breakGlassReason}. Notifikasi dikirim ke Admin Regulator Kemenkes.`,
    };
    setStorageData("resilio_security_logs", [emergencyLog, ...logs]);

    // 3. Buka tampilan pasien dengan tanda darurat
    setShowBreakGlassModal(false);
    setAccessDenied(false);
    setBreakGlassActive(true);
    setSearchResult(targetPatientBlocked);
    setNotif(
      `Akses Darurat (Break-Glass) DIAKTIFKAN. Rekam medis kritis ${targetPatientBlocked.name} terbuka. Log audit prioritas tinggi telah dikirim ke Admin Kemenkes.`
    );
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
          <span>Pencarian Pasien, BOLA Guard & Break-Glass IGD (UR-T03 & UR-T08)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pencarian Pasien Nasional via NIK & Protokol Darurat IGD
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Mekanisme Zero-Trust memvalidasi tiket izin pasien sebelum data klinis dibuka. Untuk pasien darurat tidak sadarkan diri, gunakan <strong>Protokol Break-Glass</strong> berstandar internasional (ISO 27799 / HIPAA).
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Input Pencarian NIK */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4 max-w-2xl">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase">
            Masukkan Nomor Induk Kependudukan (NIK) atau ID Pasien:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={nikSearch}
              onChange={(e) => setNikSearch(e.target.value)}
              placeholder="Contoh: 3171012304800001 (Sah) atau 3171044406980004 (Tanpa Izin / IGD)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
            >
              Cek Izin & Cari
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            <span>Uji Coba Cepat:</span>
            <button
              type="button"
              onClick={() => setNikSearch("3171012304800001")}
              className="text-blue-600 font-bold hover:underline"
            >
              Budi Santoso (Izin Aktif)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setNikSearch("3171044406980004")}
              className="text-red-600 font-bold hover:underline"
            >
              Dewi Lestari (Uji BOLA / Break-Glass IGD)
            </button>
          </div>
        </form>
      </div>

      {/* Hasil Pengecekan BOLA / Otorisasi */}
      {hasSearched && (
        <div>
          {accessDenied && (
            <div className="p-8 rounded-3xl bg-red-50 border-2 border-red-300 text-red-900 space-y-4 max-w-2xl">
              <div>
                <h3 className="text-lg font-black text-red-700">
                  AKSES DITOLAK: Pelanggaran BOLA / IDOR Terdeteksi
                </h3>
                <p className="text-xs text-red-800 font-medium mt-0.5">
                  Anda tidak memiliki tiket izin akses (Consent) aktif dari pasien dengan NIK tersebut.
                </p>
              </div>

              <div className="p-4 bg-white/80 rounded-2xl border border-red-200 text-xs font-mono text-red-800 space-y-1">
                <p>• Status HTTP: 403 Forbidden (Broken Object Level Authorization Defended)</p>
                <p>• Regulasi: UU PDP No. 27/2022 Pasal 20 (Consent Prerequisite)</p>
                <p>• Log Audit: Percobaan akses dicatat ke SIEM Security Monitor Kemenkes.</p>
              </div>

              {/* Tombol Protokol Darurat Break-Glass */}
              <div className="pt-2 border-t border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-red-700 font-semibold">
                  Pasien gawat darurat tidak sadarkan diri di IGD?
                </p>
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(true)}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Aktivasi Akses Darurat (Break-Glass)
                </button>
              </div>
            </div>
          )}

          {!accessDenied && !searchResult && (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 max-w-2xl text-center text-slate-500 text-xs">
              Pasien dengan NIK tersebut tidak ditemukan di basis data nasional.
            </div>
          )}

          {!accessDenied && searchResult && (
            <div
              className={`p-8 rounded-3xl border shadow-sm space-y-6 max-w-2xl ${
                breakGlassActive
                  ? "bg-red-50/50 border-red-300"
                  : "bg-white border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      breakGlassActive ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {breakGlassActive
                      ? "AKSES DARURAT MEDIS AKTIF (BREAK-GLASS ISO 27799)"
                      : "Tiket Izin Akses Terkonfirmasi Sah (DPJP Aktif)"}
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">
                    {searchResult.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    NIK: {searchResult.nik} • No. RM: {searchResult.mrn}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    breakGlassActive
                      ? "bg-red-200 text-red-900 border-red-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {breakGlassActive ? "Break-Glass Sesi" : "Consent DPJP"}
                </span>
              </div>

              {/* Data Klinis Kritis Pasien */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Gol. Darah</span>
                  <p className="text-base font-black text-red-600 mt-0.5">{searchResult.bloodType}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Usia / Gender</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{searchResult.age} Thn ({searchResult.gender})</p>
                </div>
                <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Kontak Darurat Keluarga</span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {searchResult.emergencyContact?.name || "Keluarga"} ({searchResult.emergencyContact?.phone || "-"})
                  </p>
                </div>
              </div>

              {(searchResult.allergies?.length ?? 0) > 0 && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs font-bold">
                  PERINGATAN ALERGI KRITIS: {searchResult.allergies?.join(", ")}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <Link
                  href="/nakes/rujukan"
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase rounded-xl transition shadow-xs"
                >
                  Buat Surat Rujukan →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Aktivasi Break-Glass */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border-2 border-red-500">
            <div className="border-b border-red-100 pb-3">
              <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                Protokol Gawat Darurat (Break-Glass Protocol)
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Konfirmasi Buka Akses Pasien Tanpa Izin
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fitur ini dirancang sesuai standar internasional <strong>ISO 27799 / HIPAA</strong> untuk menyelamatkan nyawa pasien koma/syok di IGD. <strong>Perhatian:</strong> Setiap aktivasi Break-Glass akan langsung dilaporkan ke Admin Kemenkes dan diaudit forensik.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Pilih Indikasi Medis Gawat Darurat *
              </label>
              <select
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-xs bg-white font-semibold"
              >
                <option value="Pasien Tidak Sadarkan Diri / Koma di IGD">Pasien Tidak Sadarkan Diri / Koma di IGD</option>
                <option value="Syok Anafilaktik / Henti Jantung Akut">Syok Anafilaktik / Henti Jantung Akut</option>
                <option value="Trauma Ganda / Kecelakaan Lalu Lintas Kritis">Trauma Ganda / Kecelakaan Lalu Lintas Kritis</option>
                <option value="Kegawatdaruratan Kebidanan / Perdarahan Masif">Kegawatdaruratan Kebidanan / Perdarahan Masif</option>
              </select>
            </div>

            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800 text-xs">
              <p className="font-bold">Akuntabilitas Medis:</p>
              <p className="text-[11px] mt-0.5">
                Dokter: {getUserSession()?.name} (STR: {getUserSession()?.strNumber}) bertanggung jawab penuh atas pembukaan data ini.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBreakGlass}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-md"
              >
                Sahkan & Buka Rekam Medis Darurat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
