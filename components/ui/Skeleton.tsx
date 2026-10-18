"use client";

import React from "react";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`shimmer-effect rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

// Banner Pemberitahuan Gangguan Jaringan / Sinkronisasi
export function SkeletonDisruptionNotice({
  message = "Terdeteksi gangguan koneksi ke server pusat. Mengalihkan ke cache lokal terenkripsi (IndexedDB Resilience Engine)...",
}: {
  message?: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs animate-fade-in">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
        <span className="font-semibold">{message}</span>
      </div>
      <span className="text-[10px] font-mono font-bold uppercase bg-amber-200/80 px-2 py-0.5 rounded text-amber-900 whitespace-nowrap">
        Offline-First Fallback
      </span>
    </div>
  );
}

// Shimmer Placeholder untuk Kartu Statistik / Ringkasan
export function SkeletonStatCard() {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  );
}

// Shimmer Placeholder untuk Kartu Rekam Medis / Pemeriksaan
export function SkeletonRecordCard() {
  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-4">
        <Skeleton className="h-3 w-60" />
        <Skeleton className="h-3 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-slate-50 rounded-xl space-y-2">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className="p-3 bg-slate-50 rounded-xl space-y-2">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
    </div>
  );
}

// Shimmer Placeholder untuk Tabel Data
export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="p-6 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50/60"
          >
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Shimmer Komprehensif untuk Dashboard saat Memuat Data / Gangguan Koneksi
export function DashboardSkeleton({
  showNotice = true,
  noticeText,
}: {
  showNotice?: boolean;
  noticeText?: string;
}) {
  return (
    <div className="space-y-8 animate-fade-in" aria-busy="true">
      {/* Disruption Alert Shimmer */}
      {showNotice && <SkeletonDisruptionNotice message={noticeText} />}

      {/* Header Profile Shimmer */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Stat Cards Shimmer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Main Content Area Shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonRecordCard />
          <SkeletonRecordCard />
        </div>
        <div className="space-y-4">
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
