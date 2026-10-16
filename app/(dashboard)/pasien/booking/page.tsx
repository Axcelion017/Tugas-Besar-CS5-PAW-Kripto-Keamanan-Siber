"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_FASKES,
  MOCK_DOCTORS,
  MOCK_APPOINTMENTS,
  MOCK_ACCESS_GRANTS,
  getStorageData,
  setStorageData,
  Appointment,
  AccessGrant,
} from "@/lib/db/mockData";

function BookingContent() {
  const searchParams = useSearchParams();
  const preselectedFaskes = searchParams.get("faskesId") || "FAS-01";
  const preselectedDokter = searchParams.get("dokterId") || "DOC-01";

  const [session, setSession] = useState<UserSession | null>(null);
  const [faskesId, setFaskesId] = useState(preselectedFaskes);
  const [dokterId, setDokterId] = useState(preselectedDokter);
  const [tanggal, setTanggal] = useState("2026-10-16");
  const [jam, setJam] = useState("09:00 WIB");
  const [keluhanAwal, setKeluhanAwal] = useState("");
  const [autoConsent, setAutoConsent] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      setAppointments(allApts.filter((a) => a.pasienId === s.id || a.pasienNik === s.nik));
    }
  }, []);

  const currentFaskes = MOCK_FASKES.find((f) => f.id === faskesId) || MOCK_FASKES[0];
  const availableDoctors = MOCK_DOCTORS.filter((d) => d.faskesId === currentFaskes.id);
  const currentDoctor =
    availableDoctors.find((d) => d.id === dokterId) || availableDoctors[0] || MOCK_DOCTORS[0];

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (!keluhanAwal.trim()) {
      alert("Keluhan awal wajib diisi untuk referensi dokter sebelum visit.");
      return;
    }

    const newAptId = `APT-2026-${Date.now().toString().slice(-4)}`;
    const newAppointment: Appointment = {
      id: newAptId,
      pasienId: session.id,
      pasienNama: session.name,
      pasienNik: session.nik || "3171012304800001",
      faskesId: currentFaskes.id,
      faskesNama: currentFaskes.nama,
      dokterId: currentDoctor.id,
      dokterNama: currentDoctor.name,
      poli: currentDoctor.specialty,
      tanggal,
      jam,
      keluhanAwal,
      status: "WAITING",
      consentActive: autoConsent,
    };

    const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
    const updatedApts = [newAppointment, ...allApts];
    setStorageData("resilio_appointments", updatedApts);
    setAppointments(updatedApts.filter((a) => a.pasienId === session.id || a.pasienNik === session.nik));

    // Jika Auto Consent dicentang, buat tiket izin akses (AccessGrant) untuk dokter
    if (autoConsent) {
      const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
      const newGrant: AccessGrant = {
        id: `GRANT-${Date.now().toString().slice(-4)}`,
        pasienId: session.id,
        pasienNama: session.name,
        entityId: currentDoctor.id,
        entityNama: currentDoctor.name,
        entityType: "DOKTER",
        scope: `Pemeriksaan Konsultasi (${newAptId})`,
        validUntil: `${tanggal} 23:59 WIB`,
        isRevoked: false,
        createdAt: new Date().toLocaleString("id-ID"),
      };
      setStorageData("resilio_access_grants", [newGrant, ...allGrants]);
    }

    setNotification(
      `Booking berhasil dibuat. Tiket izin akses (Consent) untuk ${currentDoctor.name} aktif pada ${tanggal}.`
    );
    setKeluhanAwal("");
    setTimeout(() => setNotification(null), 5000);
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
          <span>Booking Pemeriksaan & Auto-Consent (UR-P04)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pemesanan Jadwal Konsultasi & Pemberian Izin Akses Medis
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Saat jadwal dikonfirmasi, sistem secara otomatis menerbitkan tiket izin akses sementara (Zero-Trust Gate) untuk dokter pemeriksa.
        </p>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {notification}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulir Booking */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-900">
            Formulir Pendaftaran Antrean Online
          </h2>

          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Pilih Fasilitas Kesehatan
                </label>
                <select
                  value={faskesId}
                  onChange={(e) => {
                    setFaskesId(e.target.value);
                    const newDocs = MOCK_DOCTORS.filter((d) => d.faskesId === e.target.value);
                    if (newDocs[0]) setDokterId(newDocs[0].id);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
                >
                  {MOCK_FASKES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nama} ({f.tipe})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Pilih Dokter & Spesialisasi
                </label>
                <select
                  value={currentDoctor?.id || dokterId}
                  onChange={(e) => setDokterId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
                >
                  {availableDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tanggal Kunjungan Periksa
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Sesi Jam Konsultasi
                </label>
                <select
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
                >
                  <option value="08:30 WIB">08:30 WIB (Pagi)</option>
                  <option value="09:00 WIB">09:00 WIB (Pagi)</option>
                  <option value="10:30 WIB">10:30 WIB (Siang)</option>
                  <option value="13:30 WIB">13:30 WIB (Sore)</option>
                  <option value="15:00 WIB">15:00 WIB (Sore)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Keluhan Awal & Gejala yang Dirasakan *
              </label>
              <textarea
                required
                rows={3}
                value={keluhanAwal}
                onChange={(e) => setKeluhanAwal(e.target.value)}
                placeholder="Contoh: Tekanan darah naik, sering sakit kepala di bagian belakang leher sejak 3 hari lalu..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Kotak Persetujuan Otomatis (Auto-Consent UU PDP) */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConsent}
                  onChange={(e) => setAutoConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  <strong>Pemberian Izin Akses Medis (Auto-Consent UU PDP):</strong> Saya memberikan izin kepada{" "}
                  <strong>{currentDoctor?.name}</strong> untuk membaca riwayat rekam medis pribadi saya dan menulis hasil diagnosa selama masa pemeriksaan pada tanggal {tanggal}. Saya memahami bahwa izin ini dapat dicabut (Revoke) sewaktu-waktu.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/30 transition cursor-pointer"
            >
              Konfirmasi Booking & Terbitkan Tiket Akses
            </button>
          </form>
        </div>

        {/* Antrean / Riwayat Booking Pasien */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900">
            Daftar Antrean & Booking Anda
          </h3>

          {appointments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              Belum ada riwayat booking.
            </p>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      {a.id}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        a.status === "WAITING"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : a.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">{a.dokterNama}</h4>
                  <p className="text-[11px] text-slate-500">{a.faskesNama}</p>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    Waktu: {a.tanggal} • {a.jam}
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    &quot;{a.keluhanAwal}&quot;
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

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm">Memuat halaman booking...</div>}>
      <BookingContent />
    </Suspense>
  );
}
