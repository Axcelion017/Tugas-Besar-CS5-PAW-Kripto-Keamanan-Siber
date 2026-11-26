"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { TroubleTicketSchema } from "@/lib/validations/patient";
import {
  createTroubleTicketServerAction,
  getTroubleTicketsServerAction,
} from "@/lib/actions/ticket";
import { ToastBanner } from "@/components/ui/ToastBanner";
import { IconMessageSquare, IconShield, IconRefreshCw, IconTool, IconFileText } from "@/components/ui/Icons";

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

const CATEGORY_OPTIONS: Array<{
  id: TicketCategory;
  label: string;
  desc: string;
  icon: typeof IconFileText;
}> = [
  {
    id: "DATA_MISMATCH",
    label: "Ketidaksesuaian Data",
    desc: "Biodata, NIK, atau catatan faskes tidak cocok",
    icon: IconFileText,
  },
  {
    id: "SYNC_FAIL",
    label: "Gagal Sinkron / Dekripsi",
    desc: "Berkas RME gagal dibuka atau belum tersinkron",
    icon: IconRefreshCw,
  },
  {
    id: "BUG",
    label: "Kendala Tampilan / Bug",
    desc: "Tombol tidak merespons atau tampilan rusak",
    icon: IconTool,
  },
  {
    id: "OTHER",
    label: "Laporan Lainnya",
    desc: "Keberatan akses, pertanyaan, atau bantuan umum",
    icon: IconMessageSquare,
  },
];

function getCategoryLabel(cat: TicketCategory): string {
  return CATEGORY_OPTIONS.find((c) => c.id === cat)?.label || "Lainnya";
}

function getStatusMeta(status: TicketStatus): { label: string; badgeClass: string; borderClass: string } {
  if (status === "RESOLVED") {
    return {
      label: "Terselesaikan",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      borderClass: "border-l-emerald-600",
    };
  }
  if (status === "INVESTIGATING") {
    return {
      label: "Sedang Diinvestigasi",
      badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
      borderClass: "border-l-blue-600",
    };
  }
  return {
    label: "Menunggu Respons",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    borderClass: "border-l-amber-500",
  };
}

export default function PasienTiketKendalaPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");
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
          createdAt: new Date(t.createdAt).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
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

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const investigatingCount = tickets.filter((t) => t.status === "INVESTIGATING").length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;

  const visibleTickets = tickets.filter((t) => {
    if (statusFilter === "ACTIVE") return t.status !== "RESOLVED";
    if (statusFilter === "RESOLVED") return t.status === "RESOLVED";
    return true;
  });

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
        setErrorMsg(res.message || "Gagal mengirimkan tiket kendala ke server.");
        return;
      }

      await loadTicketsFromDb(session);
      setNotif("Laporan kendala berhasil dikirim ke Pusat Insiden Admin Regulator.");
      setJudul("");
      setDeskripsi("");
      setStatusFilter("ALL");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <span>Laporan Kendala & Bantuan (UR-P08)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Layanan Pelaporan Kendala Teknis & Ketidaksesuaian Data
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          Sampaikan kendala aplikasi, ketidaksesuaian biodata, atau laporan keberatan akses langsung ke Admin Regulator Kemenkes.
        </p>
      </div>

      {/* 3 Kartu Ringkasan Status Tiket */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
            Menunggu Respons
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{openCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            Diinvestigasi
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{investigatingCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Terselesaikan
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{resolvedCount}</span>
        </div>
      </div>

      {/* Layout 12-Grid Seimbang: Form 6 Kolom | Riwayat 6 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulir Kirim Tiket */}
        <section className="lg:col-span-6 bg-white p-6 md:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900">Buat Tiket Laporan Baru</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih kategori yang paling sesuai agar tim regulator dapat menindaklanjuti lebih cepat.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pemilihan Kategori Berbasis Kartu */}
            <div>
              <span className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Kategori Kendala
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORY_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const active = kategori === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={active}
                      onClick={() => setKategori(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        active
                          ? "bg-blue-50/80 border-blue-500 text-blue-950"
                          : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <IconComp
                        size={16}
                        className={`mt-0.5 shrink-0 ${active ? "text-blue-700" : "text-slate-500"}`}
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-black">{opt.label}</span>
                        <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="ticket-judul" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Judul Singkat Laporan *
              </label>
              <input
                id="ticket-judul"
                type="text"
                required
                disabled={isSubmitting}
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Kesalahan ejaan nama pada profil atau rekam medis gagal dibuka"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="ticket-deskripsi" className="block text-xs font-bold text-slate-600 uppercase">
                  Kronologi & Detail Masalah *
                </label>
                <span className="text-[11px] font-mono text-slate-500">{deskripsi.length} karakter</span>
              </div>
              <textarea
                id="ticket-deskripsi"
                required
                rows={4}
                disabled={isSubmitting}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Jelaskan secara singkat kapan kendala terjadi, nama faskes terkait, dan pesan galat yang muncul..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            {/* Jaminan Privasi UU PDP */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
              <IconShield size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-800">Privasi Terjaga (UU PDP):</strong> Tiket kendala hanya memuat informasi teknis dan terpisah sepenuhnya dari isi rekam medis terenkripsi Anda.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              {isSubmitting ? "Mengirim Laporan..." : "Kirim Tiket Laporan ke Admin"}
            </button>
          </form>
        </section>

        {/* Riwayat Tiket Laporan */}
        <section className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50/80 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900">Riwayat Tiket Laporan Anda</h2>
              <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                {tickets.length} Laporan
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Semua ({tickets.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Aktif ({openCount + investigatingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("RESOLVED")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === "RESOLVED"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Selesai ({resolvedCount})
              </button>
            </div>
          </div>

          <div className="max-h-[580px] overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <p className="text-xs text-slate-500 text-center py-10 font-medium">
                Memuat tiket laporan Anda...
              </p>
            ) : visibleTickets.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  Belum ada tiket laporan pada filter ini.
                </p>
                <p className="text-xs text-slate-500">
                  Gunakan formulir di sebelah kiri apabila Anda menemui kendala teknis atau data.
                </p>
              </div>
            ) : (
              visibleTickets.map((t) => {
                const statusMeta = getStatusMeta(t.status);
                return (
                  <article
                    key={t.id}
                    className={`p-4 rounded-2xl bg-slate-50/70 border border-slate-200 border-l-4 ${statusMeta.borderClass} space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-600">{t.id}</span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900">{t.judul}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{t.deskripsi}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px] text-slate-500 font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                        {getCategoryLabel(t.kategori)}
                      </span>
                      <span>{t.createdAt}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <ToastBanner
        message={errorMsg || notif}
        type={errorMsg ? "error" : "success"}
        onDismiss={() => {
          setErrorMsg(null);
          setNotif(null);
        }}
      />
    </div>
  );
}
