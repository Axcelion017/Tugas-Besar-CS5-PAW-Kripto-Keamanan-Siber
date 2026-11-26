"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_ACCESS_GRANTS,
  MOCK_FASKES,
  getStorageData,
  setStorageData,
  AccessGrant,
} from "@/lib/db/mockData";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { createWalkInAppointmentServerAction } from "@/lib/actions/appointment";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default function StafRujukanAdminPage() {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [faskesOptions, setFaskesOptions] = useState<Array<{ id: string; nama: string; tipe: string }>>(
    MOCK_FASKES.map((f) => ({ id: f.id, nama: f.nama, tipe: f.tipe }))
  );
  const [activeTab, setActiveTab] = useState<"keluar" | "masuk">("keluar");
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Rujukan Masuk Baru
  const [inNama, setInNama] = useState("");
  const [inNik, setInNik] = useState("");
  const [inAsalFaskes, setInAsalFaskes] = useState("Klinik Pratama Sehat Mandiri");
  const [inPoli, setInPoli] = useState("Poli Penyakit Dalam");
  const [inDiagnosa, setInDiagnosa] = useState("");
  const [showInModal, setShowInModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGrants(getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS));
    }, 0);

    getFaskesListServerAction()
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setFaskesOptions(
            (res.data as unknown as Array<{ id: string; nama: string; tipe: string }>).map((f) => ({
              id: f.id,
              nama: f.nama,
              tipe: f.tipe,
            }))
          );
        }
      })
      .catch(() => {});

    return () => clearTimeout(timer);
  }, []);

  const handleCreateIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!inNama || !inNik) return;

    // Daftarkan juga antrean rujukan masuk ke PostgreSQL bila pasien terdaftar via NIK
    let dbNote = "";
    if (/^\d{16}$/.test(inNik)) {
      const aptRes = await createWalkInAppointmentServerAction({
        nik: inNik,
        poli: inPoli,
        keluhan: `Rujukan Masuk dari ${inAsalFaskes}: ${inDiagnosa || "Observasi lanjutan"}`,
      });
      if (aptRes.success) {
        dbNote = " Antrean Loket Triase PostgreSQL juga otomatis diterbitkan.";
      }
    }

    const newGrant: AccessGrant = {
      id: `GRANT-IN-${Date.now().toString().slice(-4)}`,
      pasienId: `P-${Date.now().toString().slice(-3)}`,
      pasienNama: inNama,
      entityId: "FAS-01",
      entityNama: "RSUP Dr. Sardjito",
      entityType: "FASKES",
      scope: `Rujukan Masuk dari ${inAsalFaskes} (${inPoli}) - Diagnosa: ${inDiagnosa || "Observasi"}`,
      validUntil: "30 Hari Kedepan",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };

    const updated = [newGrant, ...grants];
    setStorageData("resilio_access_grants", updated);
    setGrants(updated);

    setShowInModal(false);
    setInNama("");
    setInNik("");
    setInDiagnosa("");
    setActiveTab("masuk");
    setNotif(`Berkas rujukan masuk untuk ${inNama} berhasil didaftarkan ke ${inPoli}.${dbNote}`);
    setTimeout(() => setNotif(null), 5000);
  };

  // Pisahkan secara tegas data Rujukan Masuk vs Rujukan Keluar
  const incomingReferrals = grants.filter(
    (g) =>
      g.scope.toLowerCase().includes("rujukan masuk") ||
      g.id.startsWith("GRANT-IN-")
  );
  const outgoingReferrals = grants.filter(
    (g) =>
      !g.scope.toLowerCase().includes("rujukan masuk") &&
      !g.id.startsWith("GRANT-IN-") &&
      (g.entityType === "FASKES" || g.scope.toLowerCase().includes("rujukan"))
  );
  const displayedReferrals = activeTab === "keluar" ? outgoingReferrals : incomingReferrals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[
            { label: "Meja Staf Nakes", href: "/staf" },
            { label: "Administrasi Rujukan" },
          ]}
        />
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Pengelolaan Surat Rujukan Berjenjang (Masuk & Keluar)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Memproses perpindahan pasien antar fasilitas kesehatan secara digital tanpa berkas fisik. Tiket izin akses rekam medis ditransfer otomatis ke faskes tujuan.
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

      {/* Kontrol Tab & Tombol Pendaftaran Rujukan Masuk */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("keluar")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "keluar"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            Rujukan Keluar (Pasien Dirujuk ke RS Lain)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("masuk")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "masuk"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            Rujukan Masuk (Pasien dari Faskes Lain)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowInModal(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase rounded-xl shadow-sm transition cursor-pointer"
        >
          + Terima Pasien Rujukan Masuk
        </button>
      </div>

      {/* Tabel Rujukan */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            {activeTab === "keluar"
              ? "Daftar Berkas Rujukan Keluar Faskes"
              : "Daftar Pasien Rujukan Masuk dari Faskes Lain"}
          </h2>
          <span className="text-xs font-mono text-slate-500">
            {displayedReferrals.length} Berkas Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">No. Tiket Rujukan</th>
                <th className="p-4">Nama Pasien</th>
                <th className="p-4">Faskes / Entitas Tujuan</th>
                <th className="p-4">Cakupan Izin & Alasan Klinis</th>
                <th className="p-4">Masa Berlaku</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedReferrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                    {activeTab === "keluar"
                      ? "Belum ada berkas rujukan keluar faskes saat ini."
                      : "Belum ada pasien rujukan masuk dari faskes lain. Klik '+ Terima Pasien Rujukan Masuk' untuk mendaftarkan."}
                  </td>
                </tr>
              ) : (
                displayedReferrals.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-4 font-mono font-bold text-slate-900">{g.id}</td>
                  <td className="p-4 font-bold text-slate-900 text-sm">{g.pasienNama}</td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-800">{g.entityNama}</span>
                    <span className="block text-[10px] text-slate-500 uppercase">{g.entityType}</span>
                  </td>
                  <td className="p-4 text-slate-600 max-w-sm">{g.scope}</td>
                  <td className="p-4 font-mono text-slate-500">{g.validUntil}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        g.isRevoked
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {g.isRevoked ? "Selesai / Dicabut" : "Izin Rujukan Aktif"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href="/staf/assign-dpjp"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg uppercase"
                    >
                      Arahkan Poli
                    </Link>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Terima Rujukan Masuk */}
      {showInModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              Penerimaan Pasien Rujukan Masuk dari Faskes Lain
            </h3>
            <p className="text-xs text-slate-500">
              Daftarkan pasien rujukan digital yang datang membawa kode tiket rujukan nasional.
            </p>

            <form onSubmit={handleCreateIncoming} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap Pasien *
                </label>
                <input
                  type="text"
                  required
                  value={inNama}
                  onChange={(e) => setInNama(e.target.value)}
                  placeholder="Contoh: Anisa Rahma"
                  className="w-full px-4 py-2 border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  NIK Pasien *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={inNik}
                  onChange={(e) => setInNik(e.target.value.replace(/\D/g, ""))}
                  placeholder="3171012304800001"
                  className="w-full px-4 py-2 border rounded-xl font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Fasilitas Kesehatan Asal Perujuk
                </label>
                <select
                  value={inAsalFaskes}
                  onChange={(e) => setInAsalFaskes(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-sm bg-white"
                >
                  {faskesOptions.map((f) => (
                    <option key={f.id} value={f.nama}>
                      {f.nama} ({f.tipe})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Poli Spesialis yang Dituju
                </label>
                <select
                  value={inPoli}
                  onChange={(e) => setInPoli(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-sm bg-white font-semibold"
                >
                  <option value="Poli Penyakit Dalam">Poli Penyakit Dalam</option>
                  <option value="Poli Kardiologi (Jantung)">Poli Kardiologi (Jantung)</option>
                  <option value="Poli Bedah">Poli Bedah Umum</option>
                  <option value="Poli Anak">Poli Anak</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Diagnosa Sementara dari Dokter Perujuk
                </label>
                <input
                  type="text"
                  value={inDiagnosa}
                  onChange={(e) => setInDiagnosa(e.target.value)}
                  placeholder="Contoh: Hipertensi Urgensi, Curiga Gagal Ginjal"
                  className="w-full px-4 py-2 border rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowInModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
                >
                  Terima Rujukan & Daftarkan Antrean
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
