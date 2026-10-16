"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_ACCESS_GRANTS,
  getStorageData,
  Appointment,
  Patient,
  AccessGrant,
} from "@/lib/db/mockData";

export default function PasienDashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);

  useEffect(() => {
    const s = getUserSession();
    if (s) {
      setSession(s);
      const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
      const found = allPatients.find((p) => p.id === s.id || p.nik === s.nik) || allPatients[0];
      setPatientData(found);

      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      setAppointments(allApts.filter((a) => a.pasienId === found.id || a.pasienNik === found.nik));

      const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
      setGrants(allGrants.filter((g) => g.pasienId === found.id));
    }
  }, []);

  if (!session || !patientData) return null;

  const activeGrantsCount = grants.filter((g) => !g.isRevoked).length;

  return (
    <div className="space-y-8">
      {/* Header Selamat Datang */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Portal Rekam Medis Pribadi Terintegrasi
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Halo, {patientData.name}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Nomor Induk Kependudukan (NIK):{" "}
            <span className="font-mono font-bold text-slate-800">{patientData.nik}</span> • No. Rekam Medis:{" "}
            <span className="font-mono font-bold text-slate-800">{patientData.mrn}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pasien/faskes"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
          >
            Cari Faskes & Dokter
          </Link>
          <Link
            href="/pasien/booking"
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-300 shadow-xs transition"
          >
            Booking Jadwal
          </Link>
        </div>
      </div>

      {/* Emergency Medical Card & Critical Allergy Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Kartu Darurat Medis Nasional (Resilio ID)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
              KYC Terverifikasi (Dukcapil)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Golongan Darah</p>
              <p className="text-2xl font-black text-red-400 mt-0.5">{patientData.bloodType}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Usia / Gender</p>
              <p className="text-lg font-bold mt-0.5">
                {patientData.age} Thn ({patientData.gender === "L" ? "Laki-laki" : "Perempuan"})
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Kontak Darurat</p>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">
                {patientData.emergencyContact.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {patientData.emergencyContact.phone}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Kunci Enkripsi Klien</p>
              <p className="text-[10px] font-mono text-emerald-400 truncate mt-0.5" title={patientData.encryptionKeyHex}>
                {patientData.encryptionKeyHex.slice(0, 16)}...
              </p>
              <span className="text-[9px] text-slate-400">Zero-Knowledge Storage</span>
            </div>
          </div>

          {/* Alert Alergi Kritis */}
          {patientData.allergies.length > 0 ? (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-200 text-xs">
              <div>
                <span className="font-bold uppercase tracking-wider text-red-400">Peringatan Alergi Kritis: </span>
                <span className="font-semibold text-white">
                  {patientData.allergies.join(", ")}
                </span>
                <span className="block text-[10px] text-red-300 mt-0.5">
                  Ditampilkan mencolok pada stasiun kerja dokter saat Anda menjalani pemeriksaan fisik.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-medium">
              Tidak ada riwayat alergi obat berbahaya yang tercatat.
            </div>
          )}
        </div>

        {/* Status Privasi & Izin Akses */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Kedaulatan Data Medis Pasien
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Hak Akses Aktif (Consent)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Anda memegang kendali penuh atas rekam medis Anda. Dokter atau rumah sakit hanya dapat membaca rekam medis jika memiliki tiket izin aktif.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Faskes/Dokter Diizinkan:</span>
              <span className="text-sm font-black text-blue-600">{activeGrantsCount} Entitas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Pencabutan Akses (Revoke):</span>
              <span className="text-xs font-bold text-emerald-600">Didukung 1-Click</span>
            </div>
          </div>

          <Link
            href="/pasien/consent"
            className="w-full text-center py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Kelola Izin & Cabut Akses →
          </Link>
        </div>
      </div>

      {/* Jadwal Booking Mendatang & Aksi Cepat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Jadwal Pemeriksaan Mendatang
            </h3>
            <Link href="/pasien/booking" className="text-xs font-bold text-blue-600 hover:underline">
              Lihat Semua →
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Belum ada jadwal konsultasi dokter yang dipesan.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 3).map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600">
                      {apt.poli} • {apt.faskesNama}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 mt-0.5">{apt.dokterNama}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jadwal: {apt.tanggal} pukul {apt.jam}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      apt.status === "IN_PROGRESS"
                        ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }`}
                  >
                    {apt.status === "IN_PROGRESS" ? "Sedang Diperiksa" : "Menunggu"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu Navigasi Cepat Pasien */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Menu Layanan Terintegrasi</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pasien/rekam-medis"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-red-700">
                Riwayat RME & Vital Signs
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Dekripsi riwayat rekam medis pribadi dan grafik tensi.
              </p>
            </Link>

            <Link
              href="/pasien/faskes"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                Cari Faskes Pintar
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Cari klinik & RS berdasarkan keluhan penyakit atau poli.
              </p>
            </Link>

            <Link
              href="/pasien/audit-log"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
                Audit Trail Pribadi
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Transparansi siapa dan kapan data Anda dibuka (UU PDP).
              </p>
            </Link>

            <Link
              href="/pasien/tiket-kendala"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                Pusat Kendala & Bug
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Laporkan ketidaksesuaian data medis ke Admin Regulator.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
