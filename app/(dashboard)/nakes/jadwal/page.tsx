"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { getDoctorCalendarScheduleServerAction } from "@/lib/actions/clinical";

interface WeeklyAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientBloodType?: string;
  tanggal: string;
  jam: string;
  poli: string;
  keluhanAwal: string;
  status: string;
  triaseLevel: "MERAH" | "KUNING" | "HIJAU" | string;
  faskesName?: string;
}

function formatLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getMondayOfDate(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = copy.getDay(); // 0=Min, 1=Sen, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  copy.setDate(copy.getDate() + diffToMonday);
  return copy;
}

function buildDynamicWeekDays(weekOffset: number) {
  const now = new Date();
  const todayIso = formatLocalIsoDate(now);
  const monday = getMondayOfDate(now);
  monday.setDate(monday.getDate() + weekOffset * 7);

  const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  return dayNames.map((dayName, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateStr = formatLocalIsoDate(d);
    const isToday = dateStr === todayIso;
    const shortLabel = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return {
      dayName,
      dateStr,
      dateObj: d,
      label: isToday ? `${shortLabel} (Hari Ini)` : shortLabel,
      isToday,
    };
  });
}

export default function NakesJadwalMingguanPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [appointments, setAppointments] = useState<WeeklyAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFaskes, setSelectedFaskes] = useState("ALL");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    async function loadSchedule() {
      setIsLoading(true);
      const s = getUserSession();
      if (!s) {
        setIsLoading(false);
        return;
      }
      setSession(s);

      try {
        const res = await getDoctorCalendarScheduleServerAction(s.id);
        if (res.success && Array.isArray(res.appointments)) {
          setAppointments(res.appointments);
        } else {
          setAppointments([]);
        }
      } catch (err) {
        console.warn("Failed fetching calendar:", err);
        setAppointments([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSchedule();
  }, []);

  const availableFaskes = useMemo(() => {
    const set = new Set<string>();
    for (const apt of appointments) {
      if (apt.faskesName) set.add(apt.faskesName);
    }
    return Array.from(set).sort();
  }, [appointments]);

  const filteredAppointments = appointments.filter((apt) => {
    if (selectedFaskes === "ALL") return true;
    return apt.faskesName === selectedFaskes;
  });

  const weekDays = buildDynamicWeekDays(weekOffset);
  const weekDateSet = new Set(weekDays.map((d) => d.dateStr));
  const weekAppointmentsCount = filteredAppointments.filter((a) =>
    weekDateSet.has(a.tanggal.slice(0, 10))
  ).length;

  const weekStartLabel = weekDays[0].dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
  const weekEndLabel = weekDays[6].dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const jumpToNearestScheduledWeek = () => {
    if (filteredAppointments.length === 0) return;
    const firstDate = new Date(`${filteredAppointments[0].tanggal.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(firstDate.getTime())) return;
    const currentMonday = getMondayOfDate(new Date());
    const targetMonday = getMondayOfDate(firstDate);
    const diffWeeks = Math.round(
      (targetMonday.getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    setWeekOffset(diffWeeks);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <Link href="/nakes" className="hover:underline">
              Stasiun Nakes
            </Link>
            <span>/</span>
            <span>Jadwal Praktik Mingguan</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Jadwal Praktik Dokter Berbasis Kalender Mingguan
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Sinkron 100% dengan PostgreSQL dan{" "}
            <Link href="/nakes" className="text-emerald-700 font-bold hover:underline">
              Jadwal Hari Ini di Stasiun Nakes →
            </Link>
          </p>
        </div>

        {/* Filter Rumah Sakit & Navigasi Minggu Dinamis */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="px-2.5 py-1.5 rounded-lg font-bold text-slate-700 hover:bg-white cursor-pointer"
            >
              ← Minggu Lalu
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${
                weekOffset === 0
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-emerald-800 hover:bg-white"
              }`}
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="px-2.5 py-1.5 rounded-lg font-bold text-slate-700 hover:bg-white cursor-pointer"
            >
              Berikutnya →
            </button>
          </div>
          <label htmlFor="faskes-filter" className="text-xs font-bold text-slate-600">
            Rumah Sakit:
          </label>
          <select
            id="faskes-filter"
            value={selectedFaskes}
            onChange={(e) => setSelectedFaskes(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ALL">Semua Rumah Sakit Praktik ({appointments.length})</option>
            {availableFaskes.map((nama) => (
              <option key={nama} value={nama}>
                {nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Info jika pekan aktif kosong padahal ada jadwal pada pekan lain */}
      {!isLoading && weekAppointmentsCount === 0 && filteredAppointments.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-blue-900 font-semibold">
            Tidak ada jadwal pada pekan {weekStartLabel} – {weekEndLabel}, namun terdapat{" "}
            <strong>{filteredAppointments.length} jadwal</strong> pada pekan lain.
          </p>
          <button
            type="button"
            onClick={jumpToNearestScheduledWeek}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-black uppercase text-[11px] cursor-pointer shrink-0"
          >
            Lompat ke Pekan Jadwal Terdekat →
          </button>
        </div>
      )}

      {/* Legenda Skala Prioritas */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
        <span className="font-bold text-slate-600 uppercase text-[10px]">
          Skala Prioritas Triase Pasien:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span className="font-bold text-red-900 text-[11px]">
            P1 • MERAH (Gawat Darurat Segera)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-bold text-amber-900 text-[11px]">
            P2 • KUNING (Mendesak / Gejala Akut)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="font-bold text-emerald-900 text-[11px]">
            P3 • HIJAU (Non-Urgent / Rawat Jalan)
          </span>
        </div>
      </div>

      {/* GRID VISUAL JADWAL SEMINGGU (SENIN S.D. MINGGU) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="font-black text-xs text-slate-800 uppercase tracking-wider">
            Linimasa Praktik Mingguan ({session?.name || "Dokter DPJP"})
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-600">
            Pekan: {weekStartLabel} – {weekEndLabel} ({weekAppointmentsCount} Pasien)
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">
              Memuat jadwal praktik dokter dari PostgreSQL...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-100 min-h-[500px]">
            {weekDays.map((day) => {
              const dayApts = filteredAppointments.filter(
                (a) => a.tanggal === day.dateStr || a.tanggal.startsWith(day.dateStr)
              );

              return (
                <div
                  key={day.dateStr}
                  className={`flex flex-col ${day.isToday ? "bg-emerald-50/20" : "bg-white"}`}
                >
                  <div
                    className={`p-3 text-center border-b ${
                      day.isToday
                        ? "bg-emerald-600 text-white font-black"
                        : "bg-slate-50 text-slate-700 font-bold border-slate-100"
                    }`}
                  >
                    <p className="text-xs uppercase">{day.dayName}</p>
                    <span className="text-[10px] opacity-90">{day.label}</span>
                  </div>

                  <div className="p-2 space-y-2.5 flex-1">
                    {dayApts.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[10px] text-slate-400 italic py-8">
                        Tidak ada jadwal
                      </div>
                    ) : (
                      dayApts.map((apt) => {
                        const isRed = apt.triaseLevel === "MERAH";
                        const isYellow = apt.triaseLevel === "KUNING";

                        return (
                          <div
                            key={apt.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/nakes/periksa/${apt.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/nakes/periksa/${apt.id}`);
                              }
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs space-y-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                              isRed
                                ? "bg-red-50/90 border-red-300 hover:border-red-500"
                                : isYellow
                                ? "bg-amber-50/90 border-amber-300 hover:border-amber-500"
                                : "bg-emerald-50/90 border-emerald-300 hover:border-emerald-500"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-black font-mono text-slate-900 shadow-2xs">
                                {apt.jam}
                              </span>
                              {isRed ? (
                                <span className="w-2 h-2 rounded-full bg-red-600" />
                              ) : isYellow ? (
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              )}
                            </div>

                            <div>
                              <p className="font-black text-slate-900 text-xs truncate">
                                {apt.patientName}
                              </p>
                              <span className="text-[9px] font-mono text-slate-500 block">
                                {apt.patientMrn}
                              </span>
                            </div>

                            <span className="inline-block text-[9px] font-bold text-slate-700 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-full">
                              {apt.faskesName || "RSUP Dr. Sardjito"}
                            </span>

                            <p className="text-[10px] text-slate-600 line-clamp-2">
                              {apt.keluhanAwal}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
