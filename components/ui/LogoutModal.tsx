"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";

interface LogoutModalProps {
  isOpen: boolean;
  userName?: string;
  username?: string;
  name?: string;
  onClose: () => void;
  onConfirm: () => void;
  [key: string]: unknown;
}

export function LogoutModal({
  isOpen,
  userName,
  username,
  name,
  onClose,
  onConfirm,
}: LogoutModalProps) {
  const displayName = userName || username || name;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Keluar Sesi"
      badge="Sesi Kriptografi Zero-Trust"
      tone="danger"
      description={`${
        displayName ? `Hai ${displayName}, apakah` : "Apakah"
      } Anda yakin ingin mengakhiri sesi kerja ini? Token sesi persisten akan dicabut di server dan kunci sementara akan dibersihkan dari peramban.`}
    >
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-extrabold text-white shadow-md transition uppercase tracking-wider cursor-pointer"
        >
          Ya, Keluar
        </button>
      </div>
    </Modal>
  );
}

export default LogoutModal;
