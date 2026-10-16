"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_KYC_REQUESTS,
  MOCK_KYD_REQUESTS,
  MOCK_SECURITY_LOGS,
  MOCK_TROUBLE_TICKETS,
  MOCK_FASKES,
  getStorageData,
  KycSubmission,
  KydSubmission,
  SecurityAuditLog,
  TroubleTicket,
  Faskes,
} from "@/lib/db/mockData";

export default function AdminOverviewPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [kycPending, setKycPending] = useState(0);
  const [kydPending, setKydPending] = useState(0);
  const [securityEvents, setSecurityEvents] = useState<SecurityAuditLog[]>([]);
  const [troubles, setTroubles] = useState<TroubleTicket[]>([]);
  const [faskesList, setFaskesList] = useState<Faskes[]>([]);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const kyc = getStorageData<KycSubmission[]>("resilio_kyc_list", MOCK_KYC_REQUESTS);
      setKycPending(kyc.filter((k) => k.status === "PENDING").length);

      const kyd = getStorageData<KydSubmission[]>("resilio_kyd_list", MOCK_KYD_REQUESTS);
      setKydPending(kyd.filter((k) => k.status === "PENDING").length);

      const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
      setSecurityEvents(logs);

      const tcks = getStorageData<TroubleTicket[]>("resilio_trouble_tickets", MOCK_TROUBLE_TICKETS);
      setTroubles(tcks.filter((t) => t.status !== "RESOLVED"));

      const fas = getStorageData<Faskes[]>("resilio_faskes_list", MOCK_FASKES);
      setFaskesList(fas);
    }
  }, []);

  if (!session) return null;

  const idorCount = securityEvents.filter((e) => e.action === "IDOR_BLOCKED").length;
  const quarantinedFaskesCount = faskesList.filter((f) => f.status === "QUARANTINED").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            Konsol Pengawas Regulasi & Sistem Informasi Medis Nasional
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Dasbor Eksekutif Administrator
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Kementerian Kesehatan RI • Menegakkan UU PDP No. 27/2022 & Permenkes No. 24/2022.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/siem-monitor"
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
          >
            SIEM Security Feed
          </Link>
          <Link
            href="/admin/faskes"
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-300 shadow-xs transition"
          >
            Kill-Switch Faskes
          </Link>
        </div>
      </div>

      {/* Metrik Operasional Utama */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Antrean KYC Pasien (KTP)
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">{kycPending}</p>
          <Link href="/admin/verifikasi-kyc" className="text-[11px] text-blue-600 font-bold hover:underline">
            Tinjau Berkas →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-purple-600 tracking-wider">
            Verifikasi Nakes (STR/SIP)
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">{kydPending}</p>
          <Link href="/admin/verifikasi-kyd" className="text-[11px] text-purple-600 font-bold hover:underline">
            Validasi Lisensi →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-red-600 tracking-wider">
            Anomali Serangan (BOLA/IDOR)
          </p>
          <p className="text-2xl font-black text-red-700 mt-1">{idorCount} Kasus</p>
          <span className="text-[10px] text-red-500 font-bold">Diblokir Otomatis</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
            Faskes Terisolasi (Kill-Switch)
          </p>
          <p className="text-2xl font-black text-amber-700 mt-1">{quarantinedFaskesCount} Faskes</p>
          <Link href="/admin/faskes" className="text-[11px] text-amber-700 font-bold hover:underline">
            Kelola Status →
          </Link>
        </div>
      </div>

      {/* Dua Kolom: Live SIEM Feed Ringkas & Tiket Insiden */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Security Feed */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">
              Live Security Event Monitor (SIEM Lite)
            </h2>
            <Link href="/admin/siem-monitor" className="text-xs font-bold text-red-600 hover:underline">
              Buka Penuh →
            </Link>
          </div>

          <div className="space-y-2.5">
            {securityEvents.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.2 rounded font-mono ${
                        log.severity === "CRITICAL"
                          ? "bg-red-200 text-red-900"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {log.action}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold mt-1">{log.detail}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {log.ipAddress}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pusat Kendala & Trouble Ticket */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">
              Tiket Kendala Pengguna & Masalah Sinkronisasi
            </h2>
            <Link href="/admin/incident-center" className="text-xs font-bold text-blue-600 hover:underline">
              Kelola Insiden →
            </Link>
          </div>

          <div className="space-y-2.5">
            {troubles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Semua tiket kendala telah terselesaikan.
              </p>
            ) : (
              troubles.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{t.judul}</span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        t.status === "OPEN"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Pengirim: <strong>{t.pengirimNama}</strong> ({t.pengirimRole})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
