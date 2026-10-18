"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, normalizeRole } from "@/lib/auth/auth";

export default function HomePage() {
  const router = useRouter();

  const handleQuickDemo = (user: string, pass: string) => {
    const session = loginUser(user, pass);
    if (session) {
      const target = normalizeRole(session.role);
      router.push(`/${target}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-red-200 shrink-0">
              R
            </div>
            <div>
              <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg">
                RESILIO<span className="text-red-600">-HEALTH</span>
              </span>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold tracking-wider uppercase truncate">
                Zero-Trust Hospital Information System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 text-slate-700 hover:text-slate-900 text-xs font-bold transition whitespace-nowrap"
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition whitespace-nowrap"
            >
              Halaman Login →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            <span>Standar Permenkes No. 24/2022 & UU Pelindungan Data Pribadi (UU PDP)</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Resiliensi Rekam Medis Digital Tanpa Titik Lemah Tunggal
          </h1>

          <p className="text-base text-slate-600 leading-relaxed font-medium">
            Resilio-Health adalah Sistem Informasi Rumah Sakit berbasis web yang melindungi data klinis pasien dengan <strong>Enkripsi Sisi Klien (AES-256-GCM)</strong>, jaminan keutuhan <strong>HMAC-SHA256</strong>, ketahanan <strong>Offline-First (PWA & IndexedDB)</strong>, serta <strong>Zero-Trust BOLA/IDOR Defense</strong>.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 transition text-center"
            >
              Masuk ke Halaman Login →
            </Link>
            <Link
              href="/register/pasien"
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider border border-slate-300 shadow-sm transition text-center"
            >
              Registrasi Pasien Baru
            </Link>
          </div>

          {/* Quick Demo Action Buttons */}
          <div className="pt-4 p-6 bg-white rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
              Pilih Akses Cepat Evaluasi Peran Pengguna (4-Role Quick Demo):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleQuickDemo("dr_andi", "doctor123")}
                className="p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-800">ROLE: DOKTER</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    DPJP
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">dr. Andi Pratama, Sp.PD</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  SOAP, Rontgen Enkripsi, Break-Glass & Addendum
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("suster_maya", "nurse123")}
                className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-800">ROLE: STAF</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                    Triase & Admisi
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">Ners Maya Kartika</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check-in, Triase Tanda Vital & Assign DPJP
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("budi", "patient123")}
                className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-800">ROLE: PASIEN</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                    Pasien
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">Budi Santoso (NIK)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dekripsi RME & Rontgen, Proxy Keluarga, PIN DPJP
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("admin", "admin123")}
                className="p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-800">ROLE: ADMIN</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                    Regulator
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">Administrator Kemenkes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual e-KYC/KYD, Break-Glass Audit & Kill-Switch
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Pillars Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Pengembangan Aplikasi Web (PAW)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Arsitektur Progressive Web App (PWA) dengan Service Worker dan IndexedDB. Dokter tetap dapat membuka dan menginput data pasien meski koneksi internet putus (Downtime Resilience).
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Kriptografi Sisi Klien
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enkripsi AES-256-GCM langsung di browser pasien/dokter sebelum tersimpan di server. Deteksi manipulasi data menggunakan HMAC-SHA256 berprinsip Fail-Closed.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Keamanan Siber & Zero-Trust
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pertahanan BOLA/IDOR ketat dengan verifikasi relasi consent aktif. Pemisahan peran mutlak (Admin dilarang membaca data medis), pemantauan SIEM, dan isolasi faskes terinfeksi malware.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500">
        <p>Resilio-Health • Integrasi Tugas Besar PAW, Kriptografi & Keamanan Siber 2026</p>
      </footer>
    </div>
  );
}
