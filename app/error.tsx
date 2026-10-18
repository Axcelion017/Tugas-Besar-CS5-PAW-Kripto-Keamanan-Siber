"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-slate-800 antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-2xl shadow-inner">
          !
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
            SISTEM MENGALAMI KENDALA
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
            Terjadi Kesalahan Aplikasi
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {error.message || "Aplikasi mengalami kegagalan tak terduga."}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center cursor-pointer"
          >
            Coba Lagi
          </button>
          <Link
            href="/"
            className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
          >
            Ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
