"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MOCK_FASKES, Faskes, getStorageData } from "@/lib/db/mockData";

export default function FaskesSearchPage() {
  const [faskesList] = useState<Faskes[]>(() =>
    getStorageData<Faskes[]>("resilio_faskes_list", MOCK_FASKES)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("SEMUA");

  const filtered = faskesList.filter((f) => {
    const matchesType =
      selectedType === "SEMUA" || f.tipe === selectedType;

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      f.nama.toLowerCase().includes(term) ||
      f.kota.toLowerCase().includes(term) ||
      f.kategoriPenyakit.some((k) => k.toLowerCase().includes(term)) ||
      f.spesialisasiList.some((s) => s.toLowerCase().includes(term));

    return matchesType && matchesSearch;
  });

  const symptomShortcuts = ["Hipertensi", "Jantung", "Diabetes", "Gigi & Mulut", "ISPA", "Anak"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <span>Pencarian Faskes Pintar (UR-P02)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pencarian Fasilitas Kesehatan Berdasarkan Penyakit & Spesialisasi
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Temukan Rumah Sakit, Klinik Pratama, atau Puskesmas yang memiliki dokter spesialis sesuai keluhan Anda.
        </p>
      </div>

      {/* Kontrol Pencarian & Filter */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan penyakit (cth: Jantung, Hipertensi), poli spesialis, atau nama faskes..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {["SEMUA", "Rumah Sakit", "Klinik Pratama", "Puskesmas"].map((tipe) => (
              <button
                key={tipe}
                onClick={() => setSelectedType(tipe)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedType === tipe
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {tipe}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcut Gejala / Penyakit */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase">
            Pintasan Gejala / Penyakit:
          </span>
          {symptomShortcuts.map((s) => (
            <button
              key={s}
              onClick={() => setSearchTerm(s)}
              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition cursor-pointer"
            >
              {s}
            </button>
          ))}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-red-600 font-bold hover:underline ml-2 cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Grid Hasil Faskes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-2 bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <h3 className="text-base font-bold text-slate-800">Tidak ada fasilitas kesehatan yang cocok</h3>
            <p className="text-xs text-slate-500">
              Coba ganti kata kunci pencarian gejala penyakit atau reset filter tipe faskes.
            </p>
          </div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.id}
              className={`p-6 rounded-3xl bg-white border transition shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 ${
                f.status === "QUARANTINED" ? "border-red-300 bg-red-50/30" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                      {f.tipe} • Kode: {f.kodeFaskes}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">{f.nama}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {f.alamat}, {f.kota}
                    </p>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                      f.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-red-100 text-red-800 border-red-300"
                    }`}
                  >
                    {f.status === "ACTIVE" ? "Terhubung Server" : "Karantina / Terisolasi"}
                  </span>
                </div>

                {/* Spesialisasi Tersedia */}
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-bold text-slate-600">Layanan & Spesialisasi Poli:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.spesialisasiList.map((sp) => (
                      <span
                        key={sp}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                      >
                        {sp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Kategori Penyakit */}
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-bold text-slate-600">Fokus Penanganan Penyakit:</p>
                  <div className="flex flex-wrap gap-1">
                    {f.kategoriPenyakit.map((kp) => (
                      <span
                        key={kp}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        #{kp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Telp: {f.kontak}</span>

                {f.status === "ACTIVE" ? (
                  <Link
                    href={`/pasien/faskes/${f.id}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition"
                  >
                    Lihat Dokter & Booking →
                  </Link>
                ) : (
                  <span className="text-xs font-bold text-red-600">
                    Akses Ditangguhkan (Kill-Switch)
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
