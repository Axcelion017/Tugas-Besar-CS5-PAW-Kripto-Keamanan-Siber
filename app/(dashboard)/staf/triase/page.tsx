"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Appointment, TriaseLevel } from "@/lib/db/mockData";
import { TriaseSchema } from "@/lib/validations/triage";
import { submitTriageServerAction } from "@/lib/actions/triage";
import { getAppointmentsServerAction } from "@/lib/actions/appointment";
import { PrintableMedicalResume } from "@/components/clinical/PrintableMedicalResume";

function TriaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAptId = searchParams.get("aptId") || "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string>(preselectedAptId);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const aptsRes = await getAppointmentsServerAction();
        if (aptsRes.success && Array.isArray(aptsRes.data)) {
          const mappedApts: Appointment[] = (
            aptsRes.data as unknown as Array<{
              id: string;
              patientId: string;
              patient?: { name?: string; nik?: string };
              faskesId: string;
              faskes?: { nama?: string };
              doctorId: string;
              doctor?: { name?: string };
              poli: string;
              tanggal: Date | string;
              jam: string;
              keluhanAwal: string;
              status: string;
              consentActive?: boolean;
              checkInTime?: string | null;
              triageAssessment?: {
                triaseLevel: string;
              } | null;
            }>
          ).map((a) => ({
            id: a.id,
            pasienId: a.patientId,
            pasienNama: a.patient?.name || "Pasien",
            pasienNik: a.patient?.nik || "-",
            faskesId: a.faskesId,
            faskesNama: a.faskes?.nama || "RSUP Dr. Sardjito",
            dokterId: a.doctorId,
            dokterNama: a.doctor?.name || "Dokter DPJP",
            poli: a.poli,
            tanggal: new Date(a.tanggal).toISOString().split("T")[0],
            jam: a.jam,
            keluhanAwal: a.keluhanAwal,
            status: (a.status as Appointment["status"]) || "WAITING_TRIAGE",
            consentActive: !!a.consentActive,
            checkInTime: a.checkInTime
              ? new Date(a.checkInTime).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                }) + " WIB"
              : undefined,
            triaseLevel:
              (a.triageAssessment?.triaseLevel as "HIJAU" | "KUNING" | "MERAH") || undefined,
          }));

          setAppointments(mappedApts);

          if (preselectedAptId && mappedApts.some((a) => a.id === preselectedAptId)) {
            setSelectedAptId(preselectedAptId);
          } else {
            const triageQueue = mappedApts.filter(
              (a) => a.status === "WAITING_TRIAGE" || a.status === "PENDING_ARRIVAL"
            );
            if (triageQueue.length > 0) {
              setSelectedAptId(triageQueue[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("Gagal memuat antrean triase dari PostgreSQL:", err);
      }
    }

    loadData();
  }, [preselectedAptId]);

  const selectedApt = appointments.find((a) => a.id === selectedAptId) || null;

  // Clinical Decision Support (CDS) ringan: deteksi otomatis nilai tanda vital kritis/abnormal
  const numSys = Number(systolic);
  const numDia = Number(diastolic);
  const numHr = Number(heartRate);
  const numTemp = Number(temperature);
  const numRr = Number(respiratoryRate);
  const numSpo2 = Number(spo2);

  const abnormalAlerts: string[] = [];
  const isSpo2Critical = !Number.isNaN(numSpo2) && numSpo2 > 0 && numSpo2 < 92;
  const isBpCritical =
    (!Number.isNaN(numSys) && (numSys >= 180 || (numSys > 0 && numSys < 90))) ||
    (!Number.isNaN(numDia) && numDia >= 110);
  const isTempAbnormal = !Number.isNaN(numTemp) && (numTemp >= 38.5 || (numTemp > 0 && numTemp < 35.5));
  const isHrAbnormal = !Number.isNaN(numHr) && (numHr > 120 || (numHr > 0 && numHr < 50));
  const isRrAbnormal = !Number.isNaN(numRr) && (numRr > 24 || (numRr > 0 && numRr < 12));

  if (isSpo2Critical) abnormalAlerts.push(`SpO2 Kritis (${numSpo2}% < 92%) — Indikasi Hipoksia / P1 MERAH`);
  if (isBpCritical) abnormalAlerts.push(`Tekanan Darah Kritis (${numSys}/${numDia} mmHg) — Krisis Hipertensi/Hipotensi`);
  if (isTempAbnormal) abnormalAlerts.push(`Suhu Tubuh Abnormal (${numTemp} °C)`);
  if (isHrAbnormal) abnormalAlerts.push(`Detak Jantung Abnormal (${numHr} bpm)`);
  if (isRrAbnormal) abnormalAlerts.push(`Frekuensi Napas Abnormal (${numRr} x/mnt)`);

  const handleSubmitTriase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotif(null);

    if (!selectedApt) {
      setErrorMsg("Pilih antrean pasien triase yang valid terlebih dahulu.");
      return;
    }

    const validation = TriaseSchema.safeParse({
      systolic: numSys,
      diastolic: numDia,
      heartRate: numHr,
      temperature: numTemp,
      respiratoryRate: numRr,
      spo2: numSpo2,
      beratBadan: Number(beratBadan),
      tinggiBadan: Number(tinggiBadan),
      triaseLevel,
      catatanPerawat: catatanPerawat || undefined,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Data tanda vital tidak valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitTriageServerAction(selectedApt.id, {
        systolic: numSys,
        diastolic: numDia,
        heartRate: numHr,
        temperature: numTemp,
        respiratoryRate: numRr,
        spo2: numSpo2,
        beratBadan: Number(beratBadan),
        tinggiBadan: Number(tinggiBadan),
        triaseLevel,
        catatanPerawat,
      });

      if (!res.success) {
        setErrorMsg(res.message || "Gagal menyimpan pengkajian triase ke PostgreSQL.");
        return;
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selectedApt.id
            ? { ...a, triaseLevel, status: "WAITING_DOCTOR" as const }
            : a
        )
      );

      setNotif(
        `Pemeriksaan triase ${selectedApt.pasienNama} tersimpan di PostgreSQL dengan kategori ${triaseLevel}. Status antrean beralih ke WAITING_DOCTOR.`
      );
      setTimeout(() => {
        router.push(`/staf/assign-dpjp?aptId=${encodeURIComponent(selectedApt.id)}`);
      }, 1200);
    } catch {
      setErrorMsg("Terjadi kendala jaringan saat menyimpan triase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const queueTriase = appointments.filter(
    (a) => a.status === "WAITING_TRIAGE" || a.status === "PENDING_ARRIVAL"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            Data tanda vital & peralihan status ke <code className="font-mono">WAITING_DOCTOR</code> disimpan atomik di PostgreSQL.
          </p>
        </div>

        {selectedApt && (
          <button
            type="button"
            onClick={() => setIsPrintOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start md:self-auto shrink-0"
          >
            <span>Cetak Lembar Triase & Kunjungan</span>
          </button>
        )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Antrean Pasien di Ruang Triase */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">
            Antrean Menunggu Triase ({queueTriase.length})
          </h2>

          {queueTriase.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
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
                    <span className="font-mono text-[10px] font-bold text-slate-500">{a.id}</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {a.checkInTime || a.status.replace(/_/g, " ")}
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
              NIK: <span className="font-mono font-bold">{selectedApt?.pasienNik || "-"}</span> • Keluhan: &quot;{selectedApt?.keluhanAwal || "-"}&quot;
            </p>
          </div>

          {/* Clinical Decision Support: Peringatan Tanda Vital Abnormal */}
          {abnormalAlerts.length > 0 && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-50 border-2 border-red-400 text-red-900 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black uppercase tracking-wider text-red-700">
                  PERINGATAN TANDA VITAL ABNORMAL (CLINICAL DECISION SUPPORT)
                </span>
                {triaseLevel === "HIJAU" && (
                  <button
                    type="button"
                    onClick={() => setTriaseLevel(isSpo2Critical || isBpCritical ? "MERAH" : "KUNING")}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer"
                  >
                    Set Triase {isSpo2Critical || isBpCritical ? "MERAH" : "KUNING"}
                  </button>
                )}
              </div>
              <ul className="list-disc pl-4 space-y-0.5 font-semibold">
                {abnormalAlerts.map((alertText) => (
                  <li key={alertText}>{alertText}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmitTriase} className="space-y-6">
            {/* Pemilihan Tingkat Kegawatan Triase */}
            <div>
              <span className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Klasifikasi Tingkat Kegawatan Triase Faskes *
              </span>
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
              <span className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Pengukuran Tanda-Tanda Vital Awal
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="triage-sys" className="text-[10px] font-bold text-slate-600 uppercase">
                    Tensi Sistolik (mmHg)
                  </label>
                  <input
                    id="triage-sys"
                    type="number"
                    required
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isBpCritical ? "border-red-500 bg-red-50 text-red-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-dia" className="text-[10px] font-bold text-slate-600 uppercase">
                    Tensi Diastolik (mmHg)
                  </label>
                  <input
                    id="triage-dia"
                    type="number"
                    required
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isBpCritical ? "border-red-500 bg-red-50 text-red-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-hr" className="text-[10px] font-bold text-slate-600 uppercase">
                    Detak Jantung (bpm)
                  </label>
                  <input
                    id="triage-hr"
                    type="number"
                    required
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isHrAbnormal ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-temp" className="text-[10px] font-bold text-slate-600 uppercase">
                    Suhu Tubuh (°C)
                  </label>
                  <input
                    id="triage-temp"
                    type="number"
                    step="0.1"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isTempAbnormal ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-rr" className="text-[10px] font-bold text-slate-600 uppercase">
                    Pernapasan (x/mnt)
                  </label>
                  <input
                    id="triage-rr"
                    type="number"
                    required
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isRrAbnormal ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-spo2" className="text-[10px] font-bold text-slate-600 uppercase">
                    Saturasi SpO2 (%)
                  </label>
                  <input
                    id="triage-spo2"
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-xl font-bold text-sm ${
                      isSpo2Critical ? "border-red-500 bg-red-50 text-red-900" : "border-slate-300"
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="triage-bb" className="text-[10px] font-bold text-slate-600 uppercase">
                    Berat Badan (kg)
                  </label>
                  <input
                    id="triage-bb"
                    type="number"
                    step="0.1"
                    required
                    value={beratBadan}
                    onChange={(e) => setBeratBadan(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="triage-tb" className="text-[10px] font-bold text-slate-600 uppercase">
                    Tinggi Badan (cm)
                  </label>
                  <input
                    id="triage-tb"
                    type="number"
                    step="0.1"
                    required
                    value={tinggiBadan}
                    onChange={(e) => setTinggiBadan(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="triage-notes" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Catatan Pengkajian Perawat Triase
              </label>
              <textarea
                id="triage-notes"
                rows={3}
                value={catatanPerawat}
                onChange={(e) => setCatatanPerawat(e.target.value)}
                placeholder="Catatan keluhan spesifik, risiko jatuh, atau observasi perawat..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !selectedApt}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {isSubmitting ? "Menyimpan ke PostgreSQL..." : "Simpan & Klasifikasikan Triase →"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isPrintOpen && selectedApt && (
        <PrintableMedicalResume
          onClose={() => setIsPrintOpen(false)}
          data={{
            recordId: `TRIASE-${selectedApt.id}`,
            faskesNama: selectedApt.faskesNama || "RSUP Dr. Sardjito",
            patientNama: selectedApt.pasienNama,
            patientNik: selectedApt.pasienNik || "-",
            patientMrn: selectedApt.pasienId,
            tanggalPeriksa: selectedApt.tanggal,
            poli: selectedApt.poli,
            dokterNama: selectedApt.dokterNama || "Menunggu Penunjukan DPJP",
            dokterSpecialty: selectedApt.poli,
            dokterStr: "-",
            dokterSip: "-",
            perawatNama: "Perawat Triase Loket",
            perawatNip: "-",
            triaseLevel,
            triageVitals: {
              systolic: numSys,
              diastolic: numDia,
              heartRate: numHr,
              temperature: numTemp,
              spo2: numSpo2,
            },
            subjective: selectedApt.keluhanAwal,
            diagnosisIcd10: "PENDING",
            diagnosisShort: "Pengkajian Awal Triase Keperawatan",
            prescriptions: [],
            edukasiDokter: catatanPerawat || "Menunggu konsultasi DPJP",
            version: 1,
          }}
        />
      )}
    </div>
  );
}

export default function TriasePemeriksaanAwalPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm p-6">Memuat halaman triase...</div>}>
      <TriaseContent />
    </Suspense>
  );
}
