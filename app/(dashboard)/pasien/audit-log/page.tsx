"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_SECURITY_LOGS,
  getStorageData,
  SecurityAuditLog,
} from "@/lib/db/mockData";

export default function PasienAuditLogPage() {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const all = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
      setLogs(all);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <span>Transparansi Audit Log Keamanan (UR-P07)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Jejak Audit Keamanan Pribadi (Audit Trail)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Sesuai prinsip transparansi data medis nasional: Rekaman setiap kejadian akses, pembacaan diagnosa, pencabutan izin, hingga percobaan akses terlarang terhadap rekam medis Anda.
        </p>
      </div>

      {/* Tabel Audit Log */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">
              Riwayat Akses Terverifikasi Sistem
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} Kejadian Tercatat
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Waktu Kejadian</th>
                <th className="p-4">Aktor Pengakses</th>
                <th className="p-4">Tindakan / Event</th>
                <th className="p-4">Target Resource</th>
                <th className="p-4">Tingkat Keamanan</th>
                <th className="p-4">Detail Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {logs.map((log) => {
                const isCritical = log.severity === "CRITICAL";
                const isWarn = log.severity === "WARN";

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-50/50 transition ${
                      isCritical ? "bg-red-50/40 text-red-900" : ""
                    }`}
                  >
                    <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-[11px]">{log.targetResource}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isCritical
                            ? "bg-red-200 text-red-900"
                            : isWarn
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="p-4 font-sans text-xs text-slate-700">
                      {log.detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
