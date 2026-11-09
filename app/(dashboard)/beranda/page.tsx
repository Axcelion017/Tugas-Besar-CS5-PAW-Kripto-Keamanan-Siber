"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession, normalizeRole } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  getStorageData,
} from "@/lib/db/mockData";

export default function BerandaPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getUserSession();
      if (s) {
        setSession(s);
      }
      setIsLoading(false);
    }, 0);
    return () => clearTimeout(timer);
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
  const allPatients = getStorageData("resilio_patients", MOCK_PATIENTS);
  const allAppointments = getStorageData("resilio_appointments", MOCK_APPOINTMENTS);

  return (
    <div className="space-y-6">
      {/* Banner Sambutan & Status Pengguna */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Resilio-Health HIS &amp; Dompet RME Berdaulat
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Role: {role.toUpperCase()}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Selamat Datang, {session.name}
          </h1>

          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Sistem Informasi Rumah Sakit terintegrasi dengan kedaulatan data pasien berbasis enkripsi <strong>AES-256-GCM</strong>, verifikasi integritas <strong>HMAC-SHA256</strong>, kepatuhan <strong>Permenkes RI No. 24/2022</strong>, dan kesiapan SATUSEHAT.
          </p>
        </div>

        {/* Info Faskes & Sesi */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div>
            Fasilitas Pelayanan Kesehatan: <strong className="text-white">{session.faskesName || "RSUP Dr. Sardjito"}</strong>
          </div>
          <div className="font-mono text-[11px] text-emerald-400">
            W3C Web Crypto Klien: Aktif (256-Bit Key)
          </div>
        </div>
      </div>

      {/* 3 Indikator Utama Kepatuhan & Keamanan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            Kriptografi Zero-Knowledge
          </span>
          <p className="text-sm font-black text-slate-900">AES-256-GCM + HKDF</p>
          <p className="text-[11px] text-slate-500">
            Rekam medis didekripsi di peramban, server hanya menyimpan ciphertext.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
            Standar RME Permenkes 24/2022
          </span>
          <p className="text-sm font-black text-slate-900">9 Komponen SOAP &amp; ICD-10</p>
          <p className="text-[11px] text-slate-500">
            Dokumentasi administratif &amp; klinis medikolegal terstandarisasi.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
            UU PDP No. 27/2022
          </span>
          <p className="text-sm font-black text-slate-900">Kedaulatan Consent Digital</p>
          <p className="text-[11px] text-slate-500">
            Akses dokter wajib izin pasien; penegakan anti-BOLA/IDOR otomatis.
          </p>
        </div>
      </div>

      {/* RINGKASAN SPESIFIK ROLE: PASIEN */}
      {role === "pasien" && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
            Ringkasan Kesehatan &amp; Rekam Medis Pribadi
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/pasien/rekam-medis"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Dokumen RME Pasien
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-700">
                2 Berkas
              </p>
              <p className="text-[11px] text-slate-500">
                Riwayat pemeriksaan dokter, resep obat, &amp; resume medis.
              </p>
            </Link>

            <Link
              href="/pasien/booking"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Janji Temu Aktif
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-blue-700">
                1 Kunjungan
              </p>
              <p className="text-[11px] text-slate-500">
                Poli Penyakit Dalam di RSUP Dr. Sardjito.
              </p>
            </Link>

            <Link
              href="/pasien/consent"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Izin Akses (Consent)
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-purple-700">
                Aktif (DPJP)
              </p>
              <p className="text-[11px] text-slate-500">
                Kendali penuh pemberian atau pencabutan hak akses RME.
              </p>
            </Link>

            <Link
              href="/pasien/profil"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Status Identitas e-KYC
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-amber-700">
                Terverifikasi
              </p>
              <p className="text-[11px] text-slate-500">
                NIK: 317101******0001 sah terdaftar Dukcapil.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* RINGKASAN SPESIFIK ROLE: DOKTER DPJP */}
      {role === "nakes" && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
            Stasiun Kerja &amp; Pelayanan Dokter DPJP
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/nakes"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Antrean Poliklinik
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-700">
                {allAppointments.length} Pasien
              </p>
              <p className="text-[11px] text-slate-500">
                Pasien yang siap diperiksa di meja konsultasi hari ini.
              </p>
            </Link>

            <Link
              href="/nakes/jadwal"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Jadwal Mingguan
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-blue-700">
                Senin – Minggu
              </p>
              <p className="text-[11px] text-slate-500">
                Alokasi waktu praktik visual lintas rumah sakit faskes.
              </p>
            </Link>

            <Link
              href="/nakes/pasien-lookup"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Daftar Pasien &amp; RME
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-amber-700">
                {allPatients.length} Pasien Terdaftar
              </p>
              <p className="text-[11px] text-slate-500">
                Daftar pasien, status tanda tangan SOAP, &amp; skala prioritas triase.
              </p>
            </Link>

            <Link
              href="/nakes/rujukan"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Rujukan Faskes
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-purple-700">
                Digital SatuSehat
              </p>
              <p className="text-[11px] text-slate-500">
                Penerbitan surat rujukan antar faskes terverifikasi Kemenkes.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* RINGKASAN SPESIFIK ROLE: STAF NAKES (ADMISI & TRIASE) */}
      {role === "staf" && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
            Loket Admisi, Triase &amp; Koordinasi Pelayanan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/staf"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Check-in Admisi
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-700">
                {allAppointments.length} Antrean
              </p>
              <p className="text-[11px] text-slate-500">
                Verifikasi kepesertaan BPJS &amp; check-in kedatangan pasien.
              </p>
            </Link>

            <Link
              href="/staf/triase"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Pemeriksaan Triase
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-amber-700">
                TTV &amp; Kegawatan
              </p>
              <p className="text-[11px] text-slate-500">
                Input tanda vital awal, tindakan perawat, &amp; skala prioritas.
              </p>
            </Link>

            <Link
              href="/staf/assign-dpjp"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Pengarahan DPJP
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-blue-700">
                Ruang Konsultasi
              </p>
              <p className="text-[11px] text-slate-500">
                Mengarahkan pasien ke dokter penanggung jawab pelayanan.
              </p>
            </Link>

            <Link
              href="/staf/rujukan"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Administrasi Rujukan
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-purple-700">
                Rujukan Keluar/Masuk
              </p>
              <p className="text-[11px] text-slate-500">
                Pemberkasan klaim BPJS &amp; transfer antar fasilitas kesehatan.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* RINGKASAN SPESIFIK ROLE: ADMIN REGULATOR */}
      {role === "admin" && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
            Pengawasan Regulasi &amp; Keamanan Sistem Kemenkes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/admin/verifikasi-kyc"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Verifikasi e-KYC
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-700">
                Identitas Pasien
              </p>
              <p className="text-[11px] text-slate-500">
                Pengecekan NIK KTP &amp; watermarking digital pencegah kebocoran.
              </p>
            </Link>

            <Link
              href="/admin/verifikasi-kyd"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Verifikasi e-KYD
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-blue-700">
                STR &amp; SIP Dokter
              </p>
              <p className="text-[11px] text-slate-500">
                Validasi legalitas izin praktik dokter dengan Konsil Kedokteran.
              </p>
            </Link>

            <Link
              href="/admin/siem-monitor"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-red-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-red-700">
                SIEM Monitor
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-red-700">
                0 Insiden Kritis
              </p>
              <p className="text-[11px] text-slate-500">
                Pertahanan BOLA/IDOR &amp; audit trail aktivasi Break-Glass IGD.
              </p>
            </Link>

            <Link
              href="/admin/faskes"
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition group space-y-2 block"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                Master Data Faskes
              </span>
              <p className="text-2xl font-black text-slate-900 group-hover:text-purple-700">
                4 Faskes Terhubung
              </p>
              <p className="text-[11px] text-slate-500">
                Rumah sakit, puskesmas, &amp; klinik terdaftar di SATUSEHAT.
              </p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
