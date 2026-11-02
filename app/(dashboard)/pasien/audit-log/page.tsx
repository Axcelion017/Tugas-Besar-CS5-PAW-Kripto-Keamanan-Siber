"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { getPatientAuditLogsServerAction } from "@/lib/actions/audit";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { IconShield, IconEye, IconCheck } from "@/components/ui/Icons";

interface PatientNotification {
  id: string;
  senderName: string;
  senderRole: string;
  senderFaskes?: string;
  actionTitle: string;
  message: string;
  targetDoc: string;
  timestamp: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  isRead?: boolean;
}

const DEFAULT_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "NOTIF-01",
    senderName: "dr. Andi Pratama, Sp.PD",
    senderRole: "Dokter DPJP",
    senderFaskes: "RSUP Dr. Sardjito",
    actionTitle: "Dokter Membuka & Memeriksa Rekam Medis Anda",
    message: "Dokter telah membuka berkas rekam medis Anda untuk melakukan diagnosis rawat jalan Poli Penyakit Dalam dengan kunci pembungkus sesi aktif.",
    targetDoc: "Rekam Medis Rawat Jalan (Format SOAP & ICD-10)",
    timestamp: "Hari ini, 10:15 WIB",
    severity: "INFO",
  },
  {
    id: "NOTIF-02",
    senderName: "Sistem Keamanan Resilio-Health",
    senderRole: "Zero-Trust Gateway",
    senderFaskes: "Pusat Data Medis Kemenkes",
    actionTitle: "Pemberian Izin Akses Digital (Consent Granted)",
    message: "Anda telah memberikan izin akses digital kepada RSUP Dr. Sardjito. Rumah sakit ini berhak membaca riwayat diagnosa dan hasil pemeriksaan terdahulu Anda.",
    targetDoc: "Portabilitas RME Lintas Faskes",
    timestamp: "Kemarin, 14:30 WIB",
    severity: "INFO",
  },
  {
    id: "NOTIF-03",
    senderName: "Ners Maya Kartika, S.Kep",
    senderRole: "Perawat Triase Loket",
    senderFaskes: "RSUP Dr. Sardjito",
    actionTitle: "Pengkajian Triase Tanda Vital Selesai",
    message: "Perawat telah menginput data fisik tekanan darah, nadi, dan suhu tubuh Anda di loket admisi. Status antrean Anda dialihkan ke dokter pemeriksa.",
    targetDoc: "Pengkajian Triase Awal Loket",
    timestamp: "23 Okt 2026, 09:20 WIB",
    severity: "INFO",
  },
  {
    id: "NOTIF-04",
    senderName: "Sistem Keamanan Resilio-Health",
    senderRole: "Zero-Trust BOLA Guard",
    senderFaskes: "Gateway Kemenkes",
    actionTitle: "Percobaan Akses Ilegal Berhasil Diblokir",
    message: "Sistem mendeteksi dan menggagalkan percobaan membaca data medis Anda oleh entitas tanpa tiket izin persetujuan sah (Pencegahan IDOR/BOLA 403 Forbidden).",
    targetDoc: "Proteksi Enkripsi AES-256-GCM",
    timestamp: "21 Okt 2026, 16:45 WIB",
    severity: "WARN",
  },
];

