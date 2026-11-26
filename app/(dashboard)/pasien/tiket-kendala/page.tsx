"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { TroubleTicketSchema } from "@/lib/validations/patient";
import {
  createTroubleTicketServerAction,
  getTroubleTicketsServerAction,
} from "@/lib/actions/ticket";

type TicketCategory = "BUG" | "SYNC_FAIL" | "DATA_MISMATCH" | "OTHER";
type TicketStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

interface TicketRow {
  id: string;
  pengirimId: string;
  pengirimNama: string;
  kategori: TicketCategory;
  judul: string;
  deskripsi: string;
  status: TicketStatus;
  createdAt: string;
}

export default function PasienTiketKendalaPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [kategori, setKategori] = useState<TicketCategory>("DATA_MISMATCH");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTicketsFromDb = useCallback(async (user: UserSession) => {
    const ticketRes = await getTroubleTicketsServerAction();
    if (ticketRes.success && Array.isArray(ticketRes.data)) {
      const myTickets: TicketRow[] = (
        ticketRes.data as unknown as Array<{
          id: string;
          reporterId: string | null;
          reporterName: string;
          kategori: string;
          judul: string;
          deskripsi: string;
          status: string;
          createdAt: Date | string;
        }>
      )
        .filter((t) => !t.reporterId || t.reporterId === user.id)
        .map((t) => ({
          id: t.id,
          pengirimId: t.reporterId || user.id,
          pengirimNama: t.reporterName,
          kategori: (t.kategori as TicketCategory) || "OTHER",
          judul: t.judul,
          deskripsi: t.deskripsi,
          status:
            t.status === "RESOLVED"
              ? "RESOLVED"
              : t.status === "INVESTIGATING"
              ? "INVESTIGATING"
              : "OPEN",
          createdAt: new Date(t.createdAt).toLocaleString("id-ID"),
        }));
      setTickets(myTickets);
    } else {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const s = getUserSession();
        if (!s || !active) return;
        setSession(s);
        await loadTicketsFromDb(s);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [loadTicketsFromDb]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!session || isSubmitting) return;

    const validation = TroubleTicketSchema.safeParse({
      kategori,
      judul,
      deskripsi,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Data tiket tidak valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTroubleTicketServerAction({
        kategori,
        judul,
        deskripsi,
        reporterId: session.id,
        reporterName: session.name,
      });

      if (!res.success) {
        setErrorMsg(res.message || "Gagal mengirimkan tiket kendala ke basis data.");
        return;
      }

      await loadTicketsFromDb(session);
      setNotif("Laporan kendala berhasil disimpan di PostgreSQL dan dikirim ke Pusat Insiden Admin Regulator.");
      setJudul("");
      setDeskripsi("");
      setTimeout(() => setNotif(null), 4500);
    } finally {
      setIsSubmitting(false);
    }
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
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold"
        >
          {notif}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold"
        >
          {errorMsg}
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
              <label
                htmlFor="ticket-kategori"
                className="block text-xs font-bold text-slate-600 uppercase mb-1"
              >
                Kategori Kendala
              </label>
              <select
                id="ticket-kategori"
                value={kategori}
                onChange={(e) => setKategori(e.target.value as TicketCategory)}
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white disabled:opacity-60"
              >
                <option value="DATA_MISMATCH">Ketidaksesuaian Biodata / Rekam Medis</option>
                <option value="SYNC_FAIL">Kegagalan Sinkronisasi atau Dekripsi</option>
                <option value="BUG">Kerusakan Antarmuka / Tampilan (Bug Report)</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ticket-judul"
                className="block text-xs font-bold text-slate-600 uppercase mb-1"
              >
                Judul Laporan *
              </label>
              <input
                id="ticket-judul"
                type="text"
                required
                disabled={isSubmitting}
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Kesalahan ejaan nama pada kartu emergency..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="ticket-deskripsi"
                className="block text-xs font-bold text-slate-600 uppercase mb-1"
              >
                Deskripsi Lengkap Masalah *
              </label>
              <textarea
                id="ticket-deskripsi"
                required
                rows={4}
                disabled={isSubmitting}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Jelaskan secara kronologis kendala yang dialami, perangkat yang digunakan, dan faskes terkait..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              {isSubmitting ? "Mengirim ke PostgreSQL..." : "Kirim Tiket Laporan ke Admin"}
            </button>
          </form>
        </div>

        {/* Riwayat Tiket */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900">
            Riwayat Tiket Laporan Anda
          </h3>

          {isLoading ? (
            <p className="text-xs text-slate-500 text-center py-8">
              Memuat tiket laporan dari PostgreSQL...
            </p>
          ) : tickets.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
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
                    <span className="text-[10px] font-mono font-bold text-slate-600">
                      {t.id}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        t.status === "OPEN"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : t.status === "INVESTIGATING"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-900">{t.judul}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{t.deskripsi}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-medium">
                    <span>{t.kategori}</span>
                    <span>{t.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
