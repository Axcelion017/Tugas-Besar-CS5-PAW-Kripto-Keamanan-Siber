"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, normalizeRole, UserSession } from "@/lib/auth/auth";

export default function GlobalNotFound() {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getUserSession();
      if (s) {
        setSession(s);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const role = session ? normalizeRole(session.role) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-slate-800 antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-2xl shadow-inner">
          !
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
            HTTP 404 - DATA TIDAK DITEMUKAN
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
            Halaman / Data Tidak Ditemukan
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Alamat URL atau parameter ID yang Anda akses tidak terdaftar dalam sistem.
          </p>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left font-mono space-y-1">
          <p className="font-bold text-slate-800 uppercase text-[10px]">Zero-Trust Security Principle:</p>
          <p>
            Sistem merespon dengan status 404 dan menolak mengalihkan permintaan ke data lain guna mencegah potensi kebocoran data (BOLA/IDOR Defense).
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {session && role ? (
            <>
              <Link
                href={`/${role}`}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
              >
                ← Kembali ke Dashboard ({session.role.toUpperCase()})
              </Link>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition text-center cursor-pointer"
              >
                Halaman Sebelumnya
              </button>
            </>
          ) : (
            <>
              <Link
                href="/"
                className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
              >
                Beranda Utama
              </Link>
              <Link
                href="/login"
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
              >
                Halaman Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
