"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SkeletonDisruptionNotice } from "@/components/ui/Skeleton";
import { VitalSignsTrendChart } from "@/components/clinical/VitalSignsTrendChart";
import type { PasienDashboardServerData } from "@/features/medical-records/queries";

export function PasienDashboardClient({ data }: { data: PasienDashboardServerData }) {
  const { patient, appointments, activeGrantsCount, recordsCount, vitalMetrics } = data;
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<string>("SELF");
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const syncOffline = () => {
      const simulated = localStorage.getItem("resilio_network_mode") === "offline";
      const browserOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setIsOfflineMode(simulated || browserOffline);
    };
    const timer = setTimeout(syncOffline, 0);
    window.addEventListener("storage", syncOffline);
    window.addEventListener("online", syncOffline);
    window.addEventListener("offline", syncOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", syncOffline);
      window.removeEventListener("online", syncOffline);
      window.removeEventListener("offline", syncOffline);
    };
  }, []);

  const activeFamilyMember =
    selectedFamilyMember === "SELF"
      ? null
      : patient.familyMembers.find((f) => f.id === selectedFamilyMember) || null;

  const displayedName = activeFamilyMember ? activeFamilyMember.name : patient.name;
  const displayedNik = activeFamilyMember ? activeFamilyMember.nik : patient.nik;
  const displayedAge = activeFamilyMember ? activeFamilyMember.age : patient.age;
  const isVerified = patient.statusKyc === "VERIFIED";

  return (
    <div className="space-y-8">
      {isOfflineMode && (
        <SkeletonDisruptionNotice message="Mode Offline Aktif: Anda tetap dapat meninjau identitas darurat, namun pemesanan jadwal dan pembaruan izin membutuhkan jaringan." />
      )}

      {/* Restricted Mode Banner jika belum e-KYC */}
      {!isVerified && (
        <div
          role="alert"
          className="p-5 rounded-3xl bg-amber-50 border border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
              {patient.statusKyc === "REJECTED"
                ? "Verifikasi e-KYC Ditolak — Perlu Pengajuan Ulang"
                : "Mode Terbatas — Menunggu Verifikasi e-KYC NIK"}
            </span>
            <p className="text-xs text-amber-950 font-medium">
              Lengkapi NIK 16 digit dan unggah dokumen e-KTP di halaman Profil untuk membuka seluruh
              layanan medis nasional.
            </p>
          </div>
          <Link
            href="/pasien/profil"
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 text-center"
          >
            Lengkapi e-KYC →
          </Link>
        </div>
      )}

      {/* Kartu Identitas Medis & Pengalih Akun Keluarga */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30">
                Kartu Medis Digital JagaMedis
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  isVerified
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                    : "bg-amber-500/20 text-amber-200 border-amber-400/40"
                }`}
              >
                e-KYC: {patient.statusKyc}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2">{displayedName}</h1>
            <p className="text-xs text-slate-300 font-mono mt-1">
              NIK: {displayedNik || "Belum Terverifikasi"} • MRN: {patient.mrn} • Usia:{" "}
              {displayedAge} th • Gol. Darah: {patient.bloodType}
            </p>
          </div>

          {patient.familyMembers.length > 0 && (
            <div className="bg-white/10 p-3 rounded-2xl border border-white/15">
              <label
                htmlFor="family-proxy-select"
                className="block text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1"
              >
                Profil Keluarga (Family Proxy)
              </label>
              <select
                id="family-proxy-select"
                value={selectedFamilyMember}
                onChange={(e) => setSelectedFamilyMember(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20"
              >
                <option value="SELF">{patient.name} (Pemilik Akun)</option>
                {patient.familyMembers.map((fam) => (
                  <option key={fam.id} value={fam.id}>
                    {fam.name} ({fam.relation})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Badge Alergi & Kontak Darurat */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-300 font-bold">Riwayat Alergi:</span>
            {patient.allergies.length > 0 ? (
              patient.allergies.map((al) => (
                <span
                  key={al}
                  className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-black uppercase text-[10px]"
                >
                  {al}
                </span>
              ))
            ) : (
              <span className="text-emerald-300 font-semibold">Tidak ada alergi tercatat</span>
            )}
          </div>
          <span className="text-slate-300">
            Kontak Darurat: <strong className="text-white">{patient.emergencyContact.name}</strong> (
            {patient.emergencyContact.phone})
          </span>
        </div>
      </div>

      {/* Ringkasan 4 Metrik Cepat */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/pasien/rekam-medis"
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 transition"
        >
          <p className="text-[10px] font-black uppercase text-blue-700">Rekam Medis</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{recordsCount}</p>
          <span className="text-[11px] text-slate-500">Berkas Terenkripsi →</span>
        </Link>
        <Link
          href="/pasien/booking"
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 transition"
        >
          <p className="text-[10px] font-black uppercase text-emerald-700">Kunjungan</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{appointments.length}</p>
          <span className="text-[11px] text-slate-500">Tiket Antrean →</span>
        </Link>
        <Link
          href="/pasien/consent"
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-400 transition"
        >
          <p className="text-[10px] font-black uppercase text-amber-700">Izin Akses UU PDP</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{activeGrantsCount}</p>
          <span className="text-[11px] text-slate-500">Entitas Aktif →</span>
        </Link>
        <Link
          href="/pasien/audit-log"
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-purple-400 transition"
        >
          <p className="text-[10px] font-black uppercase text-purple-700">Transparansi Log</p>
          <p className="text-2xl font-black text-slate-900 mt-1">100%</p>
          <span className="text-[11px] text-slate-500">Audit Akses RME →</span>
        </Link>
      </div>

      {/* Grafik Tren Tanda Vital (Jujur tanpa data palsu) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900">
            Tren Tanda Vital Klinis (PostgreSQL)
          </h2>
          <p className="text-xs text-slate-500">
            Disusun otomatis dari hasil pemeriksaan rekam medis resmi Anda.
          </p>
        </div>

        {vitalMetrics.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">
              Belum ada riwayat pengukuran tanda vital tercatat.
            </p>
            <p className="text-xs text-slate-500">
              Grafik akan tampil otomatis setelah pemeriksaan klinis Anda selesai ditandatangani
              dokter.
            </p>
            <Link
              href="/pasien/booking"
              className="inline-block mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase"
            >
              Pesan Jadwal Konsultasi →
            </Link>
          </div>
        ) : (
          <VitalSignsTrendChart data={vitalMetrics} />
        )}
      </div>

      {/* Daftar Jadwal Kunjungan Terbaru + PIN 6-Digit */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">Jadwal & Tiket Kunjungan Anda</h2>
          <Link href="/pasien/booking" className="text-xs font-bold text-blue-700 hover:underline">
            + Pesan Jadwal Baru
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {appointments.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">
              Belum ada jadwal kunjungan. Silakan pesan jadwal melalui menu Booking Faskes.
            </p>
          ) : (
            appointments.slice(0, 5).map((apt) => (
              <div
                key={apt.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-600">{apt.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-800 border border-blue-200">
                      {apt.status}
                    </span>
                    {apt.triaseLevel && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                        Triase: {apt.triaseLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    {apt.faskesNama} — {apt.poli}
                  </p>
                  <p className="text-xs text-slate-600">
                    {apt.dokterNama} • {apt.tanggal} ({apt.jam})
                  </p>
                </div>

                {apt.consentPin && apt.status !== "COMPLETED" && (
                  <div className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-center shrink-0">
                    <span className="block text-[10px] uppercase text-slate-300 font-bold">
                      PIN Consent 6-Digit
                    </span>
                    <span className="font-mono text-base font-black tracking-widest text-emerald-400">
                      {apt.consentPin}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
