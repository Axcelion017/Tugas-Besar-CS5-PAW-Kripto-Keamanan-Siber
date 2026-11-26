"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Faskes } from "@/lib/db/mockData";
import {
  getFaskesListServerAction,
  toggleFaskesKillSwitchServerAction,
} from "@/lib/actions/faskes";
import { createFaskesServerAction } from "@/lib/actions/admin";
import { ConfirmModal } from "@/components/ui/Modal";
import { ToastBanner } from "@/components/ui/ToastBanner";

function formatFaskesType(tipe: string): Faskes["tipe"] {
  if (tipe === "KLINIK_PRATAMA" || tipe === "Klinik Pratama") return "Klinik Pratama";
  if (tipe === "PUSKESMAS" || tipe === "Puskesmas") return "Puskesmas";
  return "Rumah Sakit";
}

export default function MasterFaskesAdminPage() {
  const [faskesList, setFaskesList] = useState<Faskes[]>([]);
  const [namaBaru, setNamaBaru] = useState("");
  const [tipeBaru, setTipeBaru] = useState<"Rumah Sakit" | "Klinik Pratama" | "Puskesmas">("Rumah Sakit");
  const [kotaBaru, setKotaBaru] = useState("Yogyakarta");
  const [alamatBaru, setAlamatBaru] = useState("");
  const [kontakBaru, setKontakBaru] = useState("");
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingToggleFaskes, setPendingToggleFaskes] = useState<Faskes | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const loadFaskesFromDb = useCallback(async () => {
    try {
      const res = await getFaskesListServerAction();
      if (res.success && Array.isArray(res.data)) {
        const mapped: Faskes[] = (
          res.data as unknown as Array<{
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
          }>
        ).map((f) => ({
          ...f,
          tipe: formatFaskesType(f.tipe),
        }));
        setFaskesList(mapped);
      }
    } catch (err) {
      console.warn("Load DB Faskes error:", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFaskesFromDb();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFaskesFromDb]);

  const handleToggleQuarantine = (faskes: Faskes) => {
    setErrorMsg(null);
    setPendingToggleFaskes(faskes);
  };

  const confirmToggleQuarantine = async () => {
    if (!pendingToggleFaskes || isToggling) return;
    const faskes = pendingToggleFaskes;
    const isQuarantining = faskes.status === "ACTIVE";
    setIsToggling(true);
    try {
      const res = await toggleFaskesKillSwitchServerAction(
        faskes.id,
        isQuarantining ? "QUARANTINED" : "ACTIVE"
      );
      if (!res.success) {
        setErrorMsg(res.message || "Gagal mengubah status Kill-Switch faskes.");
        return;
      }

      setNotif(
        `Status Faskes ${faskes.nama} berhasil diubah menjadi ${
          isQuarantining ? "QUARANTINED (Terisolasi)" : "ACTIVE (Normal)"
        } di PostgreSQL.`
      );
      await loadFaskesFromDb();
    } finally {
      setIsToggling(false);
      setPendingToggleFaskes(null);
    }
  };

  const handleAddFaskes = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!namaBaru.trim()) return;

    const res = await createFaskesServerAction({
      nama: namaBaru,
      tipe: tipeBaru,
      kota: kotaBaru,
      alamat: alamatBaru,
      kontak: kontakBaru,
    });

    if (!res.success) {
      setErrorMsg(res.message || "Gagal mendaftarkan faskes baru.");
      return;
    }

    setNamaBaru("");
    setAlamatBaru("");
    setKontakBaru("");
    setNotif(res.message || "Faskes berhasil didaftarkan ke PostgreSQL.");
    await loadFaskesFromDb();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
          <Link href="/admin" className="hover:underline">
            Konsol Admin
          </Link>
          <span>/</span>
          <span>Master Faskes & Ransomware Isolation (UR-A03)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Master Fasilitas Kesehatan & Ransomware Kill-Switch
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Pengendalian jaringan faskes terintegrasi. Dilengkapi saklar darurat (*Kill-Switch*) untuk mengisolasi klinik/RS yang terinfeksi malware agar tidak melumpuhkan server pusat.
        </p>
      </div>

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

      {/* Form Tambah Faskes Baru */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">
          Registrasi Fasilitas Kesehatan Resmi Baru
        </h2>

        <form onSubmit={handleAddFaskes} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Nama Fasilitas Kesehatan *
            </label>
            <input
              type="text"
              required
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              placeholder="Contoh: RS Bethesda Yogyakarta"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Tipe Fasilitas
            </label>
            <select
              value={tipeBaru}
              onChange={(e) =>
                setTipeBaru(
                  e.target.value as "Rumah Sakit" | "Klinik Pratama" | "Puskesmas"
                )
              }
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
            >
              <option value="Rumah Sakit">Rumah Sakit</option>
              <option value="Klinik Pratama">Klinik Pratama</option>
              <option value="Puskesmas">Puskesmas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Kota / Kabupaten
            </label>
            <input
              type="text"
              required
              value={kotaBaru}
              onChange={(e) => setKotaBaru(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Alamat Lengkap
            </label>
            <input
              type="text"
              value={alamatBaru}
              onChange={(e) => setAlamatBaru(e.target.value)}
              placeholder="Jl. Jend. Sudirman No. 70"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              Daftarkan Faskes
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Master Faskes & Tombol Kill Switch */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Daftar Faskes Terdaftar & Status Koneksi Kill-Switch
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {faskesList.length} Faskes Aktif di Jaringan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Kode Faskes</th>
                <th className="p-4">Nama Fasilitas Kesehatan</th>
                <th className="p-4">Tipe & Wilayah</th>
                <th className="p-4">Layanan Spesialis</th>
                <th className="p-4">Status Pertahanan</th>
                <th className="p-4 text-right">Tombol Darurat (Kill-Switch)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {faskesList.map((f) => {
                const isQuarantined = f.status === "QUARANTINED";

                return (
                  <tr
                    key={f.id}
                    className={`hover:bg-slate-50/50 transition ${
                      isQuarantined ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="p-4 font-mono font-bold text-slate-700">{f.kodeFaskes}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900 text-sm">{f.nama}</p>
                      <p className="text-[11px] text-slate-500">{f.alamat}</p>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-700">{f.tipe}</span>
                      <span className="block text-[11px] text-slate-500">{f.kota}</span>
                    </td>
                    <td className="p-4 text-slate-600 max-w-xs truncate">
                      {f.spesialisasiList.join(", ")}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                          isQuarantined
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {isQuarantined ? "TERISOLASI (QUARANTINED)" : "NORMAL (ACTIVE)"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleQuarantine(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer shadow-xs ${
                          isQuarantined
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                      >
                        {isQuarantined ? "Pulihkan Koneksi" : "Aktifkan Karantina"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingToggleFaskes)}
        onClose={() => setPendingToggleFaskes(null)}
        onConfirm={() => void confirmToggleQuarantine()}
        title={
          pendingToggleFaskes?.status === "ACTIVE"
            ? `Aktifkan Kill-Switch Karantina — ${pendingToggleFaskes.nama}?`
            : `Pulihkan Koneksi Faskes — ${pendingToggleFaskes?.nama || ""}?`
        }
        description={
          pendingToggleFaskes?.status === "ACTIVE"
            ? "Seluruh jalur booking dan penulisan RME faskes ini akan segera dibekukan di server untuk mengisolasi potensi ransomware."
            : "Koneksi layanan pendaftaran dan penulisan RME faskes ke server pusat akan diaktifkan kembali."
        }
        confirmLabel={
          pendingToggleFaskes?.status === "ACTIVE" ? "Ya, Isolasi Faskes" : "Ya, Pulihkan Faskes"
        }
        tone={pendingToggleFaskes?.status === "ACTIVE" ? "danger" : "default"}
        isBusy={isToggling}
      />

      <ToastBanner
        message={errorMsg || notif}
        type={errorMsg ? "error" : "success"}
        onDismiss={() => {
          setErrorMsg(null);
          setNotif(null);
        }}
      />
    </div>
  );
}
