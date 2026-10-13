"use client";

import React from "react";

interface LogoutModalProps {
  isOpen: boolean;
  userName?: string; // Menghilangkan garis merah userName
  username?: string;
  name?: string;
  onClose: () => void;
  onConfirm: () => void;
  [key: string]: any; // Fleksibel untuk properti tambahan
}

export function LogoutModal({
  isOpen,
  userName,
  username,
  name,
  onClose,
  onConfirm,
}: LogoutModalProps) {
  if (!isOpen) return null;

  const displayName = userName || username || name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 font-black text-lg">
            !
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Konfirmasi Keluar</h3>
            <p className="text-xs text-slate-500 font-semibold">Sesi Kriptografi Anda</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-600 leading-relaxed mb-6">
          {displayName ? `Hai ${displayName}, apakah` : "Apakah"} Anda yakin ingin mengakhiri sesi kerja ini? Kunci sesi sementara akan dihapus dari peramban demi keamanan data medis.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-extrabold text-white shadow-md shadow-red-600/30 transition-all uppercase tracking-wider"
          >
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutModal;