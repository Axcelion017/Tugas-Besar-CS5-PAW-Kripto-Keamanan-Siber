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

interface PatientOption {
  id: string;
  name: string;
  nik: string;
}

interface FaskesOption {
  id: string;
  nama: string;
  tipe: string;
  status: string;
}

function generateReferralGrantId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function NakesRujukanPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [faskesList, setFaskesList] = useState<FaskesOption[]>([]);
  const [pasienId, setPasienId] = useState("");
  const [faskesTujuanId, setFaskesTujuanId] = useState("");
  const [spesialisasiTujuan, setSpesialisasiTujuan] = useState("Spesialis Kardiologi");
  const [alasanRujukan, setAlasanRujukan] = useState(
    "Hipertensi refrakter dengan dugaan komplikasi kardiomegali, memerlukan evaluasi echocardiography lanjutan."
  );
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      const s = getUserSession();
      if (s) setSession(s);

      try {
        const [patientsRes, faskesRes] = await Promise.all([
          getDoctorPatientListServerAction(),
          getFaskesListServerAction(),
        ]);

        if (patientsRes.success && patientsRes.patients.length > 0) {
          const pOpts = patientsRes.patients.map((p) => ({
            id: p.id,
            name: p.name,
            nik: p.nik,
          }));
          setPatients(pOpts);
          setPasienId(pOpts[0].id);
        }

        if (faskesRes.success && Array.isArray(faskesRes.data) && faskesRes.data.length > 0) {
          const fOpts = (faskesRes.data as unknown as FaskesOption[]).filter(
            (f) => f.status !== "QUARANTINED"
          );
          setFaskesList(fOpts);
          if (fOpts.length > 0) setFaskesTujuanId(fOpts[0].id);
        }
      } catch (err) {
        console.warn("Gagal memuat opsi pasien/faskes rujukan:", err);
      }
    }

    loadOptions();
  }, []);

  const targetPatient = patients.find((p) => p.id === pasienId);
  const targetFaskes = faskesList.find((f) => f.id === faskesTujuanId);

  const handleBuatRujukan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!session) return;

    if (!targetPatient) {
      setErrorMsg(`Data Pasien dengan ID "${pasienId}" tidak ditemukan dalam basis data.`);
      return;
    }

    if (!targetFaskes) {
      setErrorMsg(`Fasilitas Kesehatan tujuan tidak ditemukan atau sedang dikarantina.`);
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
      scope: `Surat Rujukan Medis: ${spesialisasiTujuan} — ${alasanRujukan}`,
      validUntil: "30 Hari Kedepan",
      isRevoked: false,
      createdAt: new Date().toLocaleString("id-ID"),
    };

    setStorageData("resilio_access_grants", [newGrant, ...allGrants]);

    setNotif(
      `Surat Rujukan Digital untuk ${targetPatient.name} berhasil diterbitkan ke ${targetFaskes.nama}.`
    );
    setTimeout(() => setNotif(null), 5000);
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
          Penerbitan Surat Rujukan Digital Lintas Fasilitas Kesehatan
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Daftar pasien dan fasilitas kesehatan aktif dimuat langsung dari PostgreSQL. Faskes berstatus karantina otomatis dikecualikan.
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

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
        <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
          Surat Rujukan Fasilitas Kesehatan Lanjutan (Tingkat 2 / Khusus)
        </h2>

        <form onSubmit={handleBuatRujukan} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rujukan-pasien" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Pilih Pasien yang Dirujuk
              </label>
              <select
                id="rujukan-pasien"
                value={pasienId}
                onChange={(e) => setPasienId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (NIK: {p.nik})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rujukan-faskes" className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Fasilitas Kesehatan Tujuan Rujukan
              </label>
              <select
                id="rujukan-faskes"
                value={faskesTujuanId}
                onChange={(e) => setFaskesTujuanId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {faskesList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama} ({f.tipe})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="rujukan-spesialisasi" className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Spesialisasi / Poliklinik Rujukan
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

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              Terbitkan Surat Rujukan Digital →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
