"use client";

import React, { useEffect, useId, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  badge?: string;
  tone?: "default" | "danger" | "warning";
  children: React.ReactNode;
}

/**
 * Komponen Modal Aksesibel berstandar WCAG 2.1 Level AA:
 * - role="dialog", aria-modal="true", aria-labelledby
 * - Tutup via tombol Escape & light-dismiss backdrop
 * - Fokus otomatis ke dialog & pemulihan fokus ke elemen pemicu saat ditutup
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  badge,
  tone = "default",
  children,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      prevFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const borderClass =
    tone === "danger"
      ? "border-red-200"
      : tone === "warning"
      ? "border-amber-200"
      : "border-slate-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border ${borderClass} space-y-4 outline-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {badge && (
              <span
                className={`inline-block text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  tone === "danger"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : tone === "warning"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {badge}
              </span>
            )}
            <h2 id={titleId} className="text-lg font-black text-slate-900 tracking-tight">
              {title}
            </h2>
            {description && <p className="text-xs text-slate-600 leading-relaxed">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog (Tekan Escape)"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger" | "warning";
  isBusy?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  tone = "danger",
  isBusy = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description} tone={tone}>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isBusy}
          className={`px-4 py-2 rounded-xl text-white text-xs font-black uppercase tracking-wider transition cursor-pointer disabled:opacity-50 ${
            tone === "danger"
              ? "bg-red-600 hover:bg-red-700"
              : tone === "warning"
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-slate-900 hover:bg-black"
          }`}
        >
          {isBusy ? "Memproses..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
