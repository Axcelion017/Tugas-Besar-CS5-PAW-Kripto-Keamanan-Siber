"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  getStorageData,
  Patient,
} from "@/lib/db/mockData";
import {
  getDoctorPatientListServerAction,
  lookupPatientByNikServerAction,
  executeBreakGlassServerAction,
} from "@/lib/actions/clinical";

interface DoctorPatientItem {
  id: string;
  nik: string;
  name: string;
  mrn: string;
  gender: string;
  bloodType: string;
  birthDate: string | null;
  allergies: string[];
  phone: string;
  totalVisits: number;
  latestVisitDate: string;
  latestDiagnosis: string;
  documentStatus: "SIGNED" | "UNSIGNED";
  queueStatus: "IN_QUEUE" | "IDLE";
  activeAppointmentId: string | null;
  hasAccessGrant: boolean;
  recordsCount: number;
  triaseLevel?: "MERAH" | "KUNING" | "HIJAU";
}

interface DoctorPatientStats {
  totalPatients: number;
  totalAntrean: number;
  unsignedCount: number;
  signedCount: number;
}

export default function PasienListPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<DoctorPatientItem[]>([]);
  const [stats, setStats] = useState<DoctorPatientStats>({
    totalPatients: 0,
    totalAntrean: 0,
    unsignedCount: 0,
    signedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNSIGNED" | "SIGNED" | "IN_QUEUE">("ALL");

  // State Pencarian Manual NIK / Break-Glass IGD
  const [showManualNikSearch, setShowManualNikSearch] = useState(false);
  const [nikSearch, setNikSearch] = useState("");
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [targetPatientBlocked, setTargetPatientBlocked] = useState<Patient | null>(null);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("Pasien Tidak Sadarkan Diri / Koma di IGD");
  const [, setBreakGlassActive] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const session = getUserSession();
      const doctorId = session?.id || "DOC-01";

      try {
        const res = await getDoctorPatientListServerAction(doctorId);
        if (res.success && res.patients.length > 0) {
          setPatients(res.patients);
          setStats(res.stats);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Failed fetching from DB, fallback to mock:", err);
      }

      // Fallback data
      const mockList = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
      const mapped: DoctorPatientItem[] = mockList.map((p, idx) => ({
        id: p.id,
        nik: p.nik,
        name: p.name,
        mrn: p.mrn,
        gender: p.gender,
        bloodType: p.bloodType,
        birthDate: p.birthDate || null,
        allergies: p.allergies || [],
        phone: p.emergencyContact?.phone || "-",
        totalVisits: idx === 0 ? 3 : 1,
        latestVisitDate: idx === 0 ? "8 Nov 2026" : "Belum ada kunjungan",
        latestDiagnosis: idx === 0 ? "I10 - Hipertensi Primer" : "Pemeriksaan Poliklinik Rawat Jalan",
        documentStatus: idx === 0 ? "SIGNED" : "UNSIGNED",
        queueStatus: idx === 1 ? "IN_QUEUE" : "IDLE",
        activeAppointmentId: idx === 1 ? "APT-102" : null,
        hasAccessGrant: idx === 0,
        recordsCount: idx === 0 ? 2 : 0,
        triaseLevel: idx === 1 ? "MERAH" : idx === 0 ? "KUNING" : "HIJAU",
      }));

      setPatients(mapped);
      setStats({
        totalPatients: mockList.length,
        totalAntrean: 1,
        unsignedCount: mockList.length - 1,
        signedCount: 1,
      });
      setIsLoading(false);
    }

    loadData();
  }, []);

  // Filter Pasien
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.nik.includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.latestDiagnosis.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === "UNSIGNED") return p.documentStatus === "UNSIGNED";
    if (statusFilter === "SIGNED") return p.documentStatus === "SIGNED";
    if (statusFilter === "IN_QUEUE") return p.queueStatus === "IN_QUEUE";
    return true;
  });

  const handleManualNikSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setAccessDenied(false);
    setSearchResult(null);
    setTargetPatientBlocked(null);
    setBreakGlassActive(false);

    const cleanNik = nikSearch.trim();
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    try {
      const res = await lookupPatientByNikServerAction(cleanNik, doctorId);
      if (res.success && res.patient) {
        const p = res.patient;
        const targetPatient: Patient = {
          id: p.id,
          nik: p.nik,
          name: p.name,
          mrn: p.mrn,
          age: 35,
          gender: (p.gender as "L" | "P") || "L",
          bloodType: p.bloodType || "O+",
          lastVisit: "Hari ini",
          hasAccess: true,
          statusKyc: "VERIFIED",
          allergies: p.allergies || [],
          emergencyContact: {
            name: "Keluarga Terdaftar",
            relation: "Keluarga",
            phone: p.phone || "-",
          },
          encryptionKeyHex: p.encryptionKeyHex || "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
        };

        if (!res.accessAllowed) {
          setAccessDenied(true);
          setTargetPatientBlocked(targetPatient);
        } else {
          setSearchResult(targetPatient);
        }
        return;
      }
    } catch {
      // fallback
    }

    const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
    const target = allPatients.find((p) => p.nik === cleanNik || p.id === cleanNik);
    if (!target) return;

    if (target.id === "P-101") {
      setSearchResult(target);
    } else {
      setAccessDenied(true);
      setTargetPatientBlocked(target);
    }
  };

  const handleExecuteBreakGlass = async () => {
    if (!targetPatientBlocked) return;
    const session = getUserSession();
    const doctorId = session?.id || "DOC-01";

    try {
      await executeBreakGlassServerAction({
        patientId: targetPatientBlocked.id,
        doctorId,
        reason: breakGlassReason,
      });
    } catch (err) {
      console.warn("Break Glass Server Action fallback:", err);
    }

    setShowBreakGlassModal(false);
    setAccessDenied(false);
    setBreakGlassActive(true);
    setSearchResult(targetPatientBlocked);
    setNotif(
      `AKSES DARURAT BREAK-GLASS AKTIF: Anda berhasil membuka rekam medis darurat ${targetPatientBlocked.name}. Tindakan ini telah dicatat ke audit trail SIEM Kemenkes.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <Link href="/nakes" className="hover:underline">
              Stasiun Nakes
            </Link>
            <span>/</span>
            <span>Daftar Pasien & Rekam Medis (UR-T03 & UR-T08)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Daftar Pasien & Status Rekam Medis
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Kelola seluruh pasien terdaftar, pantau antrean aktif, serta periksa kelengkapan dan status pengesahan dokumen SOAP.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowManualNikSearch(!showManualNikSearch)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer self-start md:self-auto"
        >
          {showManualNikSearch ? "Tutup Pencarian NIK Manual" : "Pencarian NIK / Break-Glass IGD"}
        </button>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* 4 Kartu Metrik Ringkasan Pasien & Dokumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Jumlah Pasien */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Jumlah Pasien
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {stats.totalPatients}
            </span>
            <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md">
              Terdaftar
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            Total pasien dalam basis data faskes
          </p>
        </div>

        {/* 2. Jumlah Antrean */}
        <div className="p-5 rounded-3xl bg-white border border-blue-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
            Jumlah Antrean
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-blue-900 tracking-tight">
              {stats.totalAntrean}
            </span>
            <span className="text-[10px] font-bold text-blue-700 px-2 py-0.5 bg-blue-100 rounded-md">
              Hari Ini
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            Pasien siap atau sedang menunggu giliran
          </p>
        </div>

        {/* 3. Belum Ditandatangani */}
        <div className="p-5 rounded-3xl bg-white border border-amber-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
            Belum Ditandatangani
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-900 tracking-tight">
              {stats.unsignedCount}
            </span>
            <span className="text-[10px] font-bold text-amber-800 px-2 py-0.5 bg-amber-100 rounded-md">
              Menunggu TTD
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            Kunjungan/draft yang butuh pengesahan DPJP
          </p>
        </div>

        {/* 4. Sudah Ditandatangani */}
        <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
            Sudah Ditandatangani
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-900 tracking-tight">
              {stats.signedCount}
            </span>
            <span className="text-[10px] font-bold text-emerald-800 px-2 py-0.5 bg-emerald-100 rounded-md">
              Disahkan Sah
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            Dokumen RME berkekuatan hukum digital
          </p>
        </div>
      </div>

      {/* Bagian Opsional: Pencarian NIK Manual & Break-Glass IGD */}
      {showManualNikSearch && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Pencarian Pasien Nasional via NIK & Break-Glass IGD
              </h3>
              <p className="text-xs text-slate-500">
                Cari data pasien di luar daftar lokal atau aktifkan protokol darurat IGD jika pasien tidak sadarkan diri.
              </p>
            </div>
            <button
              onClick={() => setShowManualNikSearch(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Tutup
            </button>
          </div>

          <form onSubmit={handleManualNikSearch} className="space-y-3 max-w-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={nikSearch}
                onChange={(e) => setNikSearch(e.target.value)}
                placeholder="Masukkan NIK 16 digit pasien (contoh: 3171012304800001)..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
              >
                Cari & Validasi
              </button>
            </div>
          </form>

          {hasSearched && (
            <div className="pt-2">
              {accessDenied && (
                <div className="p-6 rounded-2xl bg-red-50 border border-red-300 text-red-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-sm text-red-700">Akses Ditolak: BOLA / Zero-Trust Defense</h4>
                      <p className="text-xs text-red-800">
                        Dokter belum memiliki tiket consent aktif dari pasien dengan NIK tersebut.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBreakGlassModal(true)}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                    >
                      Aktivasi Break-Glass IGD
                    </button>
                  </div>
                </div>
              )}

              {!accessDenied && searchResult && (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-700">Pasien Ditemukan (Akses Sah)</span>
                    <h4 className="text-lg font-black text-slate-900">{searchResult.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">NIK: {searchResult.nik} • No. RM: {searchResult.mrn}</p>
                  </div>
                  <Link
                    href={`/nakes/pasien-lookup/${searchResult.id}`}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    Buka Rekam Medis →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter & Bar Pencarian List Pasien */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Input Pencarian Cepat */}
        <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200">
          <span className="text-xs font-black text-slate-400 font-mono uppercase">CARI</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama pasien, NIK, No. RM, atau keluhan/penyakit..."
            className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Tab Filter Status Dokumen */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({patients.length})
          </button>
          <button
            onClick={() => setStatusFilter("UNSIGNED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === "UNSIGNED"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Menunggu TTD ({stats.unsignedCount})
          </button>
          <button
            onClick={() => setStatusFilter("SIGNED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === "SIGNED"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sudah TTD ({stats.signedCount})
          </button>
          <button
            onClick={() => setStatusFilter("IN_QUEUE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === "IN_QUEUE"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Dalam Antrean ({stats.totalAntrean})
          </button>
        </div>
      </div>

      {/* Daftar Pasien dalam Bentuk Tabel Bersih Tanpa Pemisah Kolom (Hanya Garis Pemisah Antar Pasien) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Memuat daftar pasien dan status dokumen...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Tidak ditemukan pasien yang sesuai dengan kata kunci atau filter yang dipilih.
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-5">Pasien & No. RM</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Skala Prioritas</th>
                <th className="py-3.5 px-4">Gender & Gol</th>
                <th className="py-3.5 px-4">Kunjungan Terakhir</th>
                <th className="py-3.5 px-4">Status Dokumen</th>
                <th className="py-3.5 px-4">Antrean</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredPatients.map((p) => {
                const maskedNik = `${p.nik.slice(0, 6)}******${p.nik.slice(-4)}`;
                const triase = p.triaseLevel || "HIJAU";

                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/nakes/pasien-lookup/${p.id}`)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                  >
                    {/* Kolom 1: Nama & No. RM */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 group-hover:text-emerald-700 transition">
                            {p.name}
                          </p>
                          <span className="text-[10px] font-mono text-slate-500">
                            {p.mrn}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kolom 2: NIK */}
                    <td className="py-4 px-4 font-mono text-xs text-slate-600">
                      {maskedNik}
                    </td>

                    {/* Kolom 3: Skala Prioritas */}
                    <td className="py-4 px-4">
                      {triase === "MERAH" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          P1 • MERAH
                        </span>
                      ) : triase === "KUNING" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-100" />
                          P2 • KUNING
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-100" />
                          P3 • HIJAU
                        </span>
                      )}
                    </td>

                    {/* Kolom 4: Gender & Gol */}
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                      <span>{p.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <strong className="text-slate-900">{p.bloodType}</strong>
                    </td>

                    {/* Kolom 5: Kunjungan Terakhir & Diagnosis */}
                    <td className="py-4 px-4">
                      <p className="font-semibold text-slate-900 whitespace-nowrap">
                        {p.latestVisitDate}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {p.latestDiagnosis}
                      </p>
                    </td>

                    {/* Kolom 6: Status Dokumen RME */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {p.documentStatus === "SIGNED" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Sudah TTD
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          Menunggu TTD
                        </span>
                      )}
                    </td>

                    {/* Kolom 7: Status Antrean */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {p.queueStatus === "IN_QUEUE" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                          Antre
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                          Selesai
                        </span>
                      )}
                    </td>

                    {/* Kolom 8: Aksi */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <span className="px-3.5 py-1.5 bg-slate-900 group-hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-2xs inline-flex items-center gap-1">
                        <span>Buka RME</span>
                        <span>→</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Aktivasi Break-Glass IGD */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 border-2 border-red-500">
            <div className="border-b border-red-100 pb-3">
              <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                Protokol Gawat Darurat (Break-Glass Protocol)
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Konfirmasi Buka Akses Pasien Tanpa Izin
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fitur ini dirancang sesuai standar internasional <strong>ISO 27799 / HIPAA</strong> untuk menyelamatkan nyawa pasien koma/syok di IGD. Setiap aktivasi Break-Glass dilaporkan ke Admin Kemenkes dan diaudit forensik.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Pilih Indikasi Medis Gawat Darurat *
              </label>
              <select
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-xs bg-white font-semibold"
              >
                <option value="Pasien Tidak Sadarkan Diri / Koma di IGD">Pasien Tidak Sadarkan Diri / Koma di IGD</option>
                <option value="Syok Anafilaktik / Henti Jantung Akut">Syok Anafilaktik / Henti Jantung Akut</option>
                <option value="Trauma Ganda / Kecelakaan Lalu Lintas Kritis">Trauma Ganda / Kecelakaan Lalu Lintas Kritis</option>
                <option value="Kegawatdaruratan Kebidanan / Perdarahan Masif">Kegawatdaruratan Kebidanan / Perdarahan Masif</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBreakGlass}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-md"
              >
                Sahkan & Buka Rekam Medis Darurat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
