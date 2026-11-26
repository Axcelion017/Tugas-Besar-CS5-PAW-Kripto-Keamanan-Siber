"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { Appointment } from "@/lib/db/mockData";
import { SkeletonDisruptionNotice, DashboardSkeleton } from "@/components/ui/Skeleton";
import { WalkInAdmisiSchema } from "@/lib/validations/triage";
import {
  getAppointmentsServerAction,
  checkInAppointmentServerAction,
  createWalkInAppointmentServerAction,
} from "@/lib/actions/appointment";

export default function StafAdmisiPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // State Pendaftaran Pasien Walk-In
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInNik, setWalkInNik] = useState("");
  const [walkInKeluhan, setWalkInKeluhan] = useState("");
  const [walkInPoli, setWalkInPoli] = useState("Poli Penyakit Dalam");
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const loadAppointmentsFromDb = useCallback(async () => {
    try {
      const res = await getAppointmentsServerAction();
      if (res.success && Array.isArray(res.data)) {
        const mapped: Appointment[] = (
          res.data as unknown as Array<{
            id: string;
            patientId: string;
            patient?: { name?: string; nik?: string };
            faskesId: string;
            faskes?: { nama?: string };
            doctorId: string;
            doctor?: { name?: string };
            poli: string;
            tanggal: string;
            jam: string;
            keluhanAwal: string;
            status: string;
            consentActive?: boolean;
            checkInTime?: string | null;
          }>
        ).map((a) => ({
          id: a.id,
          pasienId: a.patientId,
          pasienNama: a.patient?.name || "Pasien Terdaftar",
          pasienNik: a.patient?.nik || "-",
          faskesId: a.faskesId,
          faskesNama: a.faskes?.nama || "RSUP Dr. Sardjito",
          dokterId: a.doctorId,
          dokterNama: a.doctor?.name || "Dokter DPJP",
          poli: a.poli,
          tanggal: new Date(a.tanggal).toISOString().split("T")[0],
          jam: a.jam,
          keluhanAwal: a.keluhanAwal,
          status: (a.status as Appointment["status"]) || "PENDING_ARRIVAL",
          consentActive: !!a.consentActive,
          checkInTime: a.checkInTime
            ? new Date(a.checkInTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }) + " WIB"
            : undefined,
        }));
        setAppointments(mapped);
      }
    } catch (err) {
      console.warn("Gagal memuat daftar antrean loket dari PostgreSQL:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const mode = localStorage.getItem("resilio_network_mode");
      setIsOfflineMode(mode === "offline");
      const s = getUserSession();
      if (s) setSession(s);
      void loadAppointmentsFromDb();
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
  }, [loadAppointmentsFromDb]);

  const handleCheckIn = async (aptId: string) => {
    setErrorMsg(null);
    setNotif(null);
    setCheckingInId(aptId);

    try {
      const res = await checkInAppointmentServerAction(aptId);
      if (!res.success) {
        setErrorMsg(res.message || "Gagal melakukan check-in pasien.");
        return;
      }

      setNotif(res.message || `Pasien ${aptId} berhasil check-in dan diarahkan ke Ruang Triase.`);
      await loadAppointmentsFromDb();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat check-in pasien.");
    } finally {
      setCheckingInId(null);
    }
  };

  const handleRegisterWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError(null);
    setErrorMsg(null);
    const cleanNik = walkInNik.trim();

    const validation = WalkInAdmisiSchema.safeParse({
      nik: cleanNik,
      keluhan: walkInKeluhan,
      poli: walkInPoli,
    });

    if (!validation.success) {
      setWalkInError(validation.error.issues[0]?.message || "Data pendaftaran walk-in tidak valid.");
      return;
    }

    setIsSubmittingWalkIn(true);
    try {
      const res = await createWalkInAppointmentServerAction({
        nik: cleanNik,
        keluhan: walkInKeluhan,
        poli: walkInPoli,
      });

      if (!res.success) {
        setWalkInError(res.message || "Gagal mendaftarkan pasien walk-in ke PostgreSQL.");
        return;
      }

      setShowWalkInModal(false);
      setWalkInNik("");
      setWalkInKeluhan("");
      setNotif(res.message || "Pasien walk-in berhasil didaftarkan ke Loket Triase.");
      await loadAppointmentsFromDb();
    } catch {
      setWalkInError("Terjadi kendala koneksi saat mendaftarkan pasien walk-in.");
    } finally {
      setIsSubmittingWalkIn(false);
    }
  };

  if (isLoading || !session) {
    return <DashboardSkeleton noticeText="Memuat antrean loket admisi dari basis data PostgreSQL..." />;
  }

  const pendingCheckIn = appointments.filter(
    (a) => a.status === "PENDING_ARRIVAL" || a.status === "WAITING"
  );
  const waitingTriage = appointments.filter((a) => a.status === "WAITING_TRIAGE");
  const waitingDoctor = appointments.filter(
    (a) =>
      a.status === "WAITING_DOCTOR" ||
      a.status === "IN_EXAMINATION" ||
      a.status === "IN_PROGRESS"
  );

  return (
    <div className="space-y-6">
      {isOfflineMode && (
        <SkeletonDisruptionNotice message="Terdeteksi gangguan jaringan: Pendaftaran antrean loket dan triase berjalan dalam mode lokal terproteksi." />
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
            {session.faskesName || "RSUP Dr. Sardjito"} • Gerbang Validasi Kedatangan & Triase Awal (PostgreSQL)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
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
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Statistik Ringkasan Antrean Loket */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
            Booking Menunggu Check-in
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">{pendingCheckIn.length}</p>
          <span className="text-[11px] text-slate-500">Pasien belum tiba di faskes</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
            Menunggu Triase Keperawatan
          </p>
          <p className="text-2xl font-black text-amber-800 mt-1">{waitingTriage.length}</p>
          <span className="text-[11px] text-amber-700 font-semibold">Siap diukur tensi & keluhan awal</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
            Menunggu / Diperiksa Dokter
          </p>
          <p className="text-2xl font-black text-emerald-800 mt-1">{waitingDoctor.length}</p>
          <span className="text-[11px] text-emerald-700">Di ruang poli dokter (DPJP)</span>
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
                const isWaitingDpjp = a.status === "WAITING_DOCTOR";

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
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : isWaitingDpjp
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : a.status === "IN_EXAMINATION" || a.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {isPendingArrival ? (
                        <button
                          type="button"
                          disabled={checkingInId === a.id}
                          onClick={() => handleCheckIn(a.id)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                        >
                          {checkingInId === a.id ? "Memproses..." : "Check-in Pasien"}
                        </button>
                      ) : isTriaseReady ? (
                        <Link
                          href={`/staf/triase?aptId=${encodeURIComponent(a.id)}`}
                          className="inline-block px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase transition"
                        >
                          Mulai Triase →
                        </Link>
                      ) : isWaitingDpjp ? (
                        <Link
                          href={`/staf/assign-dpjp?aptId=${encodeURIComponent(a.id)}`}
                          className="inline-block px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold uppercase transition"
                        >
                          Assign DPJP →
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-semibold italic">
                          {a.status === "COMPLETED" ? "Selesai Diperiksa" : "Di Ruang Dokter"}
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
              Daftarkan pasien terdaftar (via NIK 16 digit) langsung ke antrean Loket Triase PostgreSQL.
            </p>

            {walkInError && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
                {walkInError}
              </div>
            )}

            <form onSubmit={handleRegisterWalkIn} className="space-y-4 pt-2">
              <div>
                <label htmlFor="walkin-nik" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor Induk Kependudukan (NIK) *
                </label>
                <input
                  id="walkin-nik"
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
                <label htmlFor="walkin-poli" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Poli Pelayanan Dituju
                </label>
                <select
                  id="walkin-poli"
                  value={walkInPoli}
                  onChange={(e) => setWalkInPoli(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="Poli Penyakit Dalam">Poli Penyakit Dalam</option>
                  <option value="Poli Kardiologi (Jantung)">Poli Kardiologi (Jantung)</option>
                  <option value="Poli Anak">Poli Anak</option>
                  <option value="Instalasi Gawat Darurat (IGD)">Instalasi Gawat Darurat (IGD)</option>
                </select>
              </div>

              <div>
                <label htmlFor="walkin-keluhan" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Keluhan Awal Pasien *
                </label>
                <textarea
                  id="walkin-keluhan"
                  required
                  rows={3}
                  value={walkInKeluhan}
                  onChange={(e) => setWalkInKeluhan(e.target.value)}
                  placeholder="Ringkasan keluhan saat pasien melapor di loket..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWalkIn}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {isSubmittingWalkIn ? "Menyimpan..." : "Simpan & Kirim ke Triase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
