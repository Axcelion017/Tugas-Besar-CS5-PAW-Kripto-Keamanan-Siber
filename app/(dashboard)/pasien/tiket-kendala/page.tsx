"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_TROUBLE_TICKETS,
  getStorageData,
  setStorageData,
  TroubleTicket,
} from "@/lib/db/mockData";

export default function PasienTiketKendalaPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tickets, setTickets] = useState<TroubleTicket[]>([]);
  const [kategori, setKategori] = useState<"BUG" | "SYNC_FAIL" | "DATA_MISMATCH" | "OTHER">("DATA_MISMATCH");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const all = getStorageData<TroubleTicket[]>("resilio_trouble_tickets", MOCK_TROUBLE_TICKETS);
      setTickets(all.filter((t) => t.pengirimId === s.id || t.pengirimId === "P-101"));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (!judul.trim() || !deskripsi.trim()) {
      alert("Judul dan deskripsi kendala wajib diisi.");
      return;
    }

    const newTicket: TroubleTicket = {
      id: `TCK-${Date.now().toString().slice(-4)}`,
      pengirimId: session.id,
      pengirimNama: session.name,
      pengirimRole: "PASIEN",
      kategori,
      judul,
      deskripsi,
      status: "OPEN",
      createdAt: new Date().toLocaleString("id-ID"),
    };

    const all = getStorageData<TroubleTicket[]>("resilio_trouble_tickets", MOCK_TROUBLE_TICKETS);
    const updated = [newTicket, ...all];
    setStorageData("resilio_trouble_tickets", updated);
    setTickets(updated.filter((t) => t.pengirimId === session.id || t.pengirimId === "P-101"));

    setNotif("Laporan kendala berhasil dikirimkan ke Pusat Insiden Admin Regulator.");
    setJudul("");
    setDeskripsi("");
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
          <span>Pusat Kendala & Bantuan (UR-P08)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Layanan Pelaporan Kendala Teknis & Ketidaksesuaian Data
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Laporkan permasalahan sistem, kesalahan input data medis faskes, atau bug aplikasi langsung ke Administrator Regulator Kemenkes.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Kirim Tiket */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">
            Formulir Pembuatan Tiket Kendala Baru
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Kategori Kendala
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                <option value="DATA_MISMATCH">Ketidaksesuaian Biodata / Rekam Medis</option>
                <option value="SYNC_FAIL">Kegagalan Sinkronisasi atau Dekripsi</option>
                <option value="BUG">Kerusakan Antarmuka / Tampilan (Bug Report)</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Judul Laporan *
              </label>
              <input
                type="text"
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Kesalahan ejaan nama pada kartu emergency..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Deskripsi Lengkap Masalah *
              </label>
              <textarea
                required
                rows={4}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Jelaskan secara kronologis kendala yang dialami, perangkat yang digunakan, dan faskes terkait..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              Kirim Tiket Laporan ke Admin
            </button>
          </form>
        </div>

        {/* Riwayat Tiket */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900">
            Riwayat Tiket Laporan Anda
          </h3>

          {tickets.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              Belum ada tiket laporan kendala yang dibuat.
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      {t.id}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        t.status === "OPEN"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : t.status === "INVESTIGATING"
                          ? "bg-blue-100 text-blue-800 border-blue-200 animate-pulse"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">{t.judul}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t.deskripsi}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono pt-1">
                    {t.createdAt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
