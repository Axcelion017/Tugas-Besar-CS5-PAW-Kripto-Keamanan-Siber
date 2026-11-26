"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_ACCESS_GRANTS,
  getStorageData,
  setStorageData,
  AccessGrant,
} from "@/lib/db/mockData";
import { getDoctorPatientListServerAction } from "@/lib/actions/clinical";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { ToastBanner } from "@/components/ui/ToastBanner";

interface HandledPatientOption {
  id: string;
  name: string;
  nik: string;
  mrn: string;
  allergies: string[];
  latestDiagnosis: string;
  queueStatus: "IN_QUEUE" | "IDLE";
  hasAccessGrant: boolean;
  triaseLevel: "MERAH" | "KUNING" | "HIJAU";
}

interface FaskesOption {
  id: string;
  nama: string;
  tipe: string;
  status: string;
}

const URGENCY_OPTIONS = [
  { id: "Rutin (7 Hari)", label: "Rutin (7 Hari)", desc: "Evaluasi terjadwal poli tujuan" },
  { id: "Mendesak (24 Jam)", label: "Mendesak (24 Jam)", desc: "Perlu peninjauan spesialis segera" },
  { id: "Gawat Darurat (IGD)", label: "Gawat Darurat (IGD)", desc: "Transfer segera dengan pendampingan" },
] as const;

const PRIORITY_RANK: Record<"MERAH" | "KUNING" | "HIJAU", number> = {
  MERAH: 0,
  KUNING: 1,
  HIJAU: 2,
};

