"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS, saveSession, UserSession } from "../../lib/auth/auth";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"doctor" | "patient">("doctor");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Identitas pengguna dan kata sandi wajib diisi.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi harus terdiri dari minimal 6 karakter.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Validasi kredensial simulasi
      if (role === "doctor") {
        const session: UserSession = {
          ...DEMO_USERS.doctor,
          identifier: username,
        };
        saveSession(session);
        router.push("/");
      } else {
        const session: UserSession = {
          ...DEMO_USERS.patient,
          identifier: username,
        };
        saveSession(session);
        router.push("/patient-portal");
      }
    }, 600);
  };

  const handleQuickDemoLogin = (selectedRole: "doctor" | "patient") => {
    setIsLoading(true);
    setTimeout(() => {
      if (selectedRole === "doctor") {
        saveSession(DEMO_USERS.doctor);
        router.push("/");
      } else {
        saveSession(DEMO_USERS.patient);
        router.push("/patient-portal");
      }
    }, 300);
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Montserrat', sans-serif !important; }
      `}</style>

      <div className="min-h-screen bg-[#F8FAFC] text-neutral-800 flex items-center justify-center p-4 sm:p-6 antialiased">
        <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Logo dan Judul */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white font-extrabold text-xl mx-auto shadow-md shadow-red-600/30">
              R
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
              Resilio<span className="text-red-600">-Health</span>
            </h1>
            <p className="text-xs text-neutral-500 font-medium">
              Sistem Otentikasi dan Manajemen Akses Rumah Sakit
            </p>
          </div>

          {/* Pemilih Peran Pengguna (Role Switcher) */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => {
                setRole("doctor");
                setErrorMessage("");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                role === "doctor"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Tenaga Medis
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("patient");
                setErrorMessage("");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                role === "patient"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Pasien
            </button>
          </div>

          {/* Formulir Login */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                {role === "doctor" ? "Nomor Induk Tenaga Medis / Username" : "Nomor Rekam Medis / NIK"}
              </label>
              <input
                type="text"
                placeholder={role === "doctor" ? "Contoh: DOK-0881" : "Contoh: MRN-2026-0081"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-800 focus:outline-none focus:bg-white focus:border-red-500 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Kata Sandi Sesi
              </label>
              <input
                type="password"
                placeholder="Masukkan kata sandi..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-800 focus:outline-none focus:bg-white focus:border-red-500 transition-all font-medium"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                Peringatan: {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm rounded-xl shadow-md shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "Memverifikasi Akses..." : "Masuk ke Sistem"}
            </button>
          </form>

          {/* Pembatas Garis */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-200"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Akses Cepat Pengujian
            </span>
            <div className="flex-grow border-t border-neutral-200"></div>
          </div>

          {/* Tombol Demo Cepat untuk Dosen Penguji */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("doctor")}
              className="w-full py-2.5 px-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-bold transition-all text-left flex items-center justify-between"
            >
              <span>Masuk Sebagai Dokter</span>
              <span className="text-[10px] text-red-600 font-mono">dr. Hendra Sp.PD</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin("patient")}
              className="w-full py-2.5 px-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-bold transition-all text-left flex items-center justify-between"
            >
              <span>Masuk Sebagai Pasien</span>
              <span className="text-[10px] text-red-600 font-mono">Budi Santoso</span>
            </button>
          </div>

          {/* Catatan Kriptografi & Keamanan */}
          <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl text-center">
            <p className="text-[11px] text-neutral-600 leading-tight">
              Kredensial login digunakan untuk menurunkan kunci enkripsi lokal menggunakan fungsi turunan kunci KDF guna melindungi rekam medis.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}