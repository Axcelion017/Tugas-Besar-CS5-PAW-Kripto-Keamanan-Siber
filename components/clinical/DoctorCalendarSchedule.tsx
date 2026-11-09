"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface CalendarAppointmentItem {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientBloodType?: string;
  tanggal: string; // YYYY-MM-DD
  jam: string; // e.g. "08:30 - 09:15 WIB" or "09:00 WIB"
  poli: string;
  keluhanAwal: string;
  status: string;
  triaseLevel: "MERAH" | "KUNING" | "HIJAU" | string;
  vitals?: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    temperature?: number;
    spo2?: number;
  } | null;
}

interface DoctorCalendarScheduleProps {
  appointments: CalendarAppointmentItem[];
  doctorId?: string;
}

export function DoctorCalendarSchedule({
  appointments,
}: DoctorCalendarScheduleProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState("2026-10-15");
  const [viewMode, setViewMode] = useState<"TIMELINE" | "GRID">("TIMELINE");

  // Filter jadwal berdasarkan tanggal yang dipilih
  const dayAppointments = appointments.filter((apt) => {
    return apt.tanggal === selectedDate || apt.tanggal.startsWith(selectedDate);
  });

  // Urutan slot jam untuk visual timeline
  const timeSlots = [
    { label: "08:00 WIB", startMin: 480 },
    { label: "09:00 WIB", startMin: 540 },
    { label: "10:00 WIB", startMin: 600 },
    { label: "11:00 WIB", startMin: 660 },
    { label: "12:00 WIB", startMin: 720 },
    { label: "13:00 WIB", startMin: 780 },
    { label: "14:00 WIB", startMin: 840 },
    { label: "15:00 WIB", startMin: 900 },
    { label: "16:00 WIB", startMin: 960 },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-6">
      {/* Header Navigasi Kalender */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Jadwal Praktik Dokter Poliklinik
            </span>
            <span className="text-xs font-mono text-slate-400">
              {dayAppointments.length} Pasien Terjadwal
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Kalender Jadwal Pelayanan & Alokasi Waktu
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Visualisasi jam mulai, jam selesai, durasi konsultasi, dan skala prioritas kegawatan pasien.
          </p>
        </div>

        {/* Pemilihan Tanggal & Mode Tampilan */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDate("2026-10-15")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                selectedDate === "2026-10-15"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              15 Okt (Hari Ini)
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate("2026-10-16")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                selectedDate === "2026-10-16"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              16 Okt (Besok)
            </button>
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("TIMELINE")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === "TIMELINE"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Garis Waktu (Timeline)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("GRID")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === "GRID"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Daftar Blok
            </button>
          </div>
        </div>
      </div>

      {/* Legenda Skala Prioritas */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
        <span className="font-bold text-slate-600 uppercase text-[10px]">
          Legenda Skala Prioritas:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
          <span className="font-bold text-red-900 text-[11px]">P1 • MERAH (Gawat Darurat / 10-15 Mnt)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-bold text-amber-900 text-[11px]">P2 • KUNING (Mendesak / 30-45 Mnt)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="font-bold text-emerald-900 text-[11px]">P3 • HIJAU (Non-Urgent / Rawat Jalan)</span>
        </div>
      </div>

      {/* TAMPILAN 1: GARIS WAKTU VISUAL (TIMELINE VIEW) */}
      {viewMode === "TIMELINE" && (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {timeSlots.map((slot) => {
              // Cari appointments yang berada di rentang jam ini
              const matchingApts = dayAppointments.filter((apt) => {
                const jamStr = apt.jam || "";
                const hourStr = jamStr.slice(0, 2);
                const slotHour = slot.label.slice(0, 2);
                return hourStr === slotHour;
              });

              return (
                <div key={slot.label} className="flex flex-col sm:flex-row items-stretch min-h-[90px]">
                  {/* Kolom Jam Mulai */}
                  <div className="w-28 bg-slate-50 p-4 border-r border-slate-100 flex flex-col justify-start shrink-0">
                    <span className="text-xs font-black font-mono text-slate-700">
                      {slot.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Alokasi Sesi
                    </span>
                  </div>

                  {/* Area Visual Blok Jadwal Pasien */}
                  <div className="flex-1 p-3 flex flex-col gap-2.5 bg-white">
                    {matchingApts.length === 0 ? (
                      <div className="h-full flex items-center text-[11px] text-slate-300 italic pl-2">
                        Slot Waktu Terbuka / Istirahat
                      </div>
                    ) : (
                      matchingApts.map((apt) => {
                        const triase = apt.triaseLevel;
                        const isRed = triase === "MERAH";
                        const isYellow = triase === "KUNING";

                        return (
                          <div
                            key={apt.id}
                            onClick={() => router.push(`/nakes/pasien-lookup/${apt.patientId}`)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              isRed
                                ? "bg-red-50/80 border-red-300 hover:bg-red-100/90"
                                : isYellow
                                ? "bg-amber-50/80 border-amber-300 hover:bg-amber-100/90"
                                : "bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/90"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Jam Mulai dan Jam Selesai Terlihat Jelas */}
                                <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-white text-slate-900 border border-slate-200 shadow-2xs">
                                  {apt.jam}
                                </span>

                                {/* Skala Prioritas Warna Tegas */}
                                {isRed ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    P1 • MERAH (Gawat Darurat)
                                  </span>
                                ) : isYellow ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                    P2 • KUNING (Mendesak)
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                                    P3 • HIJAU (Non-Urgent)
                                  </span>
                                )}

                                <span className="text-[10px] font-mono font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded">
                                  {apt.patientMrn}
                                </span>
                              </div>

                              <div className="pt-0.5">
                                <h4 className="text-base font-black text-slate-900">
                                  {apt.patientName}
                                </h4>
                                <p className="text-xs text-slate-600 font-medium">
                                  Keluhan: &quot;{apt.keluhanAwal}&quot; • Poli: {apt.poli}
                                </p>
                              </div>

                              {apt.vitals && (
                                <p className="text-[11px] font-mono text-slate-500 pt-0.5">
                                  TTV: Tensi {apt.vitals.systolic}/{apt.vitals.diastolic} mmHg | Nadi {apt.vitals.heartRate} bpm | SpO2 {apt.vitals.spo2}%
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Link
                                href={`/nakes/pasien-lookup/${apt.patientId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-xs"
                              >
                                Buka Rekam Medis →
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAMPILAN 2: DAFTAR KARTU BLOK WAKTU (GRID VIEW) */}
      {viewMode === "GRID" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dayAppointments.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-slate-400 text-xs font-medium">
              Tidak ada jadwal janji temu pada tanggal ini.
            </div>
          ) : (
            dayAppointments.map((apt) => {
              const isRed = apt.triaseLevel === "MERAH";
              const isYellow = apt.triaseLevel === "KUNING";

              return (
                <div
                  key={apt.id}
                  onClick={() => router.push(`/nakes/pasien-lookup/${apt.patientId}`)}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-xs space-y-3 ${
                    isRed
                      ? "bg-red-50/70 border-red-300 hover:border-red-400"
                      : isYellow
                      ? "bg-amber-50/70 border-amber-300 hover:border-amber-400"
                      : "bg-emerald-50/70 border-emerald-300 hover:border-emerald-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Alokasi Waktu Visual Mulai - Selesai */}
                    <span className="px-3 py-1 bg-white text-slate-900 border border-slate-200 rounded-xl font-mono font-black text-xs shadow-2xs">
                      {apt.jam}
                    </span>

                    {isRed ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                        P1 • MERAH
                      </span>
                    ) : isYellow ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                        P2 • KUNING
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                        P3 • HIJAU
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-slate-900">{apt.patientName}</h4>
                    <p className="text-xs text-slate-500 font-mono">
                      No. RM: {apt.patientMrn} • Poli: {apt.poli}
                    </p>
                    <p className="text-xs text-slate-700 font-medium mt-1">
                      Keluhan: {apt.keluhanAwal}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Status: {apt.status}
                    </span>
                    <span className="text-xs font-black text-slate-900 hover:underline">
                      Buka RME →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