function generateReferralGrantId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function NakesRujukanPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [patients, setPatients] = useState<HandledPatientOption[]>([]);
  const [faskesList, setFaskesList] = useState<FaskesOption[]>([]);
  const [issuedReferrals, setIssuedReferrals] = useState<AccessGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [patientQuery, setPatientQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL_HANDLED" | "IN_QUEUE">("ALL_HANDLED");
  const [pasienId, setPasienId] = useState("");
  const [faskesTujuanId, setFaskesTujuanId] = useState("");
  const [urgensi, setUrgensi] = useState<string>(URGENCY_OPTIONS[1].id);
  const [spesialisasiTujuan, setSpesialisasiTujuan] = useState("Spesialis Kardiologi");
  const [alasanRujukan, setAlasanRujukan] = useState(
    "Hipertensi refrakter dengan dugaan komplikasi kardiomegali, memerlukan evaluasi echocardiography lanjutan."
  );
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      setIsLoading(true);
      const s = getUserSession();
      if (active && s) setSession(s);

      try {
        const [patientsRes, faskesRes] = await Promise.all([
          getDoctorPatientListServerAction(),
          getFaskesListServerAction(),
        ]);

        if (active && patientsRes.success) {
          // Hanya tampilkan pasien yang sedang ditangani DPJP (antrean aktif atau consent aktif)
          const handled = patientsRes.patients
            .filter((p) => p.hasAccessGrant || p.queueStatus === "IN_QUEUE")
            .map((p) => ({
              id: p.id,
              name: p.name,
              nik: p.nik,
              mrn: p.mrn,
              allergies: p.allergies || [],
              latestDiagnosis: p.latestDiagnosis,
              queueStatus: p.queueStatus,
              hasAccessGrant: p.hasAccessGrant,
              triaseLevel: (p.triaseLevel || "HIJAU") as "MERAH" | "KUNING" | "HIJAU",
            }))
            .sort((a, b) => {
              if (a.queueStatus !== b.queueStatus) {
                return a.queueStatus === "IN_QUEUE" ? -1 : 1;
              }
              return PRIORITY_RANK[a.triaseLevel] - PRIORITY_RANK[b.triaseLevel];
            });

          setPatients(handled);
          if (handled.length > 0) setPasienId(handled[0].id);
        }

        if (active && faskesRes.success && Array.isArray(faskesRes.data)) {
          const fOpts = (faskesRes.data as unknown as FaskesOption[]).filter(
            (f) => f.status !== "QUARANTINED"
          );
          setFaskesList(fOpts);
          if (fOpts.length > 0) setFaskesTujuanId(fOpts[0].id);
        }
      } catch (err) {
        console.warn("Gagal memuat opsi pasien/faskes rujukan:", err);
      }

      if (active) {
        const storedGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
        setIssuedReferrals(storedGrants.filter((g) => g.scope.startsWith("Surat Rujukan")));
        setIsLoading(false);
      }
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const visiblePatients = patients.filter((p) => {
    if (scopeFilter === "IN_QUEUE" && p.queueStatus !== "IN_QUEUE") return false;
    const q = patientQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.nik.includes(q) ||
      p.latestDiagnosis.toLowerCase().includes(q)
    );
  });

  const targetPatient = patients.find((p) => p.id === pasienId) || null;
  const targetFaskes = faskesList.find((f) => f.id === faskesTujuanId) || null;
  const queuedCount = patients.filter((p) => p.queueStatus === "IN_QUEUE").length;

  const handleBuatRujukan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!session) return;

    if (!targetPatient) {
      setErrorMsg("Silakan pilih salah satu pasien yang sedang Anda tangani pada panel sebelah kiri.");
      return;
    }

    if (!targetFaskes) {
      setErrorMsg("Fasilitas Kesehatan tujuan tidak ditemukan atau sedang dikarantina.");
      return;
    }

    const allGrants = getStorageData<AccessGrant[]>("resilio_access_grants", MOCK_ACCESS_GRANTS);
    const newGrant: AccessGrant = {
      id: generateReferralGrantId("GRANT-REF"),
      pasienId: targetPatient.id,
      pasienNama: targetPatient.name,
      entityId: targetFaskes.id,
      entityNama: targetFaskes.nama,
      entityType: "FASKES",
      scope: `Surat Rujukan Medis [${urgensi}]: ${spesialisasiTujuan} — ${alasanRujukan}`,
      validUntil: "30 Hari Kedepan",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };

    const updated = [newGrant, ...allGrants];
    setStorageData("resilio_access_grants", updated);
    setIssuedReferrals(updated.filter((g) => g.scope.startsWith("Surat Rujukan")));

    setNotif(
      `Surat Rujukan Digital (${urgensi}) untuk ${targetPatient.name} berhasil diterbitkan ke ${targetFaskes.nama}.`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
          <Link href="/nakes" className="hover:underline">
            Stasiun Nakes
          </Link>
          <span>/</span>
          <span>Surat Rujukan Digital & Seamless Transfer (UR-T06)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Penerbitan Surat Rujukan Digital Lintas Faskes
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          Pilih pasien yang sedang Anda tangani pada panel kiri untuk menerbitkan rujukan beserta tiket izin akses sementara. Faskes berstatus karantina otomatis dikecualikan.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Master-Detail 12-Grid: Panel Kiri Pilih Pasien Sedang Ditangani | Panel Kanan Form Rujukan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (5): Daftar Kartu Pasien Sedang Ditangani */}
        <section
          aria-label="Daftar pasien yang sedang ditangani"
          className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-4 bg-slate-50/80 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Pasien Sedang Ditangani
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {patients.length} Pasien
              </span>
            </div>

            <input
              type="text"
              aria-label="Cari pasien yang sedang ditangani"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              placeholder="Cari nama, No. RM, atau diagnosis..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScopeFilter("ALL_HANDLED")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  scopeFilter === "ALL_HANDLED"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Semua Ditangani ({patients.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("IN_QUEUE")}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  scopeFilter === "IN_QUEUE"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Antrean Aktif ({queuedCount})
              </button>
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                Memuat daftar pasien yang sedang ditangani dari PostgreSQL...
              </div>
            ) : visiblePatients.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Belum ada pasien yang sedang ditangani pada filter ini.
                </p>
                <p className="text-xs text-slate-500">
                  Pasien akan tampil otomatis setelah mendapatkan izin consent aktif atau penugasan DPJP.
                </p>
              </div>
            ) : (
              visiblePatients.map((p) => {
                const isSelected = p.id === pasienId;
                const badgeClass =
                  p.triaseLevel === "MERAH"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : p.triaseLevel === "KUNING"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300";

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPasienId(p.id)}
                    aria-pressed={isSelected}
                    className={`w-full p-4 text-left transition cursor-pointer border-l-4 space-y-1.5 ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-600"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black truncate ${isSelected ? "text-emerald-950" : "text-slate-900"}`}>
                            {p.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            {p.mrn} • NIK {p.nik}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
                        {p.triaseLevel === "MERAH" ? "P1 MERAH" : p.triaseLevel === "KUNING" ? "P2 KUNING" : "P3 HIJAU"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1 pl-10">
                      {p.latestDiagnosis}
                    </p>

                    <div className="flex items-center gap-2 pl-10">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          p.queueStatus === "IN_QUEUE"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.queueStatus === "IN_QUEUE" ? "Sedang Dalam Antrean" : "Consent Aktif DPJP"}
                      </span>
                      {p.allergies.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                          Alergi: {p.allergies[0]}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Kolom Kanan (7): Formulir & Pratinjau Penerbitan Surat Rujukan */}
        <section className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900">
              Formulir Surat Rujukan Faskes Lanjutan
            </h2>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              Masa Izin: 30 Hari
            </span>
          </div>

          {/* Strip Konteks Pasien Terpilih (NISTIR 7804) */}
          {targetPatient ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Pasien Terpilih untuk Dirujuk
                </span>
                <p className="text-sm font-black text-slate-900">
                  {targetPatient.name}{" "}
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    ({targetPatient.mrn})
                  </span>
                </p>
                <p className="text-xs text-slate-600">{targetPatient.latestDiagnosis}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {targetPatient.allergies.length > 0 ? (
                  targetPatient.allergies.map((al) => (
                    <span
                      key={al}
                      className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-black uppercase"
                    >
                      Alergi: {al}
                    </span>
                  ))
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    Tanpa Alergi Tercatat
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              Pilih pasien yang sedang ditangani pada panel kiri untuk mulai mengisi surat rujukan.
            </div>
          )}

          <form onSubmit={handleBuatRujukan} className="space-y-4">
            {/* Tingkat Urgensi Rujukan */}
            <div>
              <span className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Tingkat Urgensi Transfer Rujukan
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {URGENCY_OPTIONS.map((opt) => {
                  const active = urgensi === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUrgensi(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        active
                          ? opt.id.includes("Gawat")
                            ? "bg-red-50 border-red-400 text-red-900"
                            : "bg-emerald-50 border-emerald-500 text-emerald-950"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-xs font-black">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rujukan-faskes" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Fasilitas Kesehatan Tujuan *
                </label>
                <select
                  id="rujukan-faskes"
                  value={faskesTujuanId}
                  onChange={(e) => setFaskesTujuanId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {faskesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nama} ({f.tipe})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rujukan-spesialisasi" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Poliklinik / Spesialisasi Tujuan *
                </label>
                <input
                  id="rujukan-spesialisasi"
                  type="text"
                  required
                  value={spesialisasiTujuan}
                  onChange={(e) => setSpesialisasiTujuan(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rujukan-alasan" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Alasan Klinis & Indikasi Rujukan Medis *
              </label>
              <textarea
                id="rujukan-alasan"
                required
                rows={4}
                value={alasanRujukan}
                onChange={(e) => setAlasanRujukan(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Ringkasan Pratinjau Tiket Rujukan */}
            {targetPatient && targetFaskes && (
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  Ringkasan Tiket Rujukan Digital
                </span>
                <p className="text-slate-700">
                  Merujuk <strong>{targetPatient.name}</strong> ke{" "}
                  <strong>{targetFaskes.nama}</strong> ({spesialisasiTujuan}) dengan urgensi{" "}
                  <strong>{urgensi}</strong>.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!targetPatient || !targetFaskes}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Terbitkan Surat Rujukan Digital →
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Riwayat Surat Rujukan Diterbitkan */}
      {issuedReferrals.length > 0 && (
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Riwayat Surat Rujukan Digital Terakhir
            </h2>
            <span className="text-xs font-bold text-slate-500">{issuedReferrals.length} Tiket</span>
          </div>
          <div className="divide-y divide-slate-100">
            {issuedReferrals.slice(0, 5).map((ref) => (
              <div key={ref.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">
                    {ref.pasienNama} → <span className="text-emerald-700">{ref.entityNama}</span>
                  </p>
                  <p className="text-slate-600 line-clamp-1">{ref.scope}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-slate-500">{ref.createdAt}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                    {ref.validUntil}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ToastBanner message={notif} type="success" onDismiss={() => setNotif(null)} />
    </div>
  );
}
