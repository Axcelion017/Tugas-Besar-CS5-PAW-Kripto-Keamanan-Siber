"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerPasienCepatServerAction } from "@/lib/actions/auth";

export default function RegisterPasienPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Konfirmasi kata sandi tidak cocok. Harap periksa kembali.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Kata sandi minimal 6 karakter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerPasienCepatServerAction({
        username,
        namaLengkap,
        email,
        password,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        setIsSubmitting(false);
        return;
      }

      // Berhasil dibuat -> arahkan ke halaman login dengan query registered
      router.push(`/login?registered=true&username=${encodeURIComponent(username)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kesalahan server";
      setErrorMsg(`Gagal mendaftar: ${msg}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 font-sans text-slate-800 antialiased flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <div>
          <Link href="/login" className="text-xs font-bold text-slate-500 hover:text-red-600 transition">
            ← Kembali ke Halaman Masuk
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-sm font-black uppercase">
              PAS
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Pendaftaran Pasien
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Buat akun cepat untuk mengakses layanan kesehatan Resilio-Health.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-700 text-xs font-bold">
            <p className="font-bold">Pendaftaran Belum Dapat Diproses:</p>
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Username Unik *
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="Contoh: ahmad_syarif"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Hanya huruf kecil, angka, dan underscore.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              required
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              placeholder="Contoh: Ahmad Syarifudin"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Alamat Email Aktif *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmad@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Kata Sandi *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Konfirmasi Kata Sandi *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang kata sandi"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition shadow-lg shadow-slate-900/10 disabled:opacity-50"
            >
              {isSubmitting ? "Membuat Akun..." : "Daftar Akun Pasien"}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="font-bold text-emerald-700 hover:underline">
            Masuk Sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}
