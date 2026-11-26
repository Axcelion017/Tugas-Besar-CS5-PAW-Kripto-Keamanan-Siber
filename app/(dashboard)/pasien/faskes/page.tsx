"use client";

import { Breadcrumb } from "@/components/ui/Breadcrumb";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheck,
  IconSearch,
  IconStethoscope,
} from "@/components/ui/Icons";

interface DbDoctorSummary {
  id: string;
  name: string;
  specialty: string;
  kuotaHarian: number;
}

interface DbFaskesItem {
  id: string;
  kodeFaskes: string;
  nama: string;
  tipe: string;
  alamat: string;
  kota: string;
  kontak: string;
  spesialisasiList: string[];
  kategoriPenyakit: string[];
  status: "ACTIVE" | "QUARANTINED";
  doctors?: DbDoctorSummary[];
}

function formatFaskesType(tipe: string): string {
  if (tipe === "RUMAH_SAKIT") return "Rumah Sakit";
  if (tipe === "KLINIK_PRATAMA") return "Klinik Pratama";
  if (tipe === "PUSKESMAS") return "Puskesmas";
  return tipe;
}

const SYMPTOM_SHORTCUTS = ["Hipertensi", "Jantung", "Diabetes", "Gigi & Mulut", "ISPA", "Anak"];

