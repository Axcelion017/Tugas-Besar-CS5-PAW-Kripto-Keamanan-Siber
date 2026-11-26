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
import { IconCalendar, IconShield, IconBuilding } from "@/components/ui/Icons";

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

const TIME_SLOTS = [
  { value: "08:30 WIB", label: "08:30", period: "Pagi" },
  { value: "09:00 WIB", label: "09:00", period: "Pagi" },
  { value: "10:30 WIB", label: "10:30", period: "Siang" },
  { value: "13:30 WIB", label: "13:30", period: "Sore" },
  { value: "15:00 WIB", label: "15:00", period: "Sore" },
] as const;

function formatFaskesType(tipe: string): string {
  if (tipe === "RUMAH_SAKIT") return "Rumah Sakit";
  if (tipe === "KLINIK_PRATAMA") return "Klinik Pratama";
  if (tipe === "PUSKESMAS") return "Puskesmas";
  return tipe;
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatStatusLabel(status: string): { label: string; badgeClass: string; borderClass: string } {
  switch (status) {
    case "PENDING_ARRIVAL":
    case "WAITING":
      return {
        label: "Menunggu Kedatangan",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
        borderClass: "border-l-blue-600",
      };
    case "WAITING_TRIAGE":
      return {
        label: "Antre Triase Perawat",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        borderClass: "border-l-amber-500",
      };
    case "WAITING_DOCTOR":
      return {
        label: "Menunggu Dokter DPJP",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
        borderClass: "border-l-indigo-600",
      };
    case "IN_EXAMINATION":
    case "IN_PROGRESS":
      return {
        label: "Sedang Diperiksa",
        badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
        borderClass: "border-l-amber-600",
      };
    case "COMPLETED":
      return {
        label: "Pemeriksaan Selesai",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        borderClass: "border-l-emerald-600",
      };
    default:
      return {
        label: status.replaceAll("_", " "),
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        borderClass: "border-l-slate-400",
      };
  }
}

function BookingContent() {
  const searchParams = useSearchParams();
  const preselectedFaskes = searchParams.get("faskesId") || "FAS-01";
  const preselectedDokter = searchParams.get("dokterId") || "DOC-01";
  const todayIso = getLocalTodayIso();

  const [session, setSession] = useState<UserSession | null>(null);
  const [faskesList, setFaskesList] = useState<DbFaskesOption[]>([]);
  const [faskesId, setFaskesId] = useState(preselectedFaskes);
  const [dokterId, setDokterId] = useState(preselectedDokter);
  const [tanggal, setTanggal] = useState(todayIso);
  const [jam, setJam] = useState("09:00 WIB");
  const [keluhanAwal, setKeluhanAwal] = useState("");
  const [autoConsent, setAutoConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [aptFilter, setAptFilter] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleJam, setRescheduleJam] = useState("09:00 WIB");
  const [pendingCancelAptId, setPendingCancelAptId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      const s = getUserSession();
      if (active && s) setSession(s);

      try {
        const [faskesRes, aptsRes] = await Promise.all([
          getFaskesListServerAction(),
          s ? getAppointmentsServerAction({ patientId: s.id }) : Promise.resolve({ success: false, data: [] }),
        ]);

        if (active && faskesRes.success && Array.isArray(faskesRes.data)) {
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

        if (active && s && aptsRes.success && aptsRes.data) {
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
        } else if (active) {
          setAppointments([]);
        }
      } catch {
        if (active) setAppointments([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [preselectedDokter, preselectedFaskes]);

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
        setNotification(`Tiket antrean ${aptId} berhasil dibatalkan.`);
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
        setNotification(`Jadwal antrean ${aptId} berhasil diperbarui ke ${rescheduleDate} (${rescheduleJam}).`);
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

  const activeAptsCount = appointments.filter((a) => a.status !== "COMPLETED").length;
  const completedAptsCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const visibleAppointments = appointments.filter((a) => {
    if (aptFilter === "ACTIVE") return a.status !== "COMPLETED";
    if (aptFilter === "COMPLETED") return a.status === "COMPLETED";
    return true;
  });

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotification(null);
    if (!session || !currentFaskes || !currentDoctor) return;

    if (isSelectedFaskesQuarantined) {
      setErrorMsg(
        `Pemesanan ditolak: ${currentFaskes.nama} sedang berstatus KARANTINA oleh Admin Regulator.`
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
        setErrorMsg(res.message || "Gagal menyimpan jadwal antrean ke server.");
        return;
      }

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
      setAptFilter("ACTIVE");
      setNotification(
        `Tiket antrean ${created.id} berhasil dibuat${
          created.consentPin ? ` • PIN DPJP: ${created.consentPin}` : ""
        }.`
      );
      setKeluhanAwal("");
    } catch {
      setErrorMsg("Terjadi gangguan koneksi saat menyimpan booking ke server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Link href="/pasien" className="hover:underline">
              Portal Pasien
            </Link>
            <span>/</span>
            <span>Booking Pemeriksaan (UR-P04)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Pemesanan Jadwal Konsultasi & Tiket Antrean
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Pesan jadwal dokter, dapatkan PIN persetujuan 6-digit untuk loket admisi, dan atur izin akses medis Anda dalam satu langkah.
          </p>
        </div>

        <Link
          href="/pasien/faskes"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition self-start md:self-auto"
        >
          <IconBuilding size={15} className="text-slate-600" />
          <span>Jelajahi Direktori Faskes</span>
        </Link>
      </div>

      {requestedFaskesNotFound && currentFaskes && (
        <div role="status" className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between gap-3">
          <span>
            Faskes &quot;{searchParams.get("faskesId")}&quot; tidak terdaftar. Dialihkan ke faskes resmi: {currentFaskes.nama}.
          </span>
          <span className="text-[10px] font-mono uppercase bg-amber-200 px-2 py-0.5 rounded shrink-0">
            Dialihkan
          </span>
        </div>
      )}

      {isSelectedFaskesQuarantined && currentFaskes && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
          Faskes Sedang Dikarantina: {currentFaskes.nama} sedang dibatasi sementara oleh Admin Regulator. Silakan pilih fasilitas kesehatan aktif lainnya.
        </div>
      )}

      {/* Layout 12-Grid Seimbang: Form 7 Kolom | Daftar Tiket 5 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulir Booking Terstruktur (3 Langkah) */}
        <section className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <IconCalendar size={18} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Formulir Antrean Online</h2>
                <p className="text-xs text-slate-500">Lengkapi 3 bagian berikut untuk menerbitkan tiket & PIN</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleBookingSubmit} className="space-y-6">
            {/* Langkah 1: Lokasi & Dokter */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                  1
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Pilih Fasilitas Kesehatan & Dokter
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="booking-faskes" className="block text-xs font-bold text-slate-600 mb-1.5">
                    Fasilitas Kesehatan
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {faskesList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nama} ({f.tipe}){f.status === "QUARANTINED" ? " [KARANTINA]" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-dokter" className="block text-xs font-bold text-slate-600 mb-1.5">
                    Dokter & Poliklinik
                  </label>
                  <select
                    id="booking-dokter"
                    value={currentDoctor?.id || dokterId}
                    onChange={(e) => setDokterId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {availableDoctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Langkah 2: Tanggal & Slot Jam */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Tentukan Tanggal & Sesi Jam
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-5">
                  <label htmlFor="booking-tanggal" className="block text-xs font-bold text-slate-600 mb-1.5">
                    Tanggal Kunjungan
                  </label>
                  <input
                    id="booking-tanggal"
                    type="date"
                    required
                    min={todayIso}
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-7">
                  <span className="block text-xs font-bold text-slate-600 mb-1.5">
                    Pilih Slot Jam Konsultasi
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const active = jam === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setJam(slot.value)}
                          className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span className="block text-xs font-black">{slot.label}</span>
                          <span className={`block text-[10px] ${active ? "text-blue-100" : "text-slate-500"}`}>
                            {slot.period}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Langkah 3: Keluhan & Izin Akses */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Keluhan Awal & Persetujuan Akses Medis
                </h3>
              </div>

              <div>
                <label htmlFor="booking-keluhan" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Keluhan atau Gejala yang Dirasakan *
                </label>
                <textarea
                  id="booking-keluhan"
                  required
                  rows={3}
                  value={keluhanAwal}
                  onChange={(e) => setKeluhanAwal(e.target.value)}
                  placeholder="Contoh: Tekanan darah naik, sering sakit kepala di bagian belakang leher sejak 3 hari lalu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConsent}
                    onChange={(e) => setAutoConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 shrink-0"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Aktifkan Izin Akses Medis Otomatis (UU PDP):</strong>{" "}
                    Izinkan <strong>{currentDoctor?.name || "Dokter DPJP"}</strong> meninjau riwayat medis Anda selama kunjungan pada{" "}
                    <strong>{tanggal}</strong>. Izin ini dapat Anda cabut kapan saja melalui menu <em>Izin Akses</em>.
                  </span>
                </label>
              </div>
            </div>

            {/* Strip Ringkasan Sebelum Submit */}
            {currentFaskes && currentDoctor && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Ringkasan Jadwal Pilihan
                  </span>
                  <p className="font-bold text-slate-900">
                    {currentDoctor.name} • {currentFaskes.nama}
                  </p>
                  <p className="text-slate-600">
                    {tanggal} pukul {jam} ({currentDoctor.specialty})
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full self-start sm:self-center shrink-0">
                  <IconShield size={13} />
                  <span>PIN 6-Digit Otomatis</span>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isSelectedFaskesQuarantined || !currentDoctor}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Memproses Tiket Antrean..."
                : isSelectedFaskesQuarantined
                ? "Booking Diblokir (Faskes Karantina)"
                : "Konfirmasi Booking & Terbitkan Tiket"}
            </button>
          </form>
        </section>

        {/* Kolom Kanan (5): Daftar Antrean & Riwayat Booking */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50/80 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900">Tiket Antrean Anda</h2>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                {appointments.length} Total
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAptFilter("ACTIVE")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  aptFilter === "ACTIVE"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Aktif ({activeAptsCount})
              </button>
              <button
                type="button"
                onClick={() => setAptFilter("COMPLETED")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  aptFilter === "COMPLETED"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Selesai ({completedAptsCount})
              </button>
              <button
                type="button"
                onClick={() => setAptFilter("ALL")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  aptFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <p className="text-xs text-slate-500 text-center py-8 font-medium">
                Memuat daftar antrean Anda...
              </p>
            ) : visibleAppointments.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  Belum ada tiket antrean pada tab ini.
                </p>
                <p className="text-xs text-slate-500">
                  Isi formulir di sebelah kiri untuk membuat jadwal pemeriksaan baru.
                </p>
              </div>
            ) : (
              visibleAppointments.map((a) => {
                const statusInfo = formatStatusLabel(a.status);
                return (
                  <div
                    key={a.id}
                    className={`p-4 rounded-2xl bg-slate-50/70 border border-slate-200 border-l-4 ${statusInfo.borderClass} space-y-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-600">{a.id}</span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-sm font-black text-slate-900">{a.dokterNama}</p>
                      <p className="text-xs text-slate-600">
                        {a.poli} • {a.faskesNama}
                      </p>
                      <p className="text-xs font-bold text-blue-700 pt-1">
                        {a.tanggal} • {a.jam}
                      </p>
                    </div>

                    {a.consentPin && a.status !== "COMPLETED" && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-emerald-700">
                            PIN Persetujuan DPJP (Tunjukkan di Loket)
                          </span>
                          <span className="font-mono text-sm font-black tracking-widest text-emerald-950">
                            {a.consentPin}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== "undefined" && navigator.clipboard) {
                              void navigator.clipboard.writeText(a.consentPin || "");
                              setNotification(`PIN ${a.consentPin} disalin ke papan klip.`);
                            }
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
                        >
                          Salin
                        </button>
                      </div>
                    )}

                    {editingAptId === a.id ? (
                      <div className="pt-2.5 border-t border-slate-200 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            min={todayIso}
                            aria-label="Tanggal jadwal ulang"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                          />
                          <select
                            aria-label="Jam jadwal ulang"
                            value={rescheduleJam}
                            onChange={(e) => setRescheduleJam(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                          >
                            {TIME_SLOTS.map((slot) => (
                              <option key={slot.value} value={slot.value}>
                                {slot.value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveReschedule(a.id)}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Simpan Jadwal
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAptId(null)}
                            className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      a.status !== "COMPLETED" && (
                        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {a.consentActive ? "Auto-Consent Aktif" : "Izin Manual"}
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
                              Ubah Jadwal
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingCancelAptId(a.id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 transition cursor-pointer"
                            >
                              Batalkan
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingCancelAptId)}
        onClose={() => setPendingCancelAptId(null)}
        onConfirm={() => void confirmCancelAppointment()}
        title="Batalkan Tiket Antrean?"
        description={`Tiket antrean ${pendingCancelAptId || ""} akan dibatalkan dan dihapus permanen dari daftar kunjungan Anda.`}
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
