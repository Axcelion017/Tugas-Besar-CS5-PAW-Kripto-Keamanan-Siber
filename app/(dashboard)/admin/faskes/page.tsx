"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_FASKES,
  MOCK_SECURITY_LOGS,
  getStorageData,
  setStorageData,
  Faskes,
  SecurityAuditLog,
} from "@/lib/db/mockData";

function generateFaskesLogId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function MasterFaskesAdminPage() {
  const [faskesList, setFaskesList] = useState<Faskes[]>([]);
  const [namaBaru, setNamaBaru] = useState("");
  const [tipeBaru, setTipeBaru] = useState<"Rumah Sakit" | "Klinik Pratama" | "Puskesmas">("Rumah Sakit");
  const [kotaBaru, setKotaBaru] = useState("Yogyakarta");
  const [alamatBaru, setAlamatBaru] = useState("");
  const [kontakBaru, setKontakBaru] = useState("");
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const list = getStorageData<Faskes[]>("resilio_faskes_list", MOCK_FASKES);
      setFaskesList(list);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleQuarantine = (faskes: Faskes) => {
    const isQuarantining = faskes.status === "ACTIVE";
    const actionText = isQuarantining ? "MENGISOLASI" : "MEMULIHKAN";

    if (
      !confirm(
        `PERINGATAN SIBER: Apakah Anda yakin ingin ${actionText} Faskes ${faskes.nama}? ${
          isQuarantining
            ? "Seluruh jalur API sinkronisasi faskes ini akan dibekukan untuk mengisolasi potensi infeksi ransomware!"
            : "Koneksi ke server pusat akan diizinkan kembali."
        }`
      )
    ) {
      return;
    }

    const updated = faskesList.map((f) =>
      f.id === faskes.id
        ? { ...f, status: (isQuarantining ? "QUARANTINED" : "ACTIVE") as "ACTIVE" | "QUARANTINED" }
        : f
    );
    setStorageData("resilio_faskes_list", updated);
    setFaskesList(updated);

    // Catat ke SIEM Log
    const logs = getStorageData<SecurityAuditLog[]>("resilio_security_logs", MOCK_SECURITY_LOGS);
    const newLog: SecurityAuditLog = {
      id: generateFaskesLogId("LOG"),
      timestamp: new Date().toLocaleString("id-ID"),
      actorId: "ADM-01",
      actorName: "Administrator Utama",
      actorRole: "ADMIN",
      action: "QUARANTINE_FASKES",
      targetResource: `/api/admin/faskes/${faskes.id}`,
      ipAddress: "10.0.1.1 (Admin Terminal)",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Admin Browser",
      severity: isQuarantining ? "CRITICAL" : "INFO",
      detail: `Kill-Switch: Status faskes ${faskes.nama} diubah menjadi ${
        isQuarantining ? "QUARANTINED (Terisolasi dari Cloud API)" : "ACTIVE"
      }`,
    };
    setStorageData("resilio_security_logs", [newLog, ...logs]);

    setNotif(
      `Status Faskes ${faskes.nama} berhasil diubah menjadi ${
        isQuarantining ? "QUARANTINED (Terisolasi)" : "ACTIVE (Normal)"
      }.`
    );
    setTimeout(() => setNotif(null), 5000);
  };

  const handleAddFaskes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBaru.trim()) return;

    const newFas: Faskes = {
      id: `FAS-0${faskesList.length + 1}`,
      kodeFaskes: `FAS-${Math.floor(100 + Math.random() * 900)}`,
      nama: namaBaru,
      tipe: tipeBaru,
      alamat: alamatBaru || "Jl. Kesehatan Nasional",
      kota: kotaBaru,
      spesialisasiList: ["Dokter Umum", "Kesehatan Ibu & Anak"],
      kategoriPenyakit: ["Penyakit Umum", "ISPA", "Pemeriksaan Rutin"],
      status: "ACTIVE",
      kontak: kontakBaru || "(0274) 123456",
    };

    const updated = [...faskesList, newFas];
    setStorageData("resilio_faskes_list", updated);
    setFaskesList(updated);

    setNamaBaru("");
    setAlamatBaru("");
    setKontakBaru("");
    setNotif(`Faskes ${newFas.nama} berhasil didaftarkan ke jaringan RME Nasional.`);
    setTimeout(() => setNotif(null), 4000);
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
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
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
    </div>
  );
}
