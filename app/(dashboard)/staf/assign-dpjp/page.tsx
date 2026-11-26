"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Appointment, TriaseLevel } from "@/lib/db/mockData";
import { AssignDpjpSchema } from "@/lib/validations/triage";
import { assignDpjpServerAction, getAppointmentsServerAction } from "@/lib/actions/appointment";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

interface DbDoctorOption {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
}

function AssignDpjpContent() {
  const searchParams = useSearchParams();
  const preselectedAptId = searchParams.get("aptId") || "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DbDoctorOption[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string>(preselectedAptId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("DOC-01");
  const [inputPin, setInputPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [aptsRes, faskesRes] = await Promise.all([
          getAppointmentsServerAction(),
          getFaskesListServerAction(),
        ]);

        if (faskesRes.success && Array.isArray(faskesRes.data)) {
          const docList: DbDoctorOption[] = [];
          for (const f of faskesRes.data as unknown as Array<{
            nama: string;
            doctors: Array<{ id: string; name: string; specialty: string }>;
          }>) {
            for (const d of f.doctors || []) {
              docList.push({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
                hospital: f.nama,
              });
            }
          }
          setDoctors(docList);
          if (docList.length > 0) {
            setSelectedDoctorId((prev) =>
              docList.some((d) => d.id === prev) ? prev : docList[0].id
            );
          }
        }

        if (aptsRes.success && Array.isArray(aptsRes.data)) {
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
              triageAssessment?: {
                triaseLevel: string;
                systolic: number;
                diastolic: number;
                heartRate: number;
                temperature: number;
                respiratoryRate: number;
                spo2: number;
                beratBadan?: number | null;
                tinggiBadan?: number | null;
              } | null;
            }>
          ).map((a) => ({
            id: a.id,
            pasienId: a.patientId,
            pasienNama: a.patient?.name || "Pasien",
            pasienNik: a.patient?.nik || "-",
            faskesId: a.faskesId,
            faskesNama: a.faskes?.nama || "RSUP Dr. Sardjito",
            dokterId: a.doctorId,
            dokterNama: a.doctor?.name || "Dokter DPJP",
            poli: a.poli,
            tanggal: new Date(a.tanggal).toISOString().split("T")[0],
            jam: a.jam,
            keluhanAwal: a.keluhanAwal,
            status: (a.status as Appointment["status"]) || "WAITING_DOCTOR",
            consentActive: !!a.consentActive,
            triaseLevel: (a.triageAssessment?.triaseLevel as TriaseLevel) || undefined,
            triaseVitals: a.triageAssessment
              ? {
                  systolic: a.triageAssessment.systolic,
                  diastolic: a.triageAssessment.diastolic,
                  heartRate: a.triageAssessment.heartRate,
                  temperature: Number(a.triageAssessment.temperature),
                  respiratoryRate: a.triageAssessment.respiratoryRate,
                  spo2: a.triageAssessment.spo2,
                  beratBadan: a.triageAssessment.beratBadan
                    ? Number(a.triageAssessment.beratBadan)
                    : undefined,
                  tinggiBadan: a.triageAssessment.tinggiBadan
                    ? Number(a.triageAssessment.tinggiBadan)
                    : undefined,
                }
              : undefined,
          }));

          setAppointments(mappedApts);

          if (preselectedAptId && mappedApts.some((a) => a.id === preselectedAptId)) {
            setSelectedAptId(preselectedAptId);
          } else {
            const firstWaiting = mappedApts.find((a) => a.status === "WAITING_DOCTOR");
            if (firstWaiting) setSelectedAptId(firstWaiting.id);
          }
        }
      } catch (err) {
        console.warn("Gagal memuat daftar Assign DPJP dari PostgreSQL:", err);
      }
    }

    loadData();
  }, [preselectedAptId]);

  const isAptNotFound =
    appointments.length > 0 &&
    !!preselectedAptId &&
    !appointments.some((a) => a.id === preselectedAptId);
  const selectedApt = appointments.find((a) => a.id === selectedAptId) || null;
  const targetDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const handleAssignDpjp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotif(null);

    const validation = AssignDpjpSchema.safeParse({
      aptId: selectedAptId,
      doctorId: selectedDoctorId,
      inputPin: inputPin.trim(),
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Data penugasan DPJP tidak valid.");
      return;
    }

    if (!selectedApt) {
      setErrorMsg("Pilih antrean pasien yang valid terlebih dahulu.");
      return;
    }
    if (!targetDoctor) {
      setErrorMsg("Pilih dokter DPJP yang bertugas.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await assignDpjpServerAction({
        aptId: selectedAptId,
        doctorId: selectedDoctorId,
        inputPin: inputPin.trim(),
      });

      if (!res.success) {
        setErrorMsg(res.message || "Gagal menyimpan penugasan DPJP ke PostgreSQL.");
        return;
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selectedApt.id
            ? {
                ...a,
                status: "IN_EXAMINATION" as const,
                dokterId: targetDoctor.id,
                dokterNama: targetDoctor.name,
                dpjpId: targetDoctor.id,
                dpjpNama: targetDoctor.name,
              }
            : a
        )
      );

      setNotif(
        `Active Encounter Ticket diterbitkan di PostgreSQL! Pasien ${selectedApt.pasienNama} diarahkan ke ${targetDoctor.name} (DPJP).`
      );
      setInputPin("");
    } catch {
      setErrorMsg("Gagal menghubungi server untuk verifikasi PIN persetujuan pasien.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const queueWaitingDoctor = appointments.filter((a) => a.status === "WAITING_DOCTOR");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[
            { label: "Meja Staf Nakes", href: "/staf" },
            { label: "Pengarahan Dokter (DPJP)" },
          ]}
        />
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pengarahan Pasien ke Dokter Penanggung Jawab Pelayanan (DPJP)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Menampilkan hasil triase riil dari PostgreSQL dan menerbitkan <strong>Active Encounter Ticket</strong> terverifikasi PIN 6-digit.
        </p>
      </div>

      {isAptNotFound && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
          <span>
            Peringatan: Antrean dengan ID &quot;{preselectedAptId}&quot; tidak ditemukan dalam daftar atau belum menyelesaikan tahap triase keperawatan.
          </span>
          <span className="text-[10px] font-mono uppercase bg-amber-200 px-2 py-0.5 rounded">
            ID Tidak Terdaftar
          </span>
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Antrean Siap Temu Dokter */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">
            Pasien Selesai Triase ({queueWaitingDoctor.length})
          </h2>

          {queueWaitingDoctor.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Tidak ada pasien yang menunggu penugasan dokter saat ini.
            </p>
          ) : (
            <div className="space-y-2">
              {queueWaitingDoctor.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAptId(a.id)}
                  type="button"
                  className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                    selectedAptId === a.id
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-slate-500">{a.id}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        a.triaseLevel === "MERAH"
                          ? "bg-red-600 text-white border-red-700"
                          : a.triaseLevel === "KUNING"
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      Triase: {a.triaseLevel || "BELUM"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1">{a.pasienNama}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {a.triaseVitals
                      ? `TD: ${a.triaseVitals.systolic}/${a.triaseVitals.diastolic} • SpO2: ${a.triaseVitals.spo2}% • Suhu: ${a.triaseVitals.temperature}°C`
                      : "Belum ada tanda vital triase"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formulir Penugasan DPJP & Verifikasi Consent PIN */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-700">
                Formulir Penetapan DPJP & Enkripsi Tiket Sesi
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                Pasien: {selectedApt ? selectedApt.pasienNama : "Pilih Pasien"}
              </h2>
              <p className="text-xs text-slate-500">
                NIK: <span className="font-mono font-bold">{selectedApt?.pasienNik || "-"}</span> • Poli: {selectedApt?.poli || "-"}
              </p>
            </div>
            {selectedApt?.triaseLevel && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase self-start ${
                  selectedApt.triaseLevel === "MERAH"
                    ? "bg-red-600 text-white"
                    : selectedApt.triaseLevel === "KUNING"
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white"
                }`}
              >
                Prioritas {selectedApt.triaseLevel}
              </span>
            )}
          </div>

          {selectedApt?.triaseVitals && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">TD</span>
                <strong className="font-mono">
                  {selectedApt.triaseVitals.systolic}/{selectedApt.triaseVitals.diastolic}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">Nadi</span>
                <strong className="font-mono">{selectedApt.triaseVitals.heartRate}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">Suhu</span>
                <strong className="font-mono">{selectedApt.triaseVitals.temperature}°C</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">RR</span>
                <strong className="font-mono">{selectedApt.triaseVitals.respiratoryRate}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">SpO2</span>
                <strong className="font-mono">{selectedApt.triaseVitals.spo2}%</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">BB/TB</span>
                <strong className="font-mono">
                  {selectedApt.triaseVitals.beratBadan || "-"}/{selectedApt.triaseVitals.tinggiBadan || "-"}
                </strong>
              </div>
            </div>
          )}

          <form onSubmit={handleAssignDpjp} className="space-y-5">
            <div>
              <label htmlFor="dpjp-doctor-select" className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Pilih Dokter Penanggung Jawab Pelayanan (DPJP) *
              </label>
              <select
                id="dpjp-doctor-select"
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} — {doc.specialty} ({doc.hospital})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Dokter yang dipilih akan menerima Active Encounter Ticket resmi untuk mengakses dan menandatangani RME pasien ini.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label htmlFor="dpjp-consent-pin" className="block text-xs font-bold text-slate-700 uppercase">
                Verifikasi 6-Digit PIN Persetujuan Pasien (Wajib)
              </label>
              <div className="flex gap-2">
                <input
                  id="dpjp-consent-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Masukkan 6 digit PIN dari layar aplikasi pasien"
                  className="flex-1 px-4 py-2 border rounded-xl font-mono font-bold text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Pasien wajib menyebutkan 6-digit kode PIN yang tampil pada portal pasien mereka sebagai bukti persetujuan penunjukan DPJP (OWASP ASVS V2.1).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Jaminan Pemisahan Hak Akses (Separation of Duties):</p>
              <p>• Staf Nakes <strong>tidak dapat membaca isi rekam medis masa lalu</strong> pasien.</p>
              <p>• Setelah tombol ditekan, status tiket berpindah ke dokter terkait, dan dokter di poli lain akan diblokir oleh gateway (BOLA/IDOR Defense).</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !selectedApt}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {isSubmitting ? "Memverifikasi PIN & Menyimpan..." : "Tetapkan DPJP & Terbitkan Encounter Ticket →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function StafAssignDpjpPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm p-6">Memuat halaman penugasan DPJP...</div>}>
      <AssignDpjpContent />
    </Suspense>
  );
}
