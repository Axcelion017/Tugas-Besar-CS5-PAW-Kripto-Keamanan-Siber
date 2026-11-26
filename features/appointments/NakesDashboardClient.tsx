"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkeletonDisruptionNotice } from "@/components/ui/Skeleton";
import { DoctorCalendarSchedule } from "@/components/clinical/DoctorCalendarSchedule";
import type { NakesDashboardServerData } from "@/features/appointments/queries";

function formatLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function NakesDashboardClient({ data }: { data: NakesDashboardServerData }) {
  const router = useRouter();
  const { session, appointments } = data;
  const [isPracticing, setIsPracticing] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [dashboardView, setDashboardView] = useState<"KALENDER" | "ANTREAN">("KALENDER");

  useEffect(() => {
    const syncOffline = () => {
      const simulated = localStorage.getItem("resilio_network_mode") === "offline";
      const browserOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setIsOfflineMode(simulated || browserOffline);
    };
    const timer = setTimeout(syncOffline, 0);
    window.addEventListener("storage", syncOffline);
    window.addEventListener("online", syncOffline);
    window.addEventListener("offline", syncOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", syncOffline);
      window.removeEventListener("online", syncOffline);
      window.removeEventListener("offline", syncOffline);
    };
  }, []);

  const todayIso = formatLocalIsoDate(new Date());
  const todayAppointments = appointments.filter((a) => a.tanggal.startsWith(todayIso));

  const totalPatients = appointments.length;
  const inProgressCount = appointments.filter(
    (a) => a.status === "IN_PROGRESS" || a.status === "IN_EXAMINATION"
  ).length;
  const waitingCount = appointments.filter(
    (a) =>
      a.status === "WAITING" ||
      a.status === "PENDING_ARRIVAL" ||
      a.status === "WAITING_TRIAGE" ||
      a.status === "WAITING_DOCTOR"
  ).length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      {isOfflineMode && (
        <SkeletonDisruptionNotice message="Mode Offline Terdeteksi: Dokter tetap dapat menginput pemeriksaan klinis terenkripsi ke IndexedDB (resilio_offline_db)." />
      )}

      {/* Profil Dokter & Kontrol Praktik */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
              Stasiun Kerja Tenaga Kesehatan Terakreditasi
            </span>
            <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              STR/SIP Sah
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            {session.name}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {session.specialization || "Spesialis Penyakit Dalam"} •{" "}
            {session.faskesName || "RSUP Dr. Sardjito"}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1 break-words">
            Nomor STR:{" "}
            <span className="text-slate-700 font-bold">
              {session.strNumber || "31.1.1.100.2.22.123456"}
            </span>{" "}
            • Nomor SIP:{" "}
            <span className="text-slate-700 font-bold">
              {session.sipNumber || "446/SIP-D/2023/001"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <span
              className={`w-3 h-3 rounded-full ${
                isPracticing ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            <span className="text-xs font-bold text-slate-700">
              {isPracticing ? "Sesi Praktik Aktif" : "Praktik Selesai / Istirahat"}
            </span>
            <button
              type="button"
              onClick={() => setIsPracticing(!isPracticing)}
              className="text-xs font-bold uppercase px-3 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer ml-2"
            >
              Ubah
            </button>
          </div>

          <Link
            href="/nakes/pasien-lookup"
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
          >
            Lookup NIK Pasien
          </Link>
        </div>
      </div>

      {/* Ringkasan Statistik Antrean */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
            Jadwal Hari Ini / Total
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {todayAppointments.length} / {totalPatients}
          </p>
          <span className="text-[10px] text-slate-500">Pasien Terjadwal (PostgreSQL)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Pasien Menunggu
          </p>
          <p className="text-2xl font-black text-blue-700 mt-1">{waitingCount}</p>
          <span className="text-[10px] text-blue-600">Di Ruang Tunggu / Triase</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
            Sedang Diperiksa
          </p>
          <p className="text-2xl font-black text-amber-700 mt-1">{inProgressCount}</p>
          <span className="text-[10px] text-amber-600">Di Meja Konsultasi</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
            Pemeriksaan Selesai
          </p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{completedCount}</p>
          <span className="text-[10px] text-emerald-600">Rekam Medis Tersimpan</span>
        </div>
      </div>

      {/* Switcher Tampilan + Link Jadwal Mingguan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setDashboardView("KALENDER")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              dashboardView === "KALENDER"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Jadwal Berbasis Kalender Visual
          </button>
          <button
            type="button"
            onClick={() => setDashboardView("ANTREAN")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              dashboardView === "ANTREAN"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Daftar Antrean Meja Konsultasi
          </button>
        </div>

        <Link
          href="/nakes/jadwal"
          className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider transition"
        >
          Jadwal Praktik Mingguan →
        </Link>
      </div>

      {/* TAMPILAN 1: JADWAL KALENDER VISUAL */}
      {dashboardView === "KALENDER" && (
        <DoctorCalendarSchedule
          appointments={appointments.map((a) => ({
            id: a.id,
            patientId: a.pasienId,
            patientName: a.pasienNama,
            patientMrn: a.pasienMrn,
            patientBloodType: a.pasienBloodType,
            faskesName: a.faskesNama,
            tanggal: a.tanggal,
            jam: a.jam,
            poli: a.poli,
            keluhanAwal: a.keluhanAwal,
            status: a.status,
            triaseLevel: a.triaseLevel,
            vitals: a.triaseVitals,
          }))}
        />
      )}

      {/* TAMPILAN 2: DAFTAR ANTREAN PASIEN */}
      {dashboardView === "ANTREAN" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Antrean Pasien Rawat Jalan (PostgreSQL)
              </h2>
              <p className="text-xs text-slate-500">
                Data antrean dimuat langsung dari Server Component tanpa fallback mock lokal.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Hari Ini:{" "}
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          <div className="p-6 pt-0 space-y-4">
            {appointments.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-500">
                Tidak ada antrean pasien untuk jadwal praktik ini.
              </p>
            ) : (
              appointments.map((apt) => {
                const isActiveExam =
                  apt.status === "IN_PROGRESS" || apt.status === "IN_EXAMINATION";
                return (
                  <div
                    key={apt.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-slate-100/50"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-600">{apt.id}</span>
                        <span
                          className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            isActiveExam
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : apt.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}
                        >
                          {apt.status}
                        </span>
                        {apt.allergies.length > 0 && (
                          <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                            Alergi: {apt.allergies.join(", ")}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-900 mt-0.5">
                        {apt.pasienNama}{" "}
                        <span className="text-xs font-mono text-slate-500 font-semibold">
                          ({apt.pasienMrn})
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        Tanggal: <strong className="font-mono">{apt.tanggal}</strong> • Sesi:{" "}
                        <strong>{apt.jam}</strong> • {apt.faskesNama}
                      </p>
                      <p className="text-xs text-slate-600 italic bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200 inline-block mt-1">
                        Keluhan Awal: &quot;{apt.keluhanAwal}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/nakes/periksa/${apt.id}`)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer ${
                          apt.status !== "COMPLETED"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                        }`}
                      >
                        {apt.status === "COMPLETED"
                          ? "Lihat Berkas Rekam Medis"
                          : isActiveExam
                          ? "Lanjutkan Periksa"
                          : "Panggil & Periksa"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
