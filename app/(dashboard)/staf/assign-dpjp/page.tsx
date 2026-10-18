"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MOCK_APPOINTMENTS,
  MOCK_DOCTORS,
  MOCK_ACCESS_GRANTS,
  MOCK_SECURITY_LOGS,
  getStorageData,
  setStorageData,
  Appointment,
  AccessGrant,
  SecurityAuditLog,
} from "@/lib/db/mockData";
import { getUserSession } from "@/lib/auth/auth";

function generateAssignId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

function AssignDpjpContent() {
  const searchParams = useSearchParams();
  const preselectedAptId = searchParams.get("aptId") || "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string>(preselectedAptId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("DOC-01");
  const [inputPin, setInputPin] = useState("");
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      setAppointments(allApts);
      if (!selectedAptId || !allApts.some((a) => a.id === selectedAptId)) {
        const pending = allApts.find((a) => a.status === "WAITING_DOCTOR");
        if (pending) setSelectedAptId(pending.id);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedAptId]);

  const isAptNotFound = !!preselectedAptId && !appointments.some((a) => a.id === preselectedAptId);
  const selectedApt = appointments.find((a) => a.id === selectedAptId) || null;
  const activeDoctors = MOCK_DOCTORS.filter((d) => d.accessStatus === "ACTIVE");
  const targetDoctor = activeDoctors.find((d) => d.id === selectedDoctorId) || activeDoctors[0];

  const handleAssignDpjp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) {
      alert("Pilih antrean pasien yang valid terlebih dahulu.");
      return;
    }
    if (!targetDoctor) {
      alert("Pilih dokter DPJP yang bertugas.");
      return;
    }

    // Validasi PIN atau persetujuan meja admisi
    if (selectedApt.consentPin && inputPin && inputPin !== selectedApt.consentPin) {
      alert("Kode PIN Persetujuan Pasien salah! Mintalah pasien melihat 6-digit PIN di aplikasi mereka.");
      return;
    }

    const session = getUserSession();

    // 1. Perbarui status Appointment menjadi IN_EXAMINATION dengan DPJP
    const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
    const updatedApts = allApts.map((a) =>
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
    );
    setStorageData("resilio_appointments", updatedApts);
    setAppointments(updatedApts);

    // 2. Terbitkan Active Encounter Ticket (AccessGrant) eksklusif untuk Dokter DPJP
    const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const newGrant: AccessGrant = {
      id: generateAssignId("GRANT-ENC"),
      pasienId: selectedApt.pasienId,
      pasienNama: selectedApt.pasienNama,
      entityId: targetDoctor.id,
      entityNama: targetDoctor.name,
      entityType: "DOKTER",
      scope: `DPJP Aktif: Pemeriksaan Rawat Jalan (${selectedApt.id})`,
      validUntil: "Hari Ini, 23:59 WIB",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };
    setStorageData("resilio_access_grants", [newGrant, ...allGrants]);

    // 3. Catat ke SIEM Event Log
    const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
    const newLog: SecurityAuditLog = {
      id: generateAssignId("LOG"),
      timestamp: new Date().toLocaleString("id-ID"),
      actorId: session?.id || "STF-01",
      actorName: session?.name || "Ners Maya Kartika",
      actorRole: "STAF",
      action: "ASSIGN_DPJP",
      targetResource: `/api/encounters/${selectedApt.id}`,
      ipAddress: "192.168.1.15 (Meja Admisi)",
      userAgent: navigator.userAgent,
      severity: "INFO",
      detail: `Staf menetapkan ${targetDoctor.name} sebagai DPJP pasien ${selectedApt.pasienNama}. Active Encounter Ticket diterbitkan.`,
    };
    setStorageData("resilio_security_logs", [newLog, ...logs]);

    setNotif(
      `Active Encounter Ticket berhasil diterbitkan! Pasien ${selectedApt.pasienNama} kini diarahkan ke ${targetDoctor.name} (DPJP). Dokter lain di luar ruangan terkunci oleh BOLA Gate.`
    );
    setInputPin("");
    setTimeout(() => setNotif(null), 5000);
  };

  const queueWaitingDoctor = appointments.filter((a) => a.status === "WAITING_DOCTOR");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
          <Link href="/staf" className="hover:underline">
            Meja Staf Nakes
          </Link>
          <span>/</span>
          <span>Penugasan DPJP & Active Encounter Ticket (UR-S03)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pengarahan Pasien ke Dokter Penanggung Jawab Pelayanan (DPJP)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Menerbitkan <strong>Active Encounter Ticket</strong> sementara. Hanya dokter yang ditugaskan resmi yang memiliki wewenang membuka dan menulis rekam medis pasien selama sesi pemeriksaan.
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
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Antrean Siap Temu Dokter */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">
            Pasien Selesai Triase ({queueWaitingDoctor.length})
          </h2>

          {queueWaitingDoctor.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
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
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {a.id}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        a.triaseLevel === "MERAH"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : a.triaseLevel === "KUNING"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      Triase: {a.triaseLevel || "HIJAU"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1">{a.pasienNama}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tensi: {a.triaseVitals ? `${a.triaseVitals.systolic}/${a.triaseVitals.diastolic} mmHg` : "-"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formulir Penugasan DPJP & Verifikasi Consent PIN */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-black uppercase text-amber-700">
              Formulir Penetapan DPJP & Enkripsi Tiket Sesi
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              Pasien: {selectedApt ? selectedApt.pasienNama : "Pilih Pasien"}
            </h2>
            <p className="text-xs text-slate-500">
              NIK: <span className="font-mono font-bold">{selectedApt?.pasienNik}</span> • Poli: {selectedApt?.poli}
            </p>
          </div>

          <form onSubmit={handleAssignDpjp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Pilih Dokter Penanggung Jawab Pelayanan (DPJP) yang Bertugas *
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {activeDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} — {doc.specialty} ({doc.hospital})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Dokter yang dipilih akan menerima kunci pembungkus (*Envelope Encryption*) untuk mendekripsi RME pasien ini.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Verifikasi 6-Digit PIN Persetujuan Pasien (Opsional / Loket Walk-in)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder={`Contoh PIN Pasien: ${selectedApt?.consentPin || "884120"}`}
                  className="flex-1 px-4 py-2 border rounded-xl font-mono font-bold text-sm"
                />
                <button
                  type="button"
                  onClick={() => setInputPin(selectedApt?.consentPin || "884120")}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700"
                >
                  Gunakan PIN Demo
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Di rumah sakit nyata, pasien menyebutkan 6-digit kode PIN yang muncul di layar HP mereka untuk mengonfirmasi bahwa mereka menyetujui dokter tersebut menjadi DPJP-nya.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">
                Jaminan Pemisahan Hak Akses (Separation of Duties):
              </p>
              <p>
                • Staf Nakes <strong>tidak dapat membaca isi rekam medis masa lalu</strong> pasien.
              </p>
              <p>
                • Setelah tombol ditekan, status tiket berpindah ke dokter terkait, dan dokter di poli lain akan diblokir oleh gateway (BOLA/IDOR Defense).
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                Sahkan DPJP & Terbitkan Active Encounter Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AssignDpjpPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm">Memuat halaman penugasan DPJP...</div>}>
      <AssignDpjpContent />
    </Suspense>
  );
}
