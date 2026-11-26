"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { Appointment } from "@/lib/db/mockData";
import { BookingSchema } from "@/lib/validations/patient";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import {
  createAppointmentServerAction,
  getAppointmentsServerAction,
  updateAppointmentDetailsServerAction,
  deleteAppointmentServerAction,
} from "@/lib/actions/appointment";
import { ConfirmModal } from "@/components/ui/Modal";
import { ToastBanner } from "@/components/ui/ToastBanner";

interface DbDoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface DbFaskesOption {
  id: string;
  nama: string;
  tipe: string;
  status: "ACTIVE" | "QUARANTINED";
  doctors: DbDoctorOption[];
}

function formatFaskesType(tipe: string): string {
  if (tipe === "RUMAH_SAKIT") return "Rumah Sakit";
  if (tipe === "KLINIK_PRATAMA") return "Klinik Pratama";
  if (tipe === "PUSKESMAS") return "Puskesmas";
  return tipe;
}

function getTodayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function BookingContent() {
  const searchParams = useSearchParams();
  const preselectedFaskes = searchParams.get("faskesId") || "FAS-01";
  const preselectedDokter = searchParams.get("dokterId") || "DOC-01";
  const todayIso = getTodayIso();

  const [session, setSession] = useState<UserSession | null>(null);
  const [faskesList, setFaskesList] = useState<DbFaskesOption[]>([]);
  const [faskesId, setFaskesId] = useState(preselectedFaskes);
  const [dokterId, setDokterId] = useState(preselectedDokter);
  const [tanggal, setTanggal] = useState(todayIso);
  const [jam, setJam] = useState("09:00 WIB");
  const [keluhanAwal, setKeluhanAwal] = useState("");
  const [autoConsent, setAutoConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleJam, setRescheduleJam] = useState("09:00 WIB");

  useEffect(() => {
    async function loadData() {
      const s = getUserSession();
      if (s) setSession(s);

      try {
        const [faskesRes, aptsRes] = await Promise.all([
          getFaskesListServerAction(),
          s ? getAppointmentsServerAction({ patientId: s.id }) : Promise.resolve({ success: false, data: [] }),
        ]);

        if (faskesRes.success && Array.isArray(faskesRes.data)) {
          const list = (faskesRes.data as unknown as DbFaskesOption[]).map((f) => ({
            ...f,
            tipe: formatFaskesType(f.tipe),
          }));
          setFaskesList(list);

          const matchedFaskes = list.find((f) => f.id === preselectedFaskes) || list[0];
          if (matchedFaskes) {
            setFaskesId(matchedFaskes.id);
            const matchedDoc =
              matchedFaskes.doctors.find((d) => d.id === preselectedDokter) ||
              matchedFaskes.doctors[0];
            if (matchedDoc) setDokterId(matchedDoc.id);
          }
        }

        if (s && aptsRes.success && aptsRes.data) {
          const mappedApts: Appointment[] = (
            aptsRes.data as unknown as Array<{
              id: string;
              patientId: string;
              patient?: { name?: string; nik?: string };
              faskesId: string;
              faskes?: { nama?: string };
              doctorId: string;
              doctor?: { name?: string };
              poli: string;
              tanggal: Date | string;
              jam: string;
              keluhanAwal: string;
              status: string;
              consentActive?: boolean;
              consentPin?: string | null;
            }>
          ).map((a) => ({
            id: a.id,
            pasienId: a.patientId,
            pasienNama: a.patient?.name || s.name,
            pasienNik: a.patient?.nik || s.nik || "-",
            faskesId: a.faskesId,
            faskesNama: a.faskes?.nama || "Faskes Terdaftar",
            dokterId: a.doctorId,
            dokterNama: a.doctor?.name || "Dokter DPJP",
            poli: a.poli,
            tanggal: new Date(a.tanggal).toISOString().split("T")[0],
            jam: a.jam,
            keluhanAwal: a.keluhanAwal,
            status: (a.status as Appointment["status"]) || "PENDING_ARRIVAL",
            consentActive: !!a.consentActive,
            consentPin: a.consentPin || undefined,
          }));
          setAppointments(mappedApts);
        } else {
          setAppointments([]);
        }
      } catch {
        setAppointments([]);
      }
    }

    loadData();
  }, [preselectedDokter, preselectedFaskes]);

  const [pendingCancelAptId, setPendingCancelAptId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelAppointment = (aptId: string) => {
    setPendingCancelAptId(aptId);
  };

  const confirmCancelAppointment = async () => {
    if (!pendingCancelAptId || isCancelling) return;
    const aptId = pendingCancelAptId;
    setIsCancelling(true);
    setErrorMsg(null);
    setNotification(null);

    try {
      const res = await deleteAppointmentServerAction(aptId);
      if (res.success) {
        setAppointments((prev) => prev.filter((a) => a.id !== aptId));
        setNotification(`Tiket antrean ${aptId} berhasil dibatalkan dan dihapus dari basis data.`);
      } else {
        setErrorMsg(res.message || "Gagal membatalkan antrean.");
      }
    } catch {
      setErrorMsg("Terjadi kendala saat membatalkan antrean.");
    } finally {
      setIsCancelling(false);
      setPendingCancelAptId(null);
    }
  };

  const handleSaveReschedule = async (aptId: string) => {
    if (!rescheduleDate) {
      setErrorMsg("Pilih tanggal baru untuk jadwal ulang.");
      return;
    }
    setErrorMsg(null);
    setNotification(null);

    try {
      const res = await updateAppointmentDetailsServerAction(aptId, {
        tanggal: rescheduleDate,
        jam: rescheduleJam,
      });

      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === aptId ? { ...a, tanggal: rescheduleDate, jam: rescheduleJam } : a
          )
        );
        setEditingAptId(null);
        setNotification(`Jadwal antrean ${aptId} berhasil diperbarui (Rescheduled).`);
      } else {
        setErrorMsg(res.message || "Gagal memperbarui jadwal.");
      }
    } catch {
      setErrorMsg("Terjadi kendala saat memperbarui jadwal antrean.");
    }
  };

  const requestedFaskesNotFound =
    faskesList.length > 0 &&
    !!searchParams.get("faskesId") &&
    !faskesList.some((f) => f.id === searchParams.get("faskesId"));
  const currentFaskes = faskesList.find((f) => f.id === faskesId) || faskesList[0];
  const availableDoctors = currentFaskes?.doctors || [];
  const currentDoctor =
    availableDoctors.find((d) => d.id === dokterId) || availableDoctors[0];
  const isSelectedFaskesQuarantined = currentFaskes?.status === "QUARANTINED";

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotification(null);
    if (!session || !currentFaskes || !currentDoctor) return;

    if (isSelectedFaskesQuarantined) {
      setErrorMsg(
        `Pemesanan ditolak: ${currentFaskes.nama} sedang berstatus KARANTINA (Kill-Switch Siber) oleh Admin Regulator.`
      );
      return;
    }

    const validation = BookingSchema.safeParse({
      faskesId: currentFaskes.id,
      dokterId: currentDoctor.id,
      tanggal,
      jam,
      keluhanAwal,
      autoConsent,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Data booking tidak valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createAppointmentServerAction({
        faskesId: currentFaskes.id,
        dokterId: currentDoctor.id,
        tanggal,
        jam,
        poli: currentDoctor.specialty,
        keluhanAwal,
        autoConsent,
        patientId: session.id,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.message || "Gagal menyimpan jadwal antrean ke basis data PostgreSQL.");
        return;
      }

      // Gunakan ID & PIN asli yang dikembalikan dari PostgreSQL (Single Source of Truth)
      const created = res.data as {
        id: string;
        patientId: string;
        faskesId: string;
        faskes?: { nama?: string };
        doctorId: string;
        doctor?: { name?: string };
        poli: string;
        tanggal: string;
        jam: string;
        keluhanAwal: string;
        status: string;
        consentActive: boolean;
        consentPin?: string | null;
      };

      const newAppointment: Appointment = {
        id: created.id,
        pasienId: created.patientId,
        pasienNama: session.name,
        pasienNik: session.nik || "-",
        faskesId: created.faskesId,
        faskesNama: created.faskes?.nama || currentFaskes.nama,
        dokterId: created.doctorId,
        dokterNama: created.doctor?.name || currentDoctor.name,
        poli: created.poli,
        tanggal: new Date(created.tanggal).toISOString().split("T")[0],
        jam: created.jam,
        keluhanAwal: created.keluhanAwal,
        status: (created.status as Appointment["status"]) || "PENDING_ARRIVAL",
        consentActive: created.consentActive,
        consentPin: created.consentPin || undefined,
      };

      setAppointments((prev) => [newAppointment, ...prev]);
      setNotification(
        `Booking ${created.id} tersimpan di PostgreSQL${
          created.consentPin ? ` (PIN Persetujuan DPJP: ${created.consentPin})` : ""
        }.${autoConsent ? ` Auto-Consent untuk ${currentDoctor.name} telah dicatat di tabel access_grants.` : ""}`
      );
      setKeluhanAwal("");
    } catch {
      setErrorMsg("Terjadi gangguan koneksi saat menyimpan booking ke server.");
    } finally {
      setIsSubmitting(false);
    }
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
          Seluruh pemesanan antrean, penerbitan 6-digit PIN DPJP, dan tiket izin Auto-Consent disimpan atomik di PostgreSQL.
        </p>
      </div>

      {requestedFaskesNotFound && currentFaskes && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
          <span>
            Peringatan: Fasilitas kesehatan dengan ID &quot;{searchParams.get("faskesId")}&quot; tidak terdaftar. Sistem mengarahkan ke faskes resmi: {currentFaskes.nama}.
          </span>
          <span className="text-[10px] font-mono uppercase bg-amber-200 px-2 py-0.5 rounded">
            Faskes Dialihkan
          </span>
        </div>
      )}

      {isSelectedFaskesQuarantined && currentFaskes && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
          KILL-SWITCH AKTIF: {currentFaskes.nama} sedang berstatus KARANTINA oleh Admin Regulator. Pilih fasilitas kesehatan lain yang berstatus aktif.
        </div>
      )}

      {notification && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {notification}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
          {errorMsg}
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
                <label htmlFor="booking-faskes" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Pilih Fasilitas Kesehatan
                </label>
                <select
                  id="booking-faskes"
                  value={currentFaskes?.id || faskesId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setFaskesId(nextId);
                    const nextFaskes = faskesList.find((f) => f.id === nextId);
                    if (nextFaskes?.doctors[0]) {
                      setDokterId(nextFaskes.doctors[0].id);
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
                >
                  {faskesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nama} ({f.tipe}){f.status === "QUARANTINED" ? " [KARANTINA]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="booking-dokter" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Pilih Dokter & Spesialisasi
                </label>
                <select
                  id="booking-dokter"
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
                <label htmlFor="booking-tanggal" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tanggal Kunjungan Periksa
                </label>
                <input
                  id="booking-tanggal"
                  type="date"
                  required
                  min={todayIso}
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="booking-jam" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Sesi Jam Konsultasi
                </label>
                <select
                  id="booking-jam"
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
              <label htmlFor="booking-keluhan" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Keluhan Awal & Gejala yang Dirasakan *
              </label>
              <textarea
                id="booking-keluhan"
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
                  <strong>{currentDoctor?.name || "Dokter DPJP"}</strong> untuk membaca riwayat rekam medis pribadi saya dan menulis hasil diagnosa selama masa pemeriksaan pada tanggal {tanggal}. Izin tersimpan di tabel <code className="font-mono">access_grants</code> dan dapat dicabut (Revoke) sewaktu-waktu.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSelectedFaskesQuarantined || !currentDoctor}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/30 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Menyimpan ke PostgreSQL..."
                : isSelectedFaskesQuarantined
                ? "Booking Diblokir (Faskes Karantina)"
                : "Konfirmasi Booking & Terbitkan Tiket Akses"}
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
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-600">{a.id}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        a.status === "WAITING" || a.status === "PENDING_ARRIVAL"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : a.status === "IN_PROGRESS" || a.status === "IN_EXAMINATION"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : a.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-900">{a.dokterNama}</p>
                    <p className="text-xs text-slate-600">
                      {a.poli} • {a.faskesNama}
                    </p>
                    <p className="text-xs font-semibold text-blue-700 mt-1">
                      Jadwal: {a.tanggal} ({a.jam})
                    </p>
                    {a.consentPin && (
                      <p className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg mt-1.5 inline-block">
                        PIN DPJP: {a.consentPin}
                      </p>
                    )}
                  </div>

                  {editingAptId === a.id ? (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <input
                        type="date"
                        min={todayIso}
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                      />
                      <select
                        value={rescheduleJam}
                        onChange={(e) => setRescheduleJam(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="08:30 WIB">08:30 WIB</option>
                        <option value="09:00 WIB">09:00 WIB</option>
                        <option value="10:30 WIB">10:30 WIB</option>
                        <option value="13:30 WIB">13:30 WIB</option>
                        <option value="15:00 WIB">15:00 WIB</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveReschedule(a.id)}
                          className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAptId(null)}
                          className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    a.status !== "COMPLETED" && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {a.consentActive ? "Consent Aktif" : "Tanpa Auto-Consent"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAptId(a.id);
                              setRescheduleDate(a.tanggal);
                              setRescheduleJam(a.jam);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(a.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 transition cursor-pointer"
                          >
                            Batalkan
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingCancelAptId)}
        onClose={() => setPendingCancelAptId(null)}
        onConfirm={() => void confirmCancelAppointment()}
        title="Batalkan Tiket Antrean?"
        description={`Tiket antrean ${pendingCancelAptId || ""} akan dibatalkan dan dihapus permanen dari PostgreSQL.`}
        confirmLabel="Ya, Batalkan Antrean"
        tone="danger"
        isBusy={isCancelling}
      />

      <ToastBanner
        message={errorMsg || notification}
        type={errorMsg ? "error" : "success"}
        onDismiss={() => {
          setErrorMsg(null);
          setNotification(null);
        }}
      />
    </div>
  );
}

export default function PasienBookingPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm">Memuat halaman booking...</div>}>
      <BookingContent />
    </Suspense>
  );
}
