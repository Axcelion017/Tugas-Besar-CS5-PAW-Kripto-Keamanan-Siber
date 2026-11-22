"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession, normalizeRole } from "@/lib/auth/auth";
import {
  MOCK_APPOINTMENTS,
  getStorageData,
  Appointment,
} from "@/lib/db/mockData";
import { getDoctorPatientListServerAction } from "@/lib/actions/clinical";
import { getAppointmentsServerAction } from "@/lib/actions/appointment";

export default function BerandaPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    totalPatients: 4,
    totalAppointments: 4,
    totalRecords: 5,
  });

  useEffect(() => {
    async function loadData() {
      const s = getUserSession();
      if (s) {
        setSession(s);
        try {
          const [patientRes, aptRes] = await Promise.all([
            getDoctorPatientListServerAction(s.id),
            getAppointmentsServerAction({}),
          ]);

          setStatsData({
            totalPatients: patientRes.success ? patientRes.stats.totalPatients : 4,
            totalAppointments: aptRes.success && aptRes.data ? aptRes.data.length : 4,
            totalRecords: patientRes.success ? patientRes.stats.signedCount + patientRes.stats.unsignedCount : 5,
          });
        } catch (err) {
          console.warn("Beranda live stats fetch fallback:", err);
        }
      }
      setIsLoading(false);
    }

    loadData();
  }, []);

  if (isLoading || !session) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Memuat ringkasan informasi beranda...</p>
      </div>
    );
  }

  const role = normalizeRole(session.role);
  const allAppointments = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);

  return (
    <div className="space-y-6 font-sans">
      {/* ============================================================== */}
      {/* 1. BERANDA KHUSUS DOKTER DPJP (NAKES)                           */}
      {/* ============================================================== */}
      {role === "nakes" && (
        <div className="space-y-6">
          {/* Header Sambutan Dokter */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Stasiun Kerja Dokter DPJP
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  STR: {session.strNumber || "STR-3171-88921"} • SIP: {session.sipNumber || "503/SIP.01/2026"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Selamat Bertugas, {session.name}
              </h1>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Spesialisasi: <strong>{session.specialization || "Spesialis Penyakit Dalam"}</strong> di <strong>{session.faskesName || "RSUP Dr. Sardjito"}</strong>. Akses rekam medis dilindungi protokol enkripsi klien Zero-Knowledge dengan audit trail otomatis anti-BOLA/IDOR.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div>
                Fasilitas Praktik Utama: <strong className="text-white">{session.faskesName || "RSUP Dr. Sardjito"}</strong>
              </div>
              <div className="font-mono text-[11px] text-emerald-400">
                W3C Web Crypto: Aktif (256-Bit Key) • Permenkes RI No. 24/2022
              </div>
            </div>
          </div>

          {/* 4 Kartu Metrik Dokter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Antrean Hari Ini
              </span>
              <p className="text-2xl font-black text-slate-900">{statsData.totalAppointments} Pasien</p>
              <p className="text-[11px] text-slate-500">Pasien menunggu giliran konsultasi klinis.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Total Pasien Binaan
              </span>
              <p className="text-2xl font-black text-slate-900">{statsData.totalPatients} Pasien</p>
              <p className="text-[11px] text-slate-500">Data rekam medis terdaftar dalam basis data.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Menunggu TTD SOAP
              </span>
              <p className="text-2xl font-black text-slate-900">1 Berkas</p>
              <p className="text-[11px] text-slate-500">Memerlukan validasi tanda tangan elektronik.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Jadwal Praktik Aktif
              </span>
              <p className="text-2xl font-black text-slate-900">3 Faskes</p>
              <p className="text-[11px] text-slate-500">RSUP Sardjito, Harapan Sehat, Bethesda.</p>
            </div>
          </div>

          {/* Tabel Antrean Konsultasi Hari Ini */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Daftar Antrean Konsultasi Pasien Hari Ini
                </h2>
                <p className="text-xs text-slate-500">
                  Prioritas kegawatan pasien berdasarkan skrining tanda vital triase.
                </p>
              </div>
              <Link
                href="/nakes"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
              >
                Buka Stasiun Nakes Lengkap →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Jam</th>
                    <th className="py-3 px-4">Nama Pasien</th>
                    <th className="py-3 px-4">Poliklinik</th>
                    <th className="py-3 px-4">Prioritas Triase</th>
                    <th className="py-3 px-4">Keluhan Awal</th>
                    <th className="py-3 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allAppointments.slice(0, 4).map((apt) => {
                    const isMerah = apt.triaseLevel === "MERAH";
                    const isKuning = apt.triaseLevel === "KUNING";
                    return (
                      <tr key={apt.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{apt.jam} WIB</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{apt.pasienNama}</td>
                        <td className="py-3.5 px-4 text-slate-600">{apt.poli}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isMerah
                                ? "bg-red-50 text-red-700 border-red-200"
                                : isKuning
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {apt.triaseLevel || "HIJAU"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">{apt.keluhanAwal}</td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/nakes/periksa/${apt.id}`}
                            className="inline-block px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition"
                          >
                            Periksa Pasien
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pintasan Aksi Cepat Dokter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/nakes/pasien-lookup"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition group space-y-1.5 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Pencarian &amp; Rekam Medis
              </span>
              <p className="text-sm font-black text-slate-900 group-hover:text-emerald-700">
                Daftar Pasien &amp; RME Lengkap →
              </p>
              <p className="text-[11px] text-slate-500">
                Lihat riwayat RME terenkripsi, tambah resep obat, hasil lab, &amp; tindakan ICD-9.
              </p>
            </Link>

            <Link
              href="/nakes/jadwal"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-1.5 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Alokasi Waktu Praktik
              </span>
              <p className="text-sm font-black text-slate-900 group-hover:text-blue-700">
                Kalender Jadwal Mingguan →
              </p>
              <p className="text-[11px] text-slate-500">
                Kelola jadwal praktik Senin s.d. Minggu lintas fasilitas pelayanan kesehatan.
              </p>
            </Link>

            <Link
              href="/nakes/rujukan"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition group space-y-1.5 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Layanan Antar Faskes
              </span>
              <p className="text-sm font-black text-slate-900 group-hover:text-purple-700">
                Surat Rujukan Digital Konsulen →
              </p>
              <p className="text-[11px] text-slate-500">
                Terbitkan surat rujukan berstandar SATUSEHAT untuk dokter spesialis konsulen.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. BERANDA KHUSUS PASIEN MANDIRI                                */}
      {/* ============================================================== */}
      {role === "pasien" && (
        <div className="space-y-6">
          {/* Header Sambutan Pasien */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Dompet Rekam Medis Elektronik Mandiri
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  MRN: RM-2026-0891 • NIK: 317101******0001 (Terverifikasi Dukcapil)
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Selamat Datang, {session.name}
              </h1>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Seluruh data kesehatan Anda dilindungi secara mandiri menggunakan enkripsi berdaulat <strong>AES-256-GCM</strong>. Tenaga medis hanya dapat mengakses riwayat medis Anda setelah Anda memberikan izin persetujuan (*Consent*).
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div>
                Status Kedaulatan Kriptografi: <strong className="text-emerald-400 font-mono">Zero-Knowledge Aktif</strong>
              </div>
              <div className="text-[11px] text-slate-300">
                Golongan Darah: <strong>O+</strong> • Alergi: <strong>Penisilin (Ringan)</strong>
              </div>
            </div>
          </div>

          {/* 4 Kartu Metrik Pasien */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Jadwal Kunjungan
              </span>
              <p className="text-2xl font-black text-slate-900">Hari Ini, 08:30</p>
              <p className="text-[11px] text-slate-500">Poli Penyakit Dalam RSUP Sardjito.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Berkas RME Tersimpan
              </span>
              <p className="text-2xl font-black text-slate-900">2 Dokumen</p>
              <p className="text-[11px] text-slate-500">Terenkripsi AES-256-GCM di peramban.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Izin Akses Dokter
              </span>
              <p className="text-2xl font-black text-slate-900">1 Dokter Aktif</p>
              <p className="text-[11px] text-slate-500">dr. Andi Pratama, Sp.PD (Valid 24 Jam).</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                Tekanan Darah Terakhir
              </span>
              <p className="text-2xl font-black text-slate-900">130/85 mmHg</p>
              <p className="text-[11px] text-slate-500">Kondisi pra-hipertensi terpantau baik.</p>
            </div>
          </div>

          {/* Kotak Janji Temu Mendatang & Riwayat RME */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Janji Temu Aktif */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Janji Temu Pemeriksaan Terdekat
                </h2>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  Siap Dilayani
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-800 text-sm">Poli Penyakit Dalam</span>
                  <span className="font-mono text-emerald-700 font-bold">08:30 WIB</span>
                </div>
                <p className="text-slate-600">
                  Dokter DPJP: <strong>dr. Andi Pratama, Sp.PD</strong>
                </p>
                <p className="text-slate-600">
                  Faskes: <strong>RSUP Dr. Sardjito</strong>
                </p>
                <p className="text-slate-500 text-[11px]">
                  Keluhan Terdaftar: Kontrol berkala tekanan darah dan evaluasi obat hipertensi rutin.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/pasien/rekam-medis"
                  className="flex-1 py-2 text-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Buka Rekam Medis Saya
                </Link>
                <Link
                  href="/pasien/consent"
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition text-center"
                >
                  Izin Akses
                </Link>
              </div>
            </div>

            {/* Riwayat Rekam Medis & Resep Terkini */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Riwayat Diagnosa &amp; Resep Terakhir
                </h2>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  15 Oktober 2026
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-800">
                    Diagnosis Primer (ICD-10)
                  </span>
                  <p className="font-bold text-slate-900">
                    I10 - Essential (primary) hypertension
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Hipertensi primer stadium 1 terkontrol dengan terapi kombinasi.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-800">
                    Resep Obat Aktif
                  </span>
                  <p className="font-bold text-slate-900">
                    Amlodipine 10mg (1x sehari pagi) &amp; Captopril 25mg (2x sehari)
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Diminum teratur sesudah makan. Pantau tensi secara berkala.
                  </p>
                </div>
              </div>

              <Link
                href="/pasien/rekam-medis"
                className="block text-center py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
              >
                Cetak / Unduh Resume Medis Resmi →
              </Link>
            </div>
          </div>

          {/* Pintasan Aksi Cepat Pasien */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Link
              href="/pasien/booking"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Booking Pemeriksaan</p>
              <p className="text-[10px] text-slate-500">Pilih poli &amp; dokter spesialis</p>
            </Link>

            <Link
              href="/pasien/rekam-medis"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Rekam Medis (RME)</p>
              <p className="text-[10px] text-slate-500">Dekripsi SOAP &amp; hasil lab</p>
            </Link>

            <Link
              href="/pasien/consent"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Izin Akses Dokter</p>
              <p className="text-[10px] text-slate-500">Kedaulatan izin privasi data</p>
            </Link>

            <Link
              href="/pasien/audit-log"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Notifikasi Keamanan</p>
              <p className="text-[10px] text-slate-500">Audit trail akses data medis</p>
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. BERANDA KHUSUS STAF NAKES (TRIASE & ADMISI)                  */}
      {/* ============================================================== */}
      {role === "staf" && (
        <div className="space-y-6">
          {/* Header Sambutan Staf */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Meja Staf Triase &amp; Admisi
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Posisi: {session.posisiStaf || "Perawat Triase Loket Admisi"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Selamat Bertugas, {session.name}
              </h1>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Pusat pengkajian tanda vital fisik pasien di loket kedatangan rawat jalan &amp; IGD. Lakukan klasifikasi kegawatan (P1 Merah, P2 Kuning, P3 Hijau) dan teruskan ke Dokter DPJP.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div>
                Fasilitas Faskes: <strong className="text-white">{session.faskesName || "RSUP Dr. Sardjito"}</strong>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                Protokol Triase ESI &amp; Validasi Integritas HMAC Aktif
              </div>
            </div>
          </div>

          {/* 4 Kartu Metrik Staf */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Total Admisi Hari Ini
              </span>
              <p className="text-2xl font-black text-slate-900">{statsData.totalAppointments} Pasien</p>
              <p className="text-[11px] text-slate-500">Pasien yang terdaftar di loket admisi.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-700">
                Prioritas P1 (Merah)
              </span>
              <p className="text-2xl font-black text-slate-900">1 Pasien</p>
              <p className="text-[11px] text-slate-500">Kondisi darurat memerlukan resusitasi.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Prioritas P2 (Kuning)
              </span>
              <p className="text-2xl font-black text-slate-900">1 Pasien</p>
              <p className="text-[11px] text-slate-500">Kondisi mendesak dengan gejala akut.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Prioritas P3 (Hijau)
              </span>
              <p className="text-2xl font-black text-slate-900">2 Pasien</p>
              <p className="text-[11px] text-slate-500">Pemeriksaan rutin non-urgent poliklinik.</p>
            </div>
          </div>

          {/* Tabel Loket Admisi Cepat */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Daftar Pasien Loket Kedatangan
                </h2>
                <p className="text-xs text-slate-500">
                  Lakukan input tensi, nadi, suhu, dan saturasi oksigen untuk menetapkan skala triase.
                </p>
              </div>
              <Link
                href="/staf/triase"
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition"
              >
                Buka Formulir Triase Lengkap →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Jam</th>
                    <th className="py-3 px-4">Pasien</th>
                    <th className="py-3 px-4">Poli Tujuan</th>
                    <th className="py-3 px-4">Skala Triase</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{apt.jam} WIB</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{apt.pasienNama}</td>
                      <td className="py-3.5 px-4 text-slate-600">{apt.poli}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {apt.triaseLevel || "BELUM DITRIASE"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href="/staf/triase"
                          className="inline-block px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
                        >
                          Input Tanda Vital
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pintasan Aksi Cepat Staf */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/staf/triase"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-1 block"
            >
              <p className="text-sm font-black text-slate-900 group-hover:text-blue-700">
                Pemeriksaan Triase Pasien →
              </p>
              <p className="text-[11px] text-slate-500">
                Input tensi darah, nadi, suhu tubuh, SpO2, dan cetak bukti lembar triase.
              </p>
            </Link>

            <Link
              href="/staf/assign-dpjp"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-1 block"
            >
              <p className="text-sm font-black text-slate-900 group-hover:text-blue-700">
                Penugasan Dokter DPJP →
              </p>
              <p className="text-[11px] text-slate-500">
                Arahkan pasien pasca-triase ke ruangan konsultasi dokter spesialis yang bertugas.
              </p>
            </Link>

            <Link
              href="/staf/rujukan"
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-1 block"
            >
              <p className="text-sm font-black text-slate-900 group-hover:text-blue-700">
                Rujukan Masuk Faskes →
              </p>
              <p className="text-[11px] text-slate-500">
                Validasi surat rujukan digital dari puskesmas atau rumah sakit rujukan.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. BERANDA KHUSUS ADMINISTRATOR KEMENKES (SIEM & REGULASI)      */}
      {/* ============================================================== */}
      {role === "admin" && (
        <div className="space-y-6">
          {/* Header Sambutan Admin */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  Konsol Pengawas Regulasi &amp; Kepatuhan SIEM
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Sertifikasi KKS: sec-0.2 • Lynis Score: 72/100
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Selamat Datang, {session.name}
              </h1>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Pemantauan terpusat kepatuhan <strong>Permenkes RI No. 24 Tahun 2022</strong>, penegakan UU PDP No. 27/2022, verifikasi identitas e-KYC NIK/STR, serta pengawasan integritas arsitektur Zero-Trust.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div>
                Lingkungan Node: <strong className="text-white">resilio-node (Ubuntu 22.04 LTS Hardened)</strong>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                SSH Password: DITOLAK • Root Login: DITOLAK • Database 5432: TERISOLASI
              </div>
            </div>
          </div>

          {/* 4 Kartu Metrik Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Skor Audit Lynis
              </span>
              <p className="text-2xl font-black text-slate-900">72 / 100</p>
              <p className="text-[11px] text-emerald-700 font-bold">Lulus Ambang Batas KKS (&ge; 70).</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Total Pasien Terdata
              </span>
              <p className="text-2xl font-black text-slate-900">{statsData.totalPatients} Pasien</p>
              <p className="text-[11px] text-slate-500">100% data kependudukan tervalidasi.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Verifikasi STR/SIP
              </span>
              <p className="text-2xl font-black text-slate-900">1 Pending</p>
              <p className="text-[11px] text-slate-500">Menunggu pengecekan KKI / Kemenkes.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Percobaan Akses Ilegal
              </span>
              <p className="text-2xl font-black text-slate-900">0 Kebobolan</p>
              <p className="text-[11px] text-slate-500">Semua pelanggaran BOLA/IDOR diblokir.</p>
            </div>
          </div>

          {/* Panel Audit Keamanan & Kepatuhan */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Status Kepatuhan Keamanan Siber &amp; Pengerasan Sistem
              </h2>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                STATUS: AMAN &amp; TERKONTROL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-600">Enkripsi Basis Data</span>
                <p className="font-bold text-slate-900">AES-256-GCM + HMAC-SHA256</p>
                <p className="text-slate-500 text-[11px]">Database administrator tidak memiliki akses plain text.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-600">Hardening Node OS</span>
                <p className="font-bold text-slate-900">SSH Key-Only, Root Disabled</p>
                <p className="text-slate-500 text-[11px]">Password authentication ditolak pada node resilio-node.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-600">Pemindaian Kerentanan</span>
                <p className="font-bold text-slate-900">0 Critical Vulnerability</p>
                <p className="text-slate-500 text-[11px]">Image Docker akhir bersih dari celah keamanan kritis.</p>
              </div>
            </div>
          </div>

          {/* Pintasan Aksi Cepat Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Link
              href="/admin/verifikasi-kyc"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Verifikasi NIK Pasien</p>
              <p className="text-[10px] text-slate-500">Validasi e-KYC Dukcapil</p>
            </Link>

            <Link
              href="/admin/verifikasi-kyd"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Verifikasi STR Dokter</p>
              <p className="text-[10px] text-slate-500">Validasi SIP &amp; Konsil Medis</p>
            </Link>

            <Link
              href="/admin/siem-monitor"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">SIEM Security Monitor</p>
              <p className="text-[10px] text-slate-500">Audit trail akses ilegal</p>
            </Link>

            <Link
              href="/admin/faskes"
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-xs transition block text-center space-y-1"
            >
              <p className="text-xs font-black text-slate-900">Master Rumah Sakit</p>
              <p className="text-[10px] text-slate-500">Konektivitas SATUSEHAT</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
