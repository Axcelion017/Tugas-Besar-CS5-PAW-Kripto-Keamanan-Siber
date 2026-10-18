"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MOCK_APPOINTMENTS,
  getStorageData,
  setStorageData,
  Appointment,
  TriaseLevel,
} from "@/lib/db/mockData";

export default function TriasePemeriksaanAwalPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string>("");

  // Vitals State
  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("80");
  const [heartRate, setHeartRate] = useState("78");
  const [temperature, setTemperature] = useState("36.6");
  const [respiratoryRate, setRespiratoryRate] = useState("18");
  const [spo2, setSpo2] = useState("98");
  const [beratBadan, setBeratBadan] = useState("65");
  const [tinggiBadan, setTinggiBadan] = useState("168");
  const [triaseLevel, setTriaseLevel] = useState<TriaseLevel>("HIJAU");
  const [catatanPerawat, setCatatanPerawat] = useState("");
  const [notif, setNotif] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
      setAppointments(allApts);
      const triageQueue = allApts.filter((a) => a.status === "WAITING_TRIAGE");
      if (triageQueue.length > 0) {
        setSelectedAptId(triageQueue[0].id);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const selectedApt = appointments.find((a) => a.id === selectedAptId) || null;

  const handleSubmitTriase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) {
      alert("Pilih antrean pasien triase yang valid terlebih dahulu.");
      return;
    }

    const allApts = getStorageData<Appointment[]>("resilio_appointments", MOCK_APPOINTMENTS);
    const updated = allApts.map((a) =>
      a.id === selectedApt.id
        ? {
            ...a,
            triaseLevel,
            triaseVitals: {
              systolic: Number(systolic),
              diastolic: Number(diastolic),
              heartRate: Number(heartRate),
              temperature: Number(temperature),
              respiratoryRate: Number(respiratoryRate),
              spo2: Number(spo2),
              beratBadan: Number(beratBadan),
              tinggiBadan: Number(tinggiBadan),
            },
            status: "WAITING_DOCTOR" as const,
            keluhanAwal: catatanPerawat ? `${a.keluhanAwal} | Triase: ${catatanPerawat}` : a.keluhanAwal,
          }
        : a
    );

    setStorageData("resilio_appointments", updated);
    setAppointments(updated);

    setNotif(
      `Pemeriksaan triase ${selectedApt.pasienNama} selesai dengan kategori ${triaseLevel}. Pasien siap diarahkan ke DPJP.`
    );
    setTimeout(() => {
      router.push(`/staf/assign-dpjp?aptId=${selectedApt.id}`);
    }, 1500);
  };

  const queueTriase = appointments.filter((a) => a.status === "WAITING_TRIAGE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
          <Link href="/staf" className="hover:underline">
            Meja Staf Nakes
          </Link>
          <span>/</span>
          <span>Pemeriksaan Awal & Triase Keperawatan (UR-S02)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Input Tanda-Tanda Vital Awal & Penentuan Tingkat Triase
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Perawat mengukur tensi, suhu, dan memilah kegawatan pasien (Hijau/Kuning/Merah) sebelum masuk ke ruang konsultasi dokter.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Antrean Pasien di Ruang Triase */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">
            Antrean Menunggu Triase ({queueTriase.length})
          </h2>

          {queueTriase.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Tidak ada pasien yang mengantre di ruang triase saat ini.
            </p>
          ) : (
            <div className="space-y-2">
              {queueTriase.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAptId(a.id)}
                  type="button"
                  className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                    selectedAptId === a.id
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {a.id}
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {a.checkInTime || "Baru Tiba"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1">{a.pasienNama}</h4>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {a.poli} • &quot;{a.keluhanAwal}&quot;
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formulir Pengukuran Triase Fisik */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-black uppercase text-amber-700">
              Pemeriksaan Fisik Pasien Terpilih
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              {selectedApt ? selectedApt.pasienNama : "Pilih Pasien"}
            </h2>
            <p className="text-xs text-slate-500">
              NIK: <span className="font-mono font-bold">{selectedApt?.pasienNik}</span> • Keluhan: &quot;{selectedApt?.keluhanAwal}&quot;
            </p>
          </div>

          <form onSubmit={handleSubmitTriase} className="space-y-6">
            {/* Pemilihan Tingkat Kegawatan Triase */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Klasifikasi Tingkat Kegawatan Triase Faskes *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTriaseLevel("HIJAU")}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    triaseLevel === "HIJAU"
                      ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <p className="text-xs font-black uppercase">Hijau (Non-Urgent)</p>
                  <span className="text-[10px] opacity-80">Stabil, rawat jalan rutin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTriaseLevel("KUNING")}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    triaseLevel === "KUNING"
                      ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <p className="text-xs font-black uppercase">Kuning (Urgent)</p>
                  <span className="text-[10px] opacity-80">Gejala sedang, butuh prioritas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTriaseLevel("MERAH")}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    triaseLevel === "MERAH"
                      ? "bg-red-50 border-red-400 text-red-900 ring-2 ring-red-500"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <p className="text-xs font-black uppercase">Merah (Emergency)</p>
                  <span className="text-[10px] opacity-80">Gawat darurat ke IGD</span>
                </button>
              </div>
            </div>

            {/* Input Tanda Vital */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Pengukuran Tanda-Tanda Vital Awal
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tensi Sistolik (mmHg)</span>
                  <input
                    type="number"
                    required
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tensi Diastolik (mmHg)</span>
                  <input
                    type="number"
                    required
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Detak Nadi (bpm)</span>
                  <input
                    type="number"
                    required
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Suhu (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Laju Napas (x/mnt)</span>
                  <input
                    type="number"
                    required
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">SPO2 (%)</span>
                  <input
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Berat Badan (kg)</span>
                  <input
                    type="number"
                    value={beratBadan}
                    onChange={(e) => setBeratBadan(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tinggi Badan (cm)</span>
                  <input
                    type="number"
                    value={tinggiBadan}
                    onChange={(e) => setTinggiBadan(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Catatan Pengamatan Awal Perawat Triase
              </label>
              <textarea
                rows={2}
                value={catatanPerawat}
                onChange={(e) => setCatatanPerawat(e.target.value)}
                placeholder="Contoh: Pasien tampak meringis memegang leher belakang, jalan dipapah keluarga..."
                className="w-full px-4 py-2 border rounded-xl text-sm"
              />
            </div>

            <div className="pt-4 border-t flex items-center justify-end gap-3">
              <button
                type="submit"
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                Simpan Hasil Triase & Arahkan ke DPJP →
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
