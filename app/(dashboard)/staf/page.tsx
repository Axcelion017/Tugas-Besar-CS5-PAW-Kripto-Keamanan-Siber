"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  getStorageData,
  setStorageData,
  Appointment,
  Patient,
} from "@/lib/db/mockData";
import { SkeletonDisruptionNotice } from "@/components/ui/Skeleton";
import { WalkInAdmisiSchema } from "@/lib/validations/triage";

function generateWalkInId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function StafAdmisiPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // State Pendaftaran Pasien Walk-In
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInNik, setWalkInNik] = useState("");
  const [walkInKeluhan, setWalkInKeluhan] = useState("");
  const [walkInPoli, setWalkInPoli] = useState("Poli Penyakit Dalam");
  const [notif, setNotif] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const mode = localStorage.getItem("resilio_network_mode");
      setIsOfflineMode(mode === "offline");
    }, 0);
    const checkOffline = () => {
      const mode = localStorage.getItem("resilio_network_mode");
      setIsOfflineMode(mode === "offline");
    };
    window.addEventListener("storage", checkOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", checkOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getUserSession();
      if (s) {
        setSession(s);
        const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
        setAppointments(allApts);
        const allPts = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
        setPatients(allPts);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckIn = (aptId: string) => {
    const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
    const updated = allApts.map((a) =>
      a.id === aptId
        ? {
            ...a,
            status: "WAITING_TRIAGE" as const,
            checkInTime: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
          }
        : a
    );
    setStorageData("resilio_appointments", updated);
    setAppointments(updated);
    setNotif(`Pasien ${aptId} berhasil check-in. Pasien diarahkan ke Ruang Triase Keperawatan.`);
    setTimeout(() => setNotif(null), 4000);
  };

  const [walkInError, setWalkInError] = useState<string | null>(null);

  const handleRegisterWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError(null);
    const cleanNik = walkInNik.trim();

    // Validasi menggunakan Skema Zod
    const validation = WalkInAdmisiSchema.safeParse({
      nik: cleanNik,
      keluhan: walkInKeluhan,
      poli: walkInPoli,
    });

    if (!validation.success) {
      setWalkInError(validation.error.issues[0]?.message || "Data pendaftaran walk-in tidak valid.");
      return;
    }

    const existingPatient = patients.find((p) => p.nik === cleanNik);

    const patientName = existingPatient ? existingPatient.name : "Pasien Umum Walk-in";
    const patientId = existingPatient ? existingPatient.id : generateWalkInId("P");

    const newApt: Appointment = {
      id: generateWalkInId("APT-WALKIN"),
      pasienId: patientId,
      pasienNama: patientName,
      pasienNik: cleanNik,
      faskesId: session?.faskesId || "FAS-01",
      faskesNama: session?.faskesName || "RSUP Dr. Sardjito",
      dokterId: "DOC-01",
      dokterNama: "dr. Andi Pratama, Sp.PD",
      poli: walkInPoli,
      tanggal: new Date().toISOString().split("T")[0],
      jam: "Loket Langsung",
      keluhanAwal: walkInKeluhan || "Pendaftaran langsung di loket faskes",
      status: "WAITING_TRIAGE",
      consentActive: true,
      consentPin: generatePin(),
      checkInTime: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
    };

    const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
    const updated = [newApt, ...allApts];
    setStorageData("resilio_appointments", updated);
    setAppointments(updated);

    setShowWalkInModal(false);
    setWalkInNik("");
    setWalkInKeluhan("");
    setNotif(`Pasien walk-in ${patientName} (NIK: ${cleanNik}) berhasil didaftarkan langsung ke Ruang Triase.`);
    setTimeout(() => setNotif(null), 4000);
  };

  if (!session) return null;

  const pendingCheckIn = appointments.filter((a) => a.status === "PENDING_ARRIVAL" || a.status === "WAITING");
  const waitingTriage = appointments.filter((a) => a.status === "WAITING_TRIAGE");
  const waitingDoctor = appointments.filter((a) => a.status === "WAITING_DOCTOR" || a.status === "IN_EXAMINATION");

  return (
    <div className="space-y-6">
      {/* Notice ketika terjadi gangguan jaringan / mode offline */}
      {isOfflineMode && (
        <SkeletonDisruptionNotice message="Terdeteksi gangguan jaringan: Pendaftaran antrean loket dan triase berjalan dalam mode lokal terproteksi (IndexedDB Offline Engine)." />
      )}

      {/* Header Staf Admisi & Triase */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-700">
              Meja Layanan Admisi & Triase Pasien (UR-S01)
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              {session.posisiStaf || "Perawat Triase"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            {session.name}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {session.faskesName || "RSUP Dr. Sardjito"} • Gerbang Validasi Kedatangan & Triase Awal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
          >
            + Daftarkan Pasien Walk-in (Loket)
          </button>
          <Link
            href="/staf/triase"
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
          >
            Pemeriksaan Triase →
          </Link>
        </div>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Statistik Ringkasan Antrean Loket */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Booking Menunggu Check-in
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">{pendingCheckIn.length}</p>
          <span className="text-[10px] text-slate-500">Pasien belum tiba di faskes</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
            Menunggu Triase Keperawatan
          </p>
          <p className="text-2xl font-black text-amber-800 mt-1">{waitingTriage.length}</p>
          <span className="text-[10px] text-amber-600 font-semibold">Siap diukur tensi & keluhan awal</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
            Menunggu / Diperiksa Dokter
          </p>
          <p className="text-2xl font-black text-emerald-800 mt-1">{waitingDoctor.length}</p>
          <span className="text-[10px] text-emerald-600">Di ruang poli dokter (DPJP)</span>
        </div>
      </div>

      {/* Tabel Daftar Pasien Menunggu Validasi Kedatangan */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Daftar Kedatangan Pasien Hari Ini (Check-in Admisi)
            </h2>
            <p className="text-xs text-slate-500">
              Validasi pasien saat tiba di lobi faskes sebelum masuk ke tahap pemeriksaan fisik awal perawat.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {appointments.length} Total Antrean Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">No. Antrean</th>
                <th className="p-4">Nama Pasien</th>
                <th className="p-4">NIK (Kependudukan)</th>
                <th className="p-4">Poli Tujuan</th>
                <th className="p-4">Waktu Jadwal</th>
                <th className="p-4">Status Alur</th>
                <th className="p-4 text-right">Aksi Admisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((a) => {
                const isPendingArrival = a.status === "PENDING_ARRIVAL" || a.status === "WAITING";
                const isTriaseReady = a.status === "WAITING_TRIAGE";

                return (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{a.id}</td>
                    <td className="p-4 font-bold text-slate-900 text-sm">{a.pasienNama}</td>
                    <td className="p-4 font-mono text-slate-600">{a.pasienNik}</td>
                    <td className="p-4 font-semibold text-slate-700">{a.poli}</td>
                    <td className="p-4 text-slate-500">{a.jam}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                          isPendingArrival
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : isTriaseReady
                            ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                            : a.status === "IN_EXAMINATION" || a.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {a.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {isPendingArrival ? (
                        <button
                          onClick={() => handleCheckIn(a.id)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                        >
                          Check-in Pasien
                        </button>
                      ) : isTriaseReady ? (
                        <Link
                          href="/staf/triase"
                          className="inline-block px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase transition"
                        >
                          Mulai Triase →
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold italic">
                          Sudah di Triase / Dokter
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pendaftaran Pasien Walk-In */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              Pendaftaran Pasien Datang Langsung (Walk-In)
            </h3>
            <p className="text-xs text-slate-500">
              Daftarkan pasien yang datang langsung ke meja loket tanpa booking online terlebih dahulu.
            </p>

            {walkInError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
                {walkInError}
              </div>
            )}

            <form onSubmit={handleRegisterWalkIn} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor Induk Kependudukan (NIK) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={walkInNik}
                  onChange={(e) => setWalkInNik(e.target.value.replace(/\D/g, ""))}
                  placeholder="3171012304800001"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Poli Pelayanan Dituju
                </label>
                <select
                  value={walkInPoli}
                  onChange={(e) => setWalkInPoli(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="Poli Penyakit Dalam">Poli Penyakit Dalam</option>
                  <option value="Poli Kardiologi (Jantung)">Poli Kardiologi (Jantung)</option>
                  <option value="Poli Anak">Poli Anak</option>
                  <option value="IGD (Gawat Darurat)">IGD (Gawat Darurat)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Keluhan Awal yang Dirasakan Pasien
                </label>
                <textarea
                  rows={3}
                  value={walkInKeluhan}
                  onChange={(e) => setWalkInKeluhan(e.target.value)}
                  placeholder="Contoh: Pasien datang dengan keluhan demam tinggi 3 hari dan mual..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
                >
                  Daftarkan & Kirim ke Triase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
