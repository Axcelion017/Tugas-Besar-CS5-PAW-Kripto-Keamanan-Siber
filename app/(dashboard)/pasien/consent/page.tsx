"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_ACCESS_GRANTS,
  MOCK_FASKES,
  MOCK_DOCTORS,
  MOCK_SECURITY_LOGS,
  getStorageData,
  setStorageData,
  AccessGrant,
  SecurityAuditLog,
} from "@/lib/db/mockData";

function generateConsentId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function ConsentManagerPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("DOC-02");
  const [validDays, setValidDays] = useState(7);
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getUserSession();
      if (s) {
        setSession(s);
        const all = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
        setGrants(all.filter((g) => g.pasienId === s.id || g.pasienId === "P-101"));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRevoke = (grantId: string, entityNama: string) => {
    const all = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const updated = all.map((g) => (g.id === grantId ? { ...g, isRevoked: true } : g));
    setStorageData("resilio_access_grants", updated);
    setGrants(updated.filter((g) => g.pasienId === session?.id || g.pasienId === "P-101"));

    // Tambahkan log audit siber
    const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
    const newLog: SecurityAuditLog = {
      id: generateConsentId("LOG"),
      timestamp: new Date().toLocaleString("id-ID"),
      actorId: session?.id || "P-101",
      actorName: session?.name || "Budi Santoso",
      actorRole: "PASIEN",
      action: "REVOKE_CONSENT",
      targetResource: `/api/consent/revoke/${grantId}`,
      ipAddress: "182.253.12.90 (Client IP)",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Client Browser",
      severity: "INFO",
      detail: `Pasien mencabut izin akses untuk ${entityNama} (1-Click Revoke UU PDP).`,
    };
    setStorageData("resilio_security_logs", [newLog, ...logs]);

    setNotif(`Izin akses untuk ${entityNama} berhasil dicabut seketika.`);
    setTimeout(() => setNotif(null), 4000);
  };

  const handleGrantNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    // Cari entitas apakah dokter atau faskes
    const doctor = MOCK_DOCTORS.find((d) => d.id === selectedEntityId);
    const faskes = MOCK_FASKES.find((f) => f.id === selectedEntityId);

    const entityNama = doctor ? doctor.name : faskes ? faskes.nama : "Entitas Kesehatan";
    const entityType = doctor ? "DOKTER" : "FASKES";

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Number(validDays));

    const newGrant: AccessGrant = {
      id: generateConsentId("GRANT"),
      pasienId: session.id,
      pasienNama: session.name,
      entityId: selectedEntityId,
      entityNama,
      entityType: entityType as "DOKTER" | "FASKES",
      scope: "Portabilitas RME Antar Faskes (1-Click Consent)",
      validUntil: expiryDate.toLocaleString("id-ID"),
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };

    const all = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const updated = [newGrant, ...all];
    setStorageData("resilio_access_grants", updated);
    setGrants(updated.filter((g) => g.pasienId === session.id || g.pasienId === "P-101"));

    setNotif(`Sukses: Izin akses RME resmi diberikan kepada ${entityNama} selama ${validDays} hari.`);
    setTimeout(() => setNotif(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <span>Kedaulatan Izin Akses (UR-P05 & UR-P07)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Manajemen Hak Akses Medis (Consent Control) & Perpindahan Faskes
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Sesuai <strong>UU Pelindungan Data Pribadi (UU PDP No. 27/2022)</strong>, Anda memiliki hak mutlak untuk membagikan atau mencabut hak dokter/faskes dalam membaca riwayat penyakit Anda kapan saja.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Formulir Berikan Akses Baru (Perpindahan Faskes) */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">
          Berikan Izin Akses Baru (Perpindahan Faskes / Rujukan Mandiri)
        </h2>
        <p className="text-xs text-slate-500">
          Saat Anda berpindah rumah sakit atau berkonsultasi ke spesialis baru, Anda tidak perlu membawa berkas fisik. Berikan izin di bawah ini agar dokter baru langsung dapat membaca riwayat RME terenkripsi Anda.
        </p>

        <form onSubmit={handleGrantNew} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Pilih Dokter / Faskes Tujuan
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
            >
              <optgroup label="Dokter Spesialis">
                {MOCK_DOCTORS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialty})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Fasilitas Kesehatan">
                {MOCK_FASKES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama} ({f.tipe})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Masa Berlaku Izin (Hari)
            </label>
            <select
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
            >
              <option value={1}>1 Hari (Konsultasi Singkat)</option>
              <option value={3}>3 Hari (Pemeriksaan Lanjutan)</option>
              <option value={7}>7 Hari (1 Minggu Perawatan)</option>
              <option value={30}>30 Hari (Rujukan Rawat Jalan)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              + Berikan Izin Digital
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Izin Aktif & Tombol Revoke */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">
            Daftar Izin Akses Aktif & Riwayat Pencabutan
          </h3>
          <span className="text-xs text-slate-500 font-semibold">
            Zero-Trust Gateway Enforcement
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Entitas Terotorisasi</th>
                <th className="p-4">Tipe</th>
                <th className="p-4">Cakupan Izin (Scope)</th>
                <th className="p-4">Berlaku Hingga</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grants.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-4 font-bold text-slate-900">{g.entityNama}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">
                      {g.entityType}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{g.scope}</td>
                  <td className="p-4 font-mono text-slate-500">{g.validUntil}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                        g.isRevoked
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {g.isRevoked ? "Dicabut (Revoked)" : "Aktif (Active)"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {!g.isRevoked ? (
                      <button
                        onClick={() => handleRevoke(g.id, g.entityNama)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer shadow-xs"
                      >
                        Cabut Izin (Revoke)
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold italic">
                        Akses Terkunci
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
