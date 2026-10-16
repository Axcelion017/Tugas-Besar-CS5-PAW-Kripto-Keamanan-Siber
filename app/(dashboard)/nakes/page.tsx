"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  getStorageData,
  setStorageData,
  Appointment,
  Patient,
} from "@/lib/db/mockData";

export default function NakesDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isPracticing, setIsPracticing] = useState(true);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      // Filter janji temu yang ditujukan ke dokter ini atau dokter demo
      const myApts = allApts.filter(
        (a) => a.dokterId === s.id || a.dokterId === "DOC-01"
      );
      setAppointments(myApts);
    }
  }, []);

  if (!session) return null;

  const totalPatients = appointments.length;
  const inProgressCount = appointments.filter((a) => a.status === "IN_PROGRESS").length;
  const waitingCount = appointments.filter((a) => a.status === "WAITING").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;

  const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);

  return (
    <div className="space-y-8">
      {/* Profil Dokter & Kontrol Praktik */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
              Stasiun Kerja Tenaga Kesehatan Terakreditasi
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              STR/SIP Sah
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            {session.name}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {session.specialization || "Spesialis Penyakit Dalam"} • {session.faskesName || "RSUP Dr. Sardjito"}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            Nomor STR: <span className="text-slate-700 font-bold">{session.strNumber || "31.1.1.100.2.22.123456"}</span> • Nomor SIP:{" "}
            <span className="text-slate-700 font-bold">{session.sipNumber || "446/SIP-D/2023/001"}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <span
              className={`w-3 h-3 rounded-full ${
                isPracticing ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span className="text-xs font-bold text-slate-700">
              {isPracticing ? "Sesi Praktik Aktif" : "Praktik Selesai / Istirahat"}
            </span>
            <button
              onClick={() => setIsPracticing(!isPracticing)}
              className="text-[10px] font-bold uppercase px-2.5 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer ml-2"
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
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Total Antrean Hari Ini
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalPatients}</p>
          <span className="text-[10px] text-slate-500">Pasien Terjadwal</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Pasien Menunggu
          </p>
          <p className="text-2xl font-black text-blue-700 mt-1">{waitingCount}</p>
          <span className="text-[10px] text-blue-600">Di Ruang Tunggu</span>
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

      {/* Daftar Antrean Pasien Hari Ini (UR-T02) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Antrean Pasien Rawat Jalan Hari Ini (UR-T02)
            </h2>
            <p className="text-xs text-slate-500">
              Data antrean telah di-cache lokal untuk ketahanan penuh jika koneksi rumah sakit terputus (*Offline-First*).
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Jadwal: {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        <div className="p-6 pt-0 space-y-4">
          {appointments.length === 0 ? (
            <p className="text-center py-10 text-xs text-slate-400">
              Tidak ada antrean pasien untuk jadwal praktik ini.
            </p>
          ) : (
            appointments.map((apt) => {
              const patientDetail = allPatients.find(
                (p) => p.id === apt.pasienId || p.nik === apt.pasienNik
              );
              const allergies = patientDetail?.allergies || [];

              return (
                <div
                  key={apt.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-slate-100/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {apt.id}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          apt.status === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                            : apt.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {apt.status}
                      </span>

                      {/* Alert Alergi Bahaya */}
                      {allergies.length > 0 && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                          Alergi: {allergies.join(", ")}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 mt-0.5">
                      {apt.pasienNama}
                    </h3>
                    <p className="text-xs text-slate-500">
                      NIK: <span className="font-mono font-bold">{apt.pasienNik}</span> • Sesi:{" "}
                      <strong>{apt.jam}</strong> • {apt.faskesNama}
                    </p>
                    <p className="text-xs text-slate-600 italic bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200 inline-block mt-1">
                      Keluhan Awal: &quot;{apt.keluhanAwal}&quot;
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {apt.status !== "COMPLETED" ? (
                      <button
                        onClick={() => router.push(`/nakes/periksa/${apt.id}`)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
                      >
                        {apt.status === "IN_PROGRESS" ? "Lanjutkan Periksa" : "Panggil & Periksa"}
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/nakes/periksa/${apt.id}`)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold uppercase transition"
                      >
                        Lihat Berkas Rekam Medis
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
