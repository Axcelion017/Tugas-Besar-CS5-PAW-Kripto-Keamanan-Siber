"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_TROUBLE_TICKETS,
  getStorageData,
  setStorageData,
  TroubleTicket,
} from "@/lib/db/mockData";

export default function IncidentCenterPage() {
  const [tickets, setTickets] = useState<TroubleTicket[]>([]);
  const [filterKategori, setFilterKategori] = useState<string>("ALL");
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const list = getStorageData<TroubleTicket[]>("resilio_trouble_tickets", MOCK_TROUBLE_TICKETS);
      setTickets(list);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdateStatus = (
    ticketId: string,
    nextStatus: "OPEN" | "INVESTIGATING" | "RESOLVED"
  ) => {
    const all = getStorageData<TroubleTicket[]>("resilio_trouble_tickets", MOCK_TROUBLE_TICKETS);
    const updated = all.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t));
    setStorageData("resilio_trouble_tickets", updated);
    setTickets(updated);

    setNotif(`Status tiket ${ticketId} berhasil diperbarui menjadi ${nextStatus}.`);
    setTimeout(() => setNotif(null), 3000);
  };

  const filtered = tickets.filter((t) =>
    filterKategori === "ALL" ? true : t.kategori === filterKategori
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
          <span>Observabilitas & Pusat Kendala (UR-A05)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pusat Penanganan Trouble Sinkronisasi & Tiket Masalah Pengguna
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Dashboard observabilitas teknis: Memisahkan metadata error sinkronisasi dari isi rekam medis klinis (Admin tidak dapat melihat data penyakit).
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Ringkasan Failed Sync Queue & Kendala */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black uppercase text-amber-600">
            Antrean Gagal Sinkron (Failed Sync Queue)
          </span>
          <p className="text-2xl font-black text-slate-900">0 Batch Kritis</p>
          <p className="text-xs text-slate-500">
            Koneksi database PostgreSQL pusat & Web Crypto API sinkron normal.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black uppercase text-blue-600">
            Tiket Sedang Diinvestigasi
          </span>
          <p className="text-2xl font-black text-blue-700">
            {tickets.filter((t) => t.status === "INVESTIGATING").length} Tiket
          </p>
          <p className="text-xs text-slate-500">Dalam penanganan tim teknis Kemenkes.</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-black uppercase text-emerald-600">
            Tiket Berhasil Diselesaikan
          </span>
          <p className="text-2xl font-black text-emerald-700">
            {tickets.filter((t) => t.status === "RESOLVED").length} Tiket
          </p>
          <p className="text-xs text-slate-500">Terselesaikan secara tuntas.</p>
        </div>
      </div>

      {/* Filter Kategori */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2">
              Filter Kategori:
            </span>
            {["ALL", "SYNC_FAIL", "DATA_MISMATCH", "BUG"].map((kat) => (
              <button
                key={kat}
                onClick={() => setFilterKategori(kat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterKategori === kat
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {kat === "ALL"
                  ? "Semua"
                  : kat === "SYNC_FAIL"
                  ? "Gagal Sinkron"
                  : kat === "DATA_MISMATCH"
                  ? "Salah Data"
                  : "Bug Tampilan"}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {filtered.length} Tiket Ditampilkan
          </span>
        </div>
      </div>

      {/* Daftar Tiket Kendala */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
            Tidak ada tiket kendala dalam kategori ini.
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-700">
                    {t.id}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {t.kategori}
                  </span>
                  {t.faskesTerkait && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {t.faskesTerkait}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
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
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">{t.judul}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {t.deskripsi}
                </p>
                <p className="text-[10px] text-slate-400 mt-2 font-mono">
                  Pengirim: <strong>{t.pengirimNama}</strong> ({t.pengirimRole}) • {t.createdAt}
                </p>
              </div>

              {/* Action Update Status */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {t.status !== "INVESTIGATING" && t.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleUpdateStatus(t.id, "INVESTIGATING")}
                    className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                  >
                    Mulai Investigasi
                  </button>
                )}
                {t.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleUpdateStatus(t.id, "RESOLVED")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                  >
                    Tandai Selesai (Resolve)
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
