"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  MOCK_FASKES,
  MOCK_ACCESS_GRANTS,
  getStorageData,
  setStorageData,
  AccessGrant,
} from "@/lib/db/mockData";

export default function SuratRujukanPage() {
  const session = getUserSession();
  const [pasienId, setPasienId] = useState("P-101");
  const [faskesTujuanId, setFaskesTujuanId] = useState("FAS-02");
  const [spesialisasiTujuan, setSpesialisasiTujuan] = useState("Spesialis Kardiologi");
  const [alasanRujukan, setAlasanRujukan] = useState(
    "Hipertensi refrakter dengan dugaan komplikasi kardiomegali, memerlukan evaluasi echocardiography lanjutan."
  );
  const [notif, setNotif] = useState<string | null>(null);

  const allPatients = getStorageData("resilio_patients", MOCK_PATIENTS);
  const targetPatient = allPatients.find((p) => p.id === pasienId) || allPatients[0];
  const targetFaskes = MOCK_FASKES.find((f) => f.id === faskesTujuanId) || MOCK_FASKES[1];

  const handleBuatRujukan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    // Otomatis terbitkan AccessGrant untuk Faskes Tujuan (Seamless Referral)
    const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const newGrant: AccessGrant = {
      id: `GRANT-REF-${Date.now().toString().slice(-4)}`,
      pasienId: targetPatient.id,
      pasienNama: targetPatient.name,
      entityId: targetFaskes.id,
      entityNama: targetFaskes.nama,
      entityType: "FASKES",
      scope: `Surat Rujukan Medis: ${spesialisasiTujuan}`,
      validUntil: "30 Hari Kedepan",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };

    setStorageData("resilio_access_grants", [newGrant, ...allGrants]);

    setNotif(
      `Surat Rujukan Digital berhasil diterbitkan. Izin akses data medis otomatis aktif di ${targetFaskes.nama} tanpa perlu berkas fisik manual.`
    );
    setTimeout(() => setNotif(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <span>Surat Rujukan Digital & Seamless Transfer (UR-T06)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Penerbitan Surat Rujukan Digital Lintas Fasilitas Kesehatan
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Memudahkan perpindahan pasien antar faskes. Sistem otomatis mentransfer tiket izin baca riwayat penyakit ke RS rujukan.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Formulir Rujukan */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
        <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
          Surat Rujukan Fasilitas Kesehatan Lanjutan (Tingkat 2 / Khusus)
        </h2>

        <form onSubmit={handleBuatRujukan} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Pilih Pasien yang Dirujuk
              </label>
              <select
                value={pasienId}
                onChange={(e) => setPasienId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {allPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (NIK: {p.nik})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Fasilitas Kesehatan Tujuan Rujukan
              </label>
              <select
                value={faskesTujuanId}
                onChange={(e) => setFaskesTujuanId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {MOCK_FASKES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama} ({f.tipe})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Spesialisasi / Poliklinik Rujukan
            </label>
            <input
              type="text"
              required
              value={spesialisasiTujuan}
              onChange={(e) => setSpesialisasiTujuan(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Alasan Klinis & Indikasi Rujukan Medis *
            </label>
            <textarea
              required
              rows={4}
              value={alasanRujukan}
              onChange={(e) => setAlasanRujukan(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">
              Kedaulatan & Keterlacakan Data (Traceability):
            </p>
            <p>
              • Atribusi Dokter Perujuk: <strong>{session?.name}</strong> (STR: {session?.strNumber})
            </p>
            <p>
              • Hak akses rekam medis klinik asal otomatis dibagikan secara aman ke faskes tujuan selama masa rujukan.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition cursor-pointer"
          >
            Sahkan Surat Rujukan Digital & Kirim Tiket Akses
          </button>
        </form>
      </div>
    </div>
  );
}
