"use client";

import React from "react";
import Link from "next/link";
import type { BerandaServerData } from "@/features/dashboard/queries";

const TONE_CLASS: Record<"emerald" | "blue" | "amber" | "purple", string> = {
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  amber: "text-amber-700",
  purple: "text-purple-700",
};

const ROLE_CONFIG = {
  nakes: {
    badge: "Stasiun Kerja Dokter DPJP",
    gradient: "from-slate-900 via-slate-800 to-emerald-950",
    primaryHref: "/nakes",
    primaryLabel: "Buka Stasiun Nakes →",
    shortcuts: [
      { href: "/nakes/jadwal", title: "Jadwal Praktik Mingguan", desc: "Kalender praktik lintas faskes (Senin–Minggu)." },
      { href: "/nakes/pasien-lookup", title: "Lookup NIK & Break-Glass", desc: "Pencarian pasien ber-guard BOLA/IDOR." },
      { href: "/nakes/offline-sync", title: "Antrean Offline IndexedDB", desc: "Sinkronisasi RME luring ke PostgreSQL." },
    ],
  },
  pasien: {
    badge: "Portal Mandiri Pasien",
    gradient: "from-slate-900 via-blue-950 to-slate-900",
    primaryHref: "/pasien",
    primaryLabel: "Buka Portal Pasien →",
    shortcuts: [
      { href: "/pasien/rekam-medis", title: "Rekam Medis Terenkripsi", desc: "Dekripsi mandiri RME dengan kunci privat Anda." },
      { href: "/pasien/booking", title: "Pesan Jadwal Faskes", desc: "Booking poliklinik + PIN 6-digit & auto-consent." },
      { href: "/pasien/consent", title: "Kontrol Izin UU PDP", desc: "Atur & cabut hak akses dokter/faskes seketika." },
    ],
  },
  staf: {
    badge: "Meja Staf Admisi & Triase",
    gradient: "from-slate-900 via-slate-800 to-cyan-950",
    primaryHref: "/staf",
    primaryLabel: "Buka Loket Admisi →",
    shortcuts: [
      { href: "/staf/triase", title: "Pengkajian Triase & TTV", desc: "Input tanda vital + peringatan klinis otomatis." },
      { href: "/staf/assign-dpjp", title: "Penugasan DPJP (PIN 6-Digit)", desc: "Validasi PIN pasien sebelum masuk ruang periksa." },
      { href: "/staf/rujukan", title: "Administrasi Rujukan", desc: "Kelola surat rujukan masuk & keluar faskes." },
    ],
  },
  admin: {
    badge: "Konsol Pengawas Regulator Kemenkes",
    gradient: "from-slate-950 via-slate-900 to-slate-800",
    primaryHref: "/admin",
    primaryLabel: "Buka Konsol Admin →",
    shortcuts: [
      { href: "/admin/siem-monitor", title: "SIEM Security Feed", desc: "Pantau BOLA/IDOR, HMAC_MISMATCH, & Break-Glass." },
      { href: "/admin/faskes", title: "Master Faskes & Kill-Switch", desc: "Isolasi darurat faskes terdampak insiden siber." },
      { href: "/admin/verifikasi-kyc", title: "Verifikasi e-KYC & e-KYD", desc: "Validasi identitas NIK pasien & STR/SIP dokter." },
    ],
  },
} as const;

export function BerandaClient({ data }: { data: BerandaServerData }) {
  const cfg = ROLE_CONFIG[data.role];
  const metricCards = [
    data.metrics.primary,
    data.metrics.secondary,
    data.metrics.tertiary,
    data.metrics.quaternary,
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header Sambutan Server-Rendered */}
      <div
        className={`bg-gradient-to-r ${cfg.gradient} text-white p-6 md:p-8 rounded-3xl shadow-sm space-y-3`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-emerald-300 border border-white/15">
            {cfg.badge}
          </span>
          <span className="font-mono text-[11px] text-emerald-300">
            Server Component • PostgreSQL 17 • AES-256-GCM + HKDF
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
          Selamat Datang, {data.session.name}
        </h1>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          Seluruh metrik dan jadwal di bawah ini dimuat langsung dari PostgreSQL melalui Next.js 16
          Server Components sesuai ruang lingkup peran <strong>{data.role.toUpperCase()}</strong>{" "}
          (Zero-Trust Least Privilege).
        </p>

        <div className="pt-2">
          <Link
            href={cfg.primaryHref}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition"
          >
            {cfg.primaryLabel}
          </Link>
        </div>
      </div>

      {/* 4 Kartu Metrik Real-Time dari PostgreSQL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <div key={m.label} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
            <span className={`text-[10px] font-black uppercase tracking-wider ${TONE_CLASS[m.tone]}`}>
              {m.label}
            </span>
            <p className="text-2xl font-black text-slate-900">{m.value}</p>
            <p className="text-[11px] text-slate-500">{m.caption}</p>
          </div>
        ))}
      </div>

      {/* Pintasan Modul Utama */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cfg.shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition space-y-1"
          >
            <h2 className="text-sm font-black text-slate-900">{s.title}</h2>
            <p className="text-xs text-slate-500">{s.desc}</p>
          </Link>
        ))}
      </div>

      {/* Tabel Data Operasional Sesuai Peran */}
      {data.role !== "admin" ? (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                {data.role === "pasien"
                  ? "Riwayat & Jadwal Kunjungan Terbaru"
                  : "Antrean Kunjungan Aktif (PostgreSQL)"}
              </h2>
              <p className="text-xs text-slate-500">
                Disinkronkan langsung dari tabel <code className="font-mono">appointments</code>.
              </p>
            </div>
            <Link
              href={cfg.primaryHref}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
            >
              Lihat Semua →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Pasien</th>
                  <th className="py-3 px-4">Faskes & Poli</th>
                  <th className="py-3 px-4">Triase / Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada antrean aktif tercatat di basis data.
                    </td>
                  </tr>
                ) : (
                  data.appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {apt.tanggal} • {apt.jam}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{apt.pasienNama}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {apt.faskesNama} — {apt.poli}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            apt.triaseLevel === "MERAH"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : apt.triaseLevel === "KUNING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {apt.triaseLevel} • {apt.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={
                            data.role === "nakes"
                              ? `/nakes/periksa/${apt.id}`
                              : data.role === "staf"
                              ? `/staf/triase?aptId=${apt.id}`
                              : "/pasien/booking"
                          }
                          className="inline-block px-3 py-1 bg-slate-900 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                        >
                          {data.role === "nakes"
                            ? "Periksa →"
                            : data.role === "staf"
                            ? "Triase →"
                            : "Detail →"}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              5 Event Keamanan SIEM Terbaru (PostgreSQL)
            </h2>
            <Link
              href="/admin/siem-monitor"
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Buka SIEM Lengkap →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentSecurityLogs.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">Belum ada log audit keamanan.</p>
            ) : (
              data.recentSecurityLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-black text-slate-900 mr-2">{log.action}</span>
                    <span className="text-slate-600">{log.detail}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