export default function FaskesSearchPage() {
  const [faskesList, setFaskesList] = useState<DbFaskesItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("SEMUA");
  const [selectedCity, setSelectedCity] = useState("SEMUA");
  const [onlyActive, setOnlyActive] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFaskes() {
      try {
        const res = await getFaskesListServerAction();
        if (active && res.success && Array.isArray(res.data)) {
          const mapped: DbFaskesItem[] = (res.data as unknown as DbFaskesItem[]).map((f) => ({
            ...f,
            tipe: formatFaskesType(f.tipe),
          }));
          setFaskesList(mapped);
        }
      } catch (err) {
        console.warn("Gagal memuat daftar faskes dari PostgreSQL:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadFaskes();
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(faskesList.map((f) => f.kota).filter(Boolean))).sort(),
    [faskesList]
  );

  const stats = useMemo(() => {
    const activeFaskes = faskesList.filter((f) => f.status === "ACTIVE").length;
    const quarantinedFaskes = faskesList.length - activeFaskes;
    const totalDoctors = faskesList.reduce((sum, f) => sum + (f.doctors?.length || 0), 0);
    return { activeFaskes, quarantinedFaskes, totalDoctors };
  }, [faskesList]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return faskesList.filter((f) => {
      if (selectedType !== "SEMUA" && f.tipe !== selectedType) return false;
      if (selectedCity !== "SEMUA" && f.kota !== selectedCity) return false;
      if (onlyActive && f.status !== "ACTIVE") return false;
      if (!term) return true;
      return (
        f.nama.toLowerCase().includes(term) ||
        f.kota.toLowerCase().includes(term) ||
        f.alamat.toLowerCase().includes(term) ||
        f.kategoriPenyakit.some((k) => k.toLowerCase().includes(term)) ||
        f.spesialisasiList.some((s) => s.toLowerCase().includes(term)) ||
        (f.doctors || []).some(
          (d) =>
            d.name.toLowerCase().includes(term) || d.specialty.toLowerCase().includes(term)
        )
      );
    });
  }, [faskesList, selectedType, selectedCity, onlyActive, searchTerm]);

  const hasActiveFilters =
    Boolean(searchTerm) || selectedType !== "SEMUA" || selectedCity !== "SEMUA" || onlyActive;

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedType("SEMUA");
    setSelectedCity("SEMUA");
    setOnlyActive(false);
  };

  if (isLoading) {
    return <DashboardSkeleton noticeText="Memuat direktori fasilitas kesehatan dari basis data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: "Portal Pasien", href: "/pasien" },
              { label: "Pencarian Faskes" },
            ]}
          />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Direktori &amp; Pencarian Fasilitas Kesehatan
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5 max-w-2xl">
            Temukan rumah sakit, klinik, atau puskesmas berdasarkan gejala, spesialisasi poli, nama dokter, dan status operasional jaringan.
          </p>
        </div>

        <Link
          href="/pasien/booking"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition self-start"
        >
          <span>Booking Langsung →</span>
        </Link>
      </div>

      {/* Ringkasan Jaringan Faskes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Faskes Siap Layanan
            </p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.activeFaskes}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Terhubung &amp; menerima booking</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <IconBuilding size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Dokter Terdaftar
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalDoctors}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dokter DPJP berlisensi STR/SIP</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
            <IconStethoscope size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Status Karantina
            </p>
            <p className="text-2xl font-black text-red-700 mt-1">{stats.quarantinedFaskes}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Diisolasi sementara (Kill-Switch)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
            <IconAlertTriangle size={18} />
          </div>
        </div>
      </div>

      {/* Kontrol Pencarian & Filter */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 relative">
            <IconSearch
              size={16}
              className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari gejala (Hipertensi, Jantung), poli, dokter, atau nama faskes..."
              aria-label="Cari fasilitas kesehatan"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="filter-city" className="sr-only">
              Filter Kota
            </label>
            <select
              id="filter-city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="SEMUA">Semua Kota</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center justify-end">
            <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer w-full justify-center">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Hanya Faskes Aktif</span>
            </label>
          </div>
        </div>

        {/* Filter Tipe + Pintasan Gejala */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {["SEMUA", "Rumah Sakit", "Klinik Pratama", "Puskesmas"].map((tipe) => (
              <button
                key={tipe}
                type="button"
                onClick={() => setSelectedType(tipe)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedType === tipe
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {tipe === "SEMUA" ? "Semua Tipe" : tipe}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Gejala:</span>
            {SYMPTOM_SHORTCUTS.map((s) => {
              const isSelected = searchTerm.toLowerCase() === s.toLowerCase();
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSearchTerm(isSelected ? "" : s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isSelected
                      ? "bg-red-50 text-red-800 border-red-300"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-red-600 font-bold hover:underline ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info hasil */}
      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
        <span>
          Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari{" "}
          {faskesList.length} fasilitas kesehatan
        </span>
      </div>

      {/* Grid Hasil Faskes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <h3 className="text-base font-bold text-slate-800">
              Tidak ada fasilitas kesehatan yang cocok
            </h3>
            <p className="text-xs text-slate-500">
              Coba ganti kata kunci pencarian gejala, kota, atau reset filter yang aktif.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Tampilkan Semua Faskes
              </button>
            )}
          </div>
        ) : (
          filtered.map((f) => {
            const doctorCount = f.doctors?.length || 0;
            const isActive = f.status === "ACTIVE";

            return (
              <article
                key={f.id}
                className={`p-6 rounded-3xl bg-white border transition shadow-sm hover:shadow-md flex flex-col justify-between gap-5 ${
                  !isActive ? "border-red-300 bg-red-50/20" : "border-slate-200"
                }`}
              >
                <div className="space-y-4">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {f.tipe}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">{f.kodeFaskes}</span>
                      </div>
                      <h2 className="text-lg font-black text-slate-900 mt-1.5 leading-snug">
                        {f.nama}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {f.alamat}, <strong className="text-slate-800">{f.kota}</strong>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-100 text-red-800 border-red-300"
                      }`}
                    >
                      {isActive ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}
                      <span>{isActive ? "Aktif" : "Karantina"}</span>
                    </span>
                  </div>

                  {/* Ringkasan Dokter */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconStethoscope size={16} className="text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">
                          {doctorCount} Dokter Praktik Tersedia
                        </p>
                        {f.doctors && f.doctors.length > 0 && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {f.doctors.map((d) => d.name).join(" • ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">
                      {f.kontak}
                    </span>
                  </div>

                  {/* Spesialisasi & Penyakit */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {f.spesialisasiList.map((sp) => (
                        <span
                          key={sp}
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {f.kategoriPenyakit.map((kp) => (
                        <span
                          key={kp}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200/80"
                        >
                          #{kp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isActive ? "Kuota & jadwal real-time" : "Akses diblokir sementara"}
                  </span>

                  {isActive ? (
                    <Link
                      href={`/pasien/faskes/${f.id}`}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      Lihat Dokter &amp; Booking →
                    </Link>
                  ) : (
                    <span className="text-xs font-bold text-red-700">
                      Booking Diblokir (Kill-Switch)
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
