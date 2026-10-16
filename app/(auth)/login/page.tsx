"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser, normalizeRole } from "@/lib/auth/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const session = loginUser(identifier, password);
    if (session) {
      const targetRole = normalizeRole(session.role);
      router.replace(`/${targetRole}`);
    } else {
      setErrorMsg("Kredensial atau NIK tidak valid. Periksa kembali atau gunakan tombol demo.");
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (user: string, pass: string) => {
    setIsLoading(true);
    const session = loginUser(user, pass);
    if (session) {
      const targetRole = normalizeRole(session.role);
      router.replace(`/${targetRole}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 font-sans text-slate-800 antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-red-600 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-red-200 mb-3">
            R
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            RESILIO<span className="text-red-600">-HEALTH</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Sistem Informasi Rekam Medis & Zero-Trust Gateway
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Formulir Masuk */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              NIK / Username / Email
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Contoh: dr_andi, budi, atau 3171012304800001"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Kata Sandi (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-red-600/30 transition-all cursor-pointer disabled:bg-slate-400"
          >
            {isLoading ? "Memverifikasi Otorisasi..." : "Masuk ke Sistem"}
          </button>
        </form>

        {/* Tombol Jalan Pintas Pengujian Role */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase text-center mb-3">
            Akses Cepat Pengujian Role (Demo)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("dr_andi", "doctor123")}
              className="py-2.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black transition border border-emerald-200 text-center cursor-pointer"
            >
              Dokter
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("budi", "patient123")}
              className="py-2.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-black transition border border-blue-200 text-center cursor-pointer"
            >
              Pasien
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("admin", "admin123")}
              className="py-2.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-black transition border border-purple-200 text-center cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>

        {/* Link Pendaftaran Pengguna Baru */}
        <div className="pt-2 text-center space-y-2">
          <p className="text-xs text-slate-500 font-medium">Belum memiliki akun terverifikasi?</p>
          <div className="flex justify-center gap-4 text-xs font-bold text-red-600">
            <Link href="/register/pasien" className="hover:underline">
              Daftar Pasien (NIK) →
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/register/nakes" className="hover:underline">
              Daftar Nakes (STR/SIP) →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
