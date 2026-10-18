"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { getUserSession, normalizeRole } from "@/lib/auth/auth";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught error:", error);
  }, [error]);

  const session = typeof window !== "undefined" ? getUserSession() : null;
  const role = session ? normalizeRole(session.role) : "pasien";

  return (
    <div className="p-8 md:p-12 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-12 text-center space-y-5">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-2xl shadow-inner">
        !
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
          TERJADI KENDALA OPERASIONAL
        </span>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
          Gagal Memuat Komponen Data
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {error.message || "Terjadi kesalahan internal saat merender antarmuka data."}
        </p>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left font-mono space-y-1">
        <p className="font-bold text-slate-800 uppercase text-[10px]">Sistem Tetap Terlindungi:</p>
        <p>
          Sesi autentikasi Anda tetap aktif. Data lokal Anda tersimpan aman dan tidak terhapus.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
        >
          Coba Muat Ulang Halaman
        </button>
        <Link
          href={`/${role}`}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition text-center"
        >
          ← Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
