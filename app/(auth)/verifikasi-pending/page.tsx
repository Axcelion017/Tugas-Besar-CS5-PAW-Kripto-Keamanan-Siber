"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function VerifikasiPendingContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "pengguna";
  const nama = searchParams.get("nama") || "Pengguna";

  return (
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center text-sm font-black mx-auto tracking-wider uppercase">
        PENDING
      </div>

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
          Status: Menunggu Verifikasi ({role.toUpperCase()})
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
          Pengajuan Berhasil Dikirim
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Terima kasih, <strong>{nama}</strong>. Dokumen pendaftaran Anda sedang dalam antrean verifikasi Admin Regulator.
        </p>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl text-left border border-slate-200 space-y-2 text-xs text-slate-600">
        <p className="font-bold text-slate-800">
          Protokol Keamanan Zero-Trust & UU PDP:
        </p>
        <p>
          • Setiap identitas pasien wajib divalidasi ke data Kependudukan (NIK) untuk mencegah akun tiruan / duplikasi rekam medis.
        </p>
        <p>
          • Kredensial STR dan SIP Tenaga Medis diverifikasi melalui basis data Kemenkes sebelum hak akses tulis RME diaktifkan.
        </p>
      </div>

      <div className="space-y-2">
        <Link
          href="/login"
          className="block w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md"
        >
          Kembali ke Halaman Masuk
        </Link>
      </div>
    </div>
  );
}

export default function VerifikasiPendingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-800 antialiased">
      <Suspense fallback={<div className="text-slate-500 text-sm">Memuat status pendaftaran...</div>}>
        <VerifikasiPendingContent />
      </Suspense>
    </div>
  );
}
