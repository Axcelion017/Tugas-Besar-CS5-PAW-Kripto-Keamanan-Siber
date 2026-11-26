"use client";

import React from "react";

interface ToastBannerProps {
  message: string | null;
  type?: "success" | "error" | "info";
  onDismiss?: () => void;
}

/**
 * Floating Toast Aksesibel (WCAG 2.1 SC 4.1.3 Status Messages)
 * Tetap terlihat di sudut kanan bawah viewport sehingga umpan balik tidak pernah tergulir keluar layar.
 */
export function ToastBanner({ message, type = "info", onDismiss }: ToastBannerProps) {
  if (!message) return null;

  const isError = type === "error";
  const colorClasses = isError
    ? "bg-red-50 border-red-300 text-red-950"
    : type === "success"
    ? "bg-emerald-50 border-emerald-300 text-emerald-950"
    : "bg-slate-900 border-slate-700 text-white";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`fixed bottom-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] p-4 rounded-2xl border shadow-xl flex items-start justify-between gap-3 text-xs font-bold ${colorClasses}`}
    >
      <p className="leading-relaxed">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="p-1 rounded-lg opacity-75 hover:opacity-100 transition cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