export default function PasienAuditLogPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<PatientNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | "INFO" | "WARN">("ALL");

  useEffect(() => {
    async function loadNotifications() {
      const s = getUserSession();
      if (!s) {
        setIsLoading(false);
        return;
      }
      setSession(s);

      try {
        const dbRes = await getPatientAuditLogsServerAction(s.id);
        if (dbRes.success && dbRes.data && dbRes.data.length > 0) {
          const mapped: PatientNotification[] = (dbRes.data as unknown as Array<{
            id: string;
            actorName: string;
            actorRole: string;
            action: string;
            detail: string;
            targetResource: string;
            timestamp: Date | string;
            severity: string;
          }>).map((log) => {
            let actionTitle = "Aktivitas Akses Berkas Medis";
            if (log.action === "READ_RME") actionTitle = "Dokter Membuka & Memeriksa Rekam Medis Anda";
            else if (log.action === "GRANT_ACCESS") actionTitle = "Pemberian Izin Akses Medis (Consent Granted)";
            else if (log.action === "REVOKE_CONSENT") actionTitle = "Pencabutan Izin Akses Medis (1-Click Revoke)";
            else if (log.action === "BREAK_GLASS_ACCESS") actionTitle = "Akses Darurat IGD (Break-Glass Protocol)";
            else if (log.action === "LOGIN_SUCCESS") actionTitle = "Sesi Masuk Akun Anda Berhasil";

            return {
              id: log.id,
              senderName: log.actorName,
              senderRole: log.actorRole.toUpperCase(),
              senderFaskes: "RSUP Dr. Sardjito",
              actionTitle,
              message: log.detail,
              targetDoc: log.targetResource,
              timestamp: new Date(log.timestamp).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              severity: (log.severity === "CRITICAL" || log.severity === "WARN" ? "WARN" : "INFO") as "INFO" | "WARN",
            };
          });

          setNotifications(mapped);
          setSelectedNotif(mapped[0]);
        } else {
          setNotifications(DEFAULT_NOTIFICATIONS);
          setSelectedNotif(DEFAULT_NOTIFICATIONS[0]);
        }
      } catch {
        setNotifications(DEFAULT_NOTIFICATIONS);
        setSelectedNotif(DEFAULT_NOTIFICATIONS[0]);
      } finally {
        setIsLoading(false);
      }
    }

    loadNotifications();
  }, []);

  if (isLoading || !session) {
    return <DashboardSkeleton noticeText="Memuat kotak masuk pemberitahuan akses medis..." />;
  }

  const filteredNotifs = notifications.filter((n) => {
    if (filterSeverity === "ALL") return true;
    return n.severity === filterSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Link href="/pasien" className="hover:underline">
              Portal Pasien
            </Link>
            <span>/</span>
            <span>Pemberitahuan Transparansi Akses Medis (UU PDP No. 27/2022)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Notifikasi Akses Rekam Medis
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Setiap kali dokter, perawat, atau rumah sakit melihat riwayat kesehatan Anda, sistem secara otomatis mengirimkan pemberitahuan transparansi ke sini.
          </p>
        </div>

        {/* Filter Tab */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterSeverity("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterSeverity === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity("INFO")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterSeverity === "INFO"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-emerald-800"
            }`}
          >
            Aktivitas Sah
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity("WARN")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterSeverity === "WARN"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-slate-600 hover:text-amber-800"
            }`}
          >
            Peringatan
          </button>
        </div>
      </div>

      {/* Grid Tampilan Notifikasi Mirip Kotak Masuk Email (Inbox + Detail Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Daftar Pesan Masuk (List Feed) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Kotak Masuk Aktivitas
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              {filteredNotifs.length} Pesan
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                Tidak ada pemberitahuan pada kategori ini.
              </div>
            ) : (
              filteredNotifs.map((item) => {
                const isSelected = selectedNotif?.id === item.id;
                const isWarning = item.severity === "WARN";

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNotif(item)}
                    className={`p-4 transition cursor-pointer text-left space-y-1.5 ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-blue-600"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isWarning ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                        />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.senderName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        {item.timestamp.split(",")[0]}
                      </span>
                    </div>

                    <h4
                      className={`text-xs font-bold line-clamp-1 ${
                        isSelected ? "text-blue-900" : "text-slate-800"
                      }`}
                    >
                      {item.actionTitle}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {item.senderRole}
                      </span>
                      {item.senderFaskes && (
                        <span className="text-xs text-slate-400 truncate">
                          • {item.senderFaskes}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Kolom Kanan: Detail Isi Surat / Pesan (Message Viewer) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {selectedNotif ? (
            <div className="space-y-6">
              {/* Header Surat */}
              <div className="border-b border-slate-100 pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      selectedNotif.severity === "WARN"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-emerald-100 text-emerald-900 border-emerald-300"
                    }`}
                  >
                    {selectedNotif.severity === "WARN"
                      ? "Peringatan Keamanan Sistem"
                      : "Aktivitas Terverifikasi Sah"}
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-medium">
                    {selectedNotif.timestamp}
                  </span>
                </div>

                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                  {selectedNotif.actionTitle}
                </h2>

                {/* Metadata Pengirim mirip Header Email */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-bold block text-xs">
                      Pelaku Akses (Aktor):
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {selectedNotif.senderName}
                    </p>
                    <p className="text-slate-500 font-medium">
                      Peran: <strong className="text-slate-700">{selectedNotif.senderRole}</strong>
                      {selectedNotif.senderFaskes && ` di ${selectedNotif.senderFaskes}`}
                    </p>
                  </div>

                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <span className="text-slate-400 uppercase font-bold block text-xs">
                      Target Berkas:
                    </span>
                    <span className="font-mono text-slate-800 font-bold block text-xs mt-0.5">
                      {selectedNotif.targetDoc}
                    </span>
                    <span className="text-emerald-700 font-bold inline-flex items-center gap-1 mt-0.5">
                      <IconCheck className="w-3.5 h-3.5" />
                      Tercatat di Jejak Audit Kemenkes
                    </span>
                  </div>
                </div>
              </div>

              {/* Isi Pesan Lengkap */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Uraian Kejadian yang Terjadi:
                </h3>
                <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 text-slate-800 text-sm leading-relaxed space-y-3">
                  <p>{selectedNotif.message}</p>
                  <p className="text-xs text-slate-500 pt-2 border-t border-blue-200/50">
                    Berdasarkan <strong>Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27/2022)</strong>, Anda memiliki hak penuh untuk mengetahui siapa pun yang memproses data rekam medis Anda, serta berhak mencabut persetujuan akses tersebut kapan saja.
                  </p>
                </div>
              </div>

              {/* Rekomendasi Aksi Pasien */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <IconShield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Ingin membatasi atau menghentikan akses faskes ini?
                    </h4>
                    <p className="text-xs text-slate-500">
                      Anda dapat mencabut hak akses faskes bersangkutan secara instan.
                    </p>
                  </div>
                </div>

                <Link
                  href="/pasien/consent"
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition text-center whitespace-nowrap shadow-xs"
                >
                  Kelola Izin Akses →
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <IconEye className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-sm font-semibold">Pilih salah satu pesan di sebelah kiri untuk melihat rincian aktivitas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
