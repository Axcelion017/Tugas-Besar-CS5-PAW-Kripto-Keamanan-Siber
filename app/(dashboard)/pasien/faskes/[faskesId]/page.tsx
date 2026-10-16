"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MOCK_FASKES,
  MOCK_DOCTORS,
  getStorageData,
  Faskes,
  AuthorizedDoctor,
} from "@/lib/db/mockData";

export default function FaskesDetailPage({
  params,
}: {
  params: Promise<{ faskesId: string }>;
}) {
  const router = useRouter();
  const { faskesId } = use(params);

  const faskesList = getStorageData<Faskes[]>("resilio_faskes_list", MOCK_FASKES);
  const faskes = faskesList.find((f) => f.id === faskesId) || faskesList[0];

  const doctors = MOCK_DOCTORS.filter((d) => d.faskesId === faskes.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
        <Link href="/pasien" className="hover:underline">
          Portal Pasien
        </Link>
        <span>/</span>
        <Link href="/pasien/faskes" className="hover:underline">
          Pencarian Faskes
        </Link>
        <span>/</span>
        <span>{faskes.nama}</span>
      </div>

      {/* Hero Profil Faskes */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600">
                {faskes.tipe} • ID: {faskes.kodeFaskes}
              </span>
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Operasional Normal
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
              {faskes.nama}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Alamat: {faskes.alamat}, {faskes.kota} • Telp: {faskes.kontak}
            </p>
          </div>

          <Link
            href={`/pasien/booking?faskesId=${faskes.id}`}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition text-center"
          >
            Booking Antrean Faskes Ini →
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-bold text-slate-700 mb-1">Poliklinik & Layanan Spesialis:</p>
            <div className="flex flex-wrap gap-1.5">
              {faskes.spesialisasiList.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-slate-700 mb-1">Kategori Diagnostik Unggulan:</p>
            <div className="flex flex-wrap gap-1.5">
              {faskes.kategoriPenyakit.map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                >
                  #{p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Dokter Praktik (UR-P03) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Daftar Dokter Praktik & Kuota Harian (UR-P03)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Terverifikasi Kemenkes (STR & SIP Aktif)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {doctors.length === 0 ? (
            <div className="col-span-2 p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500 text-xs">
              Belum ada dokter yang didaftarkan pada faskes ini.
            </div>
          ) : (
            doctors.map((doc) => {
              const sisaKuota = doc.kuotaHarian - doc.kuotaTerisi;
              const isPenuh = sisaKuota <= 0;

              return (
                <div
                  key={doc.id}
                  className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-700">
                          {doc.specialty}
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-0.5">
                          {doc.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          STR: {doc.strNumber} • SIP: {doc.sipNumber}
                        </p>
                      </div>

                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          isPenuh
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {isPenuh ? "Kuota Penuh" : `Tersedia ${sisaKuota} Kuota`}
                      </span>
                    </div>

                    {/* Jadwal Praktik */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        Jadwal Praktik Mingguan:
                      </p>
                      {doc.jadwal.map((j, idx) => (
                        <p key={idx} className="text-xs text-slate-700 font-semibold">
                          {j.hari}: <span className="text-blue-700">{j.jam}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Terisi: {doc.kuotaTerisi} / {doc.kuotaHarian} antrean
                    </span>

                    <button
                      type="button"
                      disabled={isPenuh}
                      onClick={() =>
                        router.push(
                          `/pasien/booking?faskesId=${faskes.id}&dokterId=${doc.id}`
                        )
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer disabled:bg-slate-300"
                    >
                      Pilih & Booking Dokter →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
