"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_SECURITY_LOGS,
  getStorageData,
  setStorageData,
  SecurityAuditLog,
} from "@/lib/db/mockData";

function generateSiemLogId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function SiemMonitorPage() {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "INFO" | "WARN" | "CRITICAL">("ALL");

  useEffect(() => {
    const timer = setTimeout(() => {
      const all = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
      setLogs(all);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulateAttack = (type: "IDOR" | "HMAC" | "BREAK_GLASS") => {
    const current = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
    let newEvent: SecurityAuditLog;

    if (type === "IDOR") {
      newEvent = {
        id: generateSiemLogId("LOG-IDOR"),
        timestamp: new Date().toLocaleString("id-ID"),
        actorId: "ACTOR-UNAUTH-77",
        actorName: "dr. Ilegal Sp.An",
        actorRole: "NAKES",
        action: "IDOR_BLOCKED",
        targetResource: "/api/rme/record-P102-09",
        ipAddress: "103.145.22.11 (External Probe)",
        userAgent: "curl/8.1.2 (Security Scanner)",
        severity: "CRITICAL",
        detail: "BOLA Guard: Memblokir percobaan akses langsung rekam medis pasien P-102 tanpa consent atau sesi periksa aktif.",
      };
    } else if (type === "HMAC") {
      newEvent = {
        id: generateSiemLogId("LOG-HMAC"),
        timestamp: new Date().toLocaleString("id-ID"),
        actorId: "MALWARE-SIM",
        actorName: "Infected Gateway Process",
        actorRole: "GATEWAY",
        action: "HMAC_MISMATCH",
        targetResource: "/api/sync/batch",
        ipAddress: "192.168.10.88",
        userAgent: "Ransomware Tamper Agent",
        severity: "CRITICAL",
        detail: "Deteksi Kripto: Nilai HMAC-SHA256 korup pada transmisi payload rekam medis. Integritas gagal, sinkronisasi dibatalkan (Fail-Closed).",
      };
    } else {
      newEvent = {
        id: generateSiemLogId("LOG-BG"),
        timestamp: new Date().toLocaleString("id-ID"),
        actorId: "DOC-01",
        actorName: "dr. Andi Pratama, Sp.PD",
        actorRole: "NAKES",
        action: "BREAK_GLASS_ACCESS",
        targetResource: "/api/rme/break-glass/P-104",
        ipAddress: "192.168.1.42 (IGD Bed 01)",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        severity: "CRITICAL",
        detail: "BREAK-GLASS EMERGENCY ACCESS: Dokter membuka rekam medis darurat pasien Dewi Lestari tanpa consent. Alasan klinis: Pasien Koma Syok Anafilaktik. Notifikasi prioritas tinggi diteruskan ke Admin Kemenkes.",
      };
    }

    const updated = [newEvent, ...current];
    setStorageData("resilio_security_logs", updated);
    setLogs(updated);
  };

  const handleClearLogs = () => {
    setStorageData("resilio_security_logs", []);
    setLogs([]);
  };

  const filteredLogs = logs.filter((l) =>
    severityFilter === "ALL" ? true : l.severity === severityFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
          <Link href="/admin" className="hover:underline">
            Konsol Admin
          </Link>
          <span>/</span>
          <span>Security Information & Event Management (UR-A04)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          SIEM Live Security Feed & Deteksi Serangan Siber
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Pemantauan real-time pelanggaran otorisasi BOLA/IDOR, kegagalan integritas kriptografi HMAC, dan anomali akses terhadap data rekam medis pasien.
        </p>
      </div>

      {/* Kontrol & Simulasi Serangan */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase mr-1">
              Filter Tingkat Bahaya:
            </span>
            {(["ALL", "CRITICAL", "WARN", "INFO"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  severityFilter === sev
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSimulateAttack("IDOR")}
              className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl text-xs font-bold transition cursor-pointer border border-red-300"
            >
              Uji Serangan BOLA / IDOR
            </button>
            <button
              onClick={() => handleSimulateAttack("HMAC")}
              className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer border border-amber-300"
            >
              Uji HMAC Mismatch
            </button>
            <button
              onClick={() => handleSimulateAttack("BREAK_GLASS")}
              className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-bold transition cursor-pointer border border-purple-300"
            >
              Uji Break-Glass IGD
            </button>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="text-xs text-slate-400 hover:text-red-600 font-bold ml-2 cursor-pointer"
              >
                Bersihkan Log
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabel SIEM */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Security Event Audit Stream ({filteredLogs.length} Acara)
          </h2>
          <span className="text-xs font-mono font-bold text-emerald-700">
            Gateway Sensor Online
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Waktu</th>
                <th className="p-4">Action Event</th>
                <th className="p-4">Aktor Pengakses</th>
                <th className="p-4">Resource Target</th>
                <th className="p-4">IP & User Agent</th>
                <th className="p-4">Tingkat</th>
                <th className="p-4">Detail Kejadian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((item) => {
                const isCrit = item.severity === "CRITICAL";
                const isWarn = item.severity === "WARN";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/50 transition ${
                      isCrit ? "bg-red-50/50 text-red-900" : ""
                    }`}
                  >
                    <td className="p-4 text-slate-500 whitespace-nowrap text-[11px]">
                      {item.timestamp}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isCrit
                            ? "bg-red-200 text-red-900"
                            : isWarn
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="p-4 font-sans font-bold text-slate-900">
                      {item.actorName} ({item.actorRole})
                    </td>
                    <td className="p-4 text-slate-600 text-[11px]">{item.targetResource}</td>
                    <td className="p-4 text-slate-500 text-[10px] max-w-xs truncate">
                      {item.ipAddress} • {item.userAgent}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isCrit
                            ? "bg-red-600 text-white"
                            : isWarn
                            ? "bg-amber-500 text-white"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="p-4 font-sans text-xs text-slate-800 max-w-md">
                      {item.detail}
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
