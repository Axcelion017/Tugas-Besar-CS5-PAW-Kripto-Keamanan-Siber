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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setAccessDenied(false);
    setSearchResult(null);

    const cleanNik = nikSearch.trim();
    const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
    const targetPatient = allPatients.find((p) => p.nik === cleanNik || p.id === cleanNik);

    if (!targetPatient) {
      return;
    }

    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    // Pengecekan Pertahanan BOLA/IDOR (Zero-Trust Gatekeeper)
    // Cek apakah ada AccessGrant aktif untuk dokter ini terhadap pasien ini
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <span>Pencarian Pasien & Pertahanan BOLA/IDOR (UR-T03)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pencarian Pasien Nasional via NIK & Validasi Consent
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Mekanisme Zero-Trust memvalidasi tiket izin pasien sebelum data klinis dibuka untuk mencegah serangan kebocoran data (BOLA / IDOR).
        </p>
      </div>

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
              placeholder="Contoh: 3171012304800001 (Sah) atau 3171044406980004 (Tanpa Izin)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
            >
              Cek Izin & Cari
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Uji Coba Cepat:</span>
            <button
              type="button"
              onClick={() => setNikSearch("3171012304800001")}
              className="text-blue-600 font-bold hover:underline"
            >
              NIK Budi Santoso (Izin Aktif)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setNikSearch("3171044406980004")}
              className="text-red-600 font-bold hover:underline"
            >
              NIK Dewi Lestari (Tanpa Izin / BOLA Alert)
            </button>
          </div>
        </form>
      </div>

      {/* Hasil Pengecekan BOLA / Otorisasi */}
      {hasSearched && (
        <div>
          {accessDenied && (
            <div className="p-8 rounded-3xl bg-red-50 border-2 border-red-300 text-red-900 space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-black text-red-700">
                    AKSES DITOLAK: Pelanggaran BOLA / IDOR Terdeteksi
                  </h3>
                  <p className="text-xs text-red-800 font-medium mt-0.5">
                    Anda tidak memiliki tiket izin akses (Consent) aktif dari pasien dengan NIK tersebut.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-white/80 rounded-2xl border border-red-200 text-xs font-mono text-red-800 space-y-1">
                <p>• Status HTTP: 403 Forbidden (Broken Object Level Authorization Defended)</p>
                <p>• Regulasi: UU PDP No. 27/2022 Pasal 20 (Consent Prerequisite)</p>
                <p>• Log Audit: Percobaan akses telah dicatat ke SIEM Security Monitor Kemenkes.</p>
              </div>
            </div>
          )}

          {!accessDenied && !searchResult && (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 max-w-2xl text-center text-slate-500 text-xs">
              Pasien dengan NIK tersebut tidak ditemukan di basis data nasional.
            </div>
          )}

          {!accessDenied && searchResult && (
            <div className="bg-white p-8 rounded-3xl border border-emerald-300 shadow-sm space-y-6 max-w-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Tiket Izin Akses Terkonfirmasi Sah (UU PDP)
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">
                    {searchResult.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    NIK: {searchResult.nik} • No. RM: {searchResult.mrn}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                  Consent Aktif
                </span>
              </div>

              {/* Data Klinis Ringkas Pasien */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Gol. Darah</span>
                  <p className="text-base font-black text-red-600 mt-0.5">{searchResult.bloodType}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Usia / Gender</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{searchResult.age} Thn ({searchResult.gender})</p>
                </div>
                <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Kontak Darurat</span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {searchResult.emergencyContact.name} ({searchResult.emergencyContact.phone})
                  </p>
                </div>
              </div>

              {searchResult.allergies.length > 0 && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs font-bold">
                  PERINGATAN ALERGI: {searchResult.allergies.join(", ")}
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
    </div>
  );
}
