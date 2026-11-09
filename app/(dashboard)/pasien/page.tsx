"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  MOCK_PATIENTS,
  getStorageData,
  Appointment,
  Patient,
  FamilyMember,
  AccessGrant,
  AppointmentStatus,
  TriaseLevel,
  calculateAge,
} from "@/lib/db/mockData";
import { DashboardSkeleton, SkeletonDisruptionNotice } from "@/components/ui/Skeleton";
import { getPatientProfileServerAction } from "@/lib/actions/auth";
import { getAppointmentsServerAction } from "@/lib/actions/appointment";
import { getAccessGrantsServerAction } from "@/lib/actions/consent";
import { getMedicalRecordsServerAction } from "@/lib/actions/clinical";
import { VitalSignsTrendChart, VitalSignMetric } from "@/components/clinical/VitalSignsTrendChart";

export default function PasienDashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<string>("SELF");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [vitalMetrics, setVitalMetrics] = useState<VitalSignMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const mode = localStorage.getItem("resilio_network_mode");
      setIsOfflineMode(mode === "offline");
    }, 0);
    const checkOffline = () => {
      const mode = localStorage.getItem("resilio_network_mode");
      setIsOfflineMode(mode === "offline");
    };
    window.addEventListener("storage", checkOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", checkOffline);
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      const s = getUserSession();
      if (!s) {
        setIsLoading(false);
        return;
      }
      setSession(s);

      let safePatient: Patient | null = null;

      // 1. Ambil data profil dari database PostgreSQL
      try {
        const dbRes = await getPatientProfileServerAction(s.id);
        if (dbRes.success && dbRes.data?.patient) {
          const p = dbRes.data.patient;
          const isTempNik = p.nik.startsWith("TEMP-");
          const realAge = calculateAge(p.birthDate);
          safePatient = {
            id: p.id,
            nik: isTempNik ? "" : p.nik,
            name: p.name,
            mrn: p.mrn,
            bloodType: p.bloodType || "O+",
            age: realAge,
            gender: p.gender || "L",
            emergencyContact: {
              name: p.emergencyContactName || "Keluarga Terdaftar",
              relation: p.emergencyContactRelation || "Keluarga",
              phone: p.emergencyContactPhone || s.phone || "-",
            },
            allergies: p.allergies || [],
            familyMembers: (p.familyMembers as unknown as FamilyMember[]) || [],
            lastVisit: "-",
            hasAccess: true,
            encryptionKeyHex: p.encryptionKeyHex || s.encryptionKeyHex || "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
            statusKyc: dbRes.data.statusAccount === "VERIFIED" ? "VERIFIED" : "PENDING",
          };
        }
      } catch (err: unknown) {
        console.warn("DB profile lookup fallback:", err);
      }

      // 2. Fallback ke local storage hanya jika DB offline dan ID cocok
      if (!safePatient) {
        const allPatients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
        const matched = allPatients.find((p) => p.id === s.id || (s.nik && !s.nik.startsWith("TEMP-") && p.nik === s.nik));
        if (matched) {
          safePatient = matched;
        } else {
          safePatient = {
            id: s.id,
            nik: s.nik && !s.nik.startsWith("TEMP-") ? s.nik : "",
            name: s.name || s.username || "Pasien Baru",
            mrn: "MRN-2026-BARU",
            bloodType: "O+",
            age: 0,
            gender: "L",
            emergencyContact: {
              name: "Belum Diatur",
              relation: "Keluarga",
              phone: "-",
            },
            allergies: [],
            familyMembers: [],
            lastVisit: "-",
            hasAccess: true,
            encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
            statusKyc: "PENDING",
          };
        }
      }

      setPatientData(safePatient);

      // 3. Ambil data janji temu langsung dari PostgreSQL
      try {
        const aptsRes = await getAppointmentsServerAction({ patientId: safePatient.id });
        if (aptsRes.success && aptsRes.data && aptsRes.data.length > 0) {
          const mappedApts: Appointment[] = (aptsRes.data as unknown as Array<{
            id: string;
            patientId: string;
            patient?: { name?: string; nik?: string };
            faskesId: string;
            doctorId: string;
            doctor?: { name?: string };
            poli: string;
            tanggal: Date | string;
            jam: string;
            keluhanAwal: string;
            status: string;
            consentActive?: boolean;
            consentPin?: string | null;
            triageAssessment?: {
              triaseLevel: string;
              systolic: number;
              diastolic: number;
              heartRate: number;
              temperature: number | string;
              respiratoryRate: number;
              spo2: number;
            } | null;
          }>).map((a) => ({
            id: a.id,
            pasienId: a.patientId,
            pasienNama: a.patient?.name || safePatient!.name,
            pasienNik: a.patient?.nik || safePatient!.nik,
            faskesId: a.faskesId,
            faskesNama: a.faskesId === "FAS-01" ? "RSUP Dr. Sardjito" : "Faskes Terdaftar",
            dokterId: a.doctorId,
            dokterNama: a.doctor?.name || "Dokter DPJP",
            poli: a.poli,
            tanggal: new Date(a.tanggal).toISOString().split("T")[0],
            jam: a.jam,
            keluhanAwal: a.keluhanAwal,
            status: (a.status as AppointmentStatus) || "PENDING_ARRIVAL",
            consentActive: !!a.consentActive,
            consentPin: a.consentPin || undefined,
            triaseLevel: (a.triageAssessment?.triaseLevel as TriaseLevel) || undefined,
            triaseVitals: a.triageAssessment
              ? {
                  systolic: a.triageAssessment.systolic,
                  diastolic: a.triageAssessment.diastolic,
                  heartRate: a.triageAssessment.heartRate,
                  temperature: Number(a.triageAssessment.temperature),
                  respiratoryRate: a.triageAssessment.respiratoryRate,
                  spo2: a.triageAssessment.spo2,
                }
              : undefined,
          }));
          setAppointments(mappedApts);
        } else {
          setAppointments([]);
        }
      } catch {
        setAppointments([]);
      }

      // 4. Ambil izin akses (Access Grants) langsung dari PostgreSQL
      try {
        const grantsRes = await getAccessGrantsServerAction(safePatient.id);
        if (grantsRes.success && grantsRes.data && grantsRes.data.length > 0) {
          const mappedGrants: AccessGrant[] = (grantsRes.data as unknown as Array<{
            id: string;
            patientId: string;
            entityId: string;
            entityName: string;
            entityType: string;
            scope: string;
            validUntil: Date | string;
            isRevoked: boolean;
            createdAt: Date | string;
          }>).map((g) => ({
            id: g.id,
            pasienId: g.patientId,
            pasienNama: safePatient!.name,
            entityId: g.entityId,
            entityNama: g.entityName,
            entityType: (g.entityType as "DOKTER" | "FASKES") || "DOKTER",
            scope: g.scope,
            validUntil: new Date(g.validUntil).toLocaleString("id-ID"),
            isRevoked: g.isRevoked,
            createdAt: new Date(g.createdAt).toLocaleString("id-ID"),
          }));
          setGrants(mappedGrants);
        } else {
          setGrants([]);
        }
      } catch {
        setGrants([]);
      }

      // 4. Ambil data tren tanda vital dari PostgreSQL (Permenkes 24/2022)
      try {
        const recordsRes = await getMedicalRecordsServerAction({ patientId: s.id });
        const metrics: VitalSignMetric[] = [];
        if (recordsRes.success && recordsRes.data) {
          for (const rec of recordsRes.data) {
            const rawRec = rec as unknown as { vitalSignsTrend?: Record<string, number> };
            if (rawRec.vitalSignsTrend && typeof rawRec.vitalSignsTrend === "object") {
              const trend = rawRec.vitalSignsTrend;
              if (trend.systolic && trend.diastolic) {
                metrics.unshift({
                  date: new Date(rec.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
                  systolic: Number(trend.systolic),
                  diastolic: Number(trend.diastolic),
                  heartRate: Number(trend.heartRate || 75),
                  temperature: trend.temperature ? Number(trend.temperature) : undefined,
                });
              }
            }
          }
        }
        if (metrics.length === 0) {
          metrics.push(
            { date: "10 Okt", systolic: 125, diastolic: 82, heartRate: 76, temperature: 36.6 },
            { date: "16 Okt", systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.5 },
            { date: "24 Okt", systolic: 118, diastolic: 78, heartRate: 70, temperature: 36.4 }
          );
        }
        setVitalMetrics(metrics);
      } catch {
        setVitalMetrics([
          { date: "10 Okt", systolic: 125, diastolic: 82, heartRate: 76, temperature: 36.6 },
          { date: "16 Okt", systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.5 },
          { date: "24 Okt", systolic: 118, diastolic: 78, heartRate: 70, temperature: 36.4 }
        ]);
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  if (isLoading || !session || !patientData) {
    return <DashboardSkeleton noticeText="Memuat data rekam medis dan mendekripsi profil pasien..." />;
  }

  const activeGrantsCount = grants.filter((g) => !g.isRevoked).length;
  const activeEncounter = appointments.find(
    (a) =>
      a.status === "IN_EXAMINATION" ||
      a.status === "IN_PROGRESS" ||
      a.status === "WAITING_DOCTOR"
  );

  // Penanganan Tanggungan Keluarga (Family Proxy Access - UR-P11)
  const isFamilySelected = selectedFamilyMember !== "SELF";
  const currentFamily = patientData.familyMembers?.find((f) => f.id === selectedFamilyMember);
  const displayName = isFamilySelected && currentFamily ? currentFamily.name : patientData.name;
  const displayNik = isFamilySelected && currentFamily ? currentFamily.nik : patientData.nik;
  const displayAge = isFamilySelected && currentFamily ? currentFamily.age : patientData.age;
  const allergiesList = patientData.allergies ?? [];

  return (
    <div className="space-y-8">
      {/* Notice ketika terjadi gangguan jaringan / mode offline */}
      {isOfflineMode && (
        <SkeletonDisruptionNotice message="Terdeteksi gangguan koneksi ke server pusat (Simulasi Offline). Menampilkan data lokal terenkripsi dari cache IndexedDB berdaya tahan tinggi." />
      )}

      {/* Header Selamat Datang & Family Proxy Selector (UR-P11) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Portal Rekam Medis Pribadi & Tanggungan Keluarga (UR-P11)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Halo, {displayName}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            NIK: <span className="font-mono font-bold text-slate-800">{displayNik}</span> • No. Rekam Medis:{" "}
            <span className="font-mono font-bold text-slate-800">{patientData.mrn}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Family Proxy Dropdown (UR-P11) */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Profil Pasien:</span>
            <select
              value={selectedFamilyMember}
              onChange={(e) => setSelectedFamilyMember(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="SELF">{patientData.name} (Akun Utama)</option>
              {patientData.familyMembers?.map((fam) => (
                <option key={fam.id} value={fam.id}>
                  {fam.name} ({fam.relation})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pasien/faskes"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
            >
              Cari Faskes
            </Link>
            {patientData.statusKyc === "VERIFIED" ? (
              <Link
                href="/pasien/booking"
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-300 shadow-xs transition"
              >
                Booking
              </Link>
            ) : (
              <Link
                href="/pasien/profil"
                className="px-4 py-2 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 transition flex items-center gap-1.5"
                title="Lengkapi profil e-KYC untuk membuka fitur booking dokter"
              >
                <span>🔒 Booking</span>
              </Link>
            )}
            <Link
              href="/pasien/profil"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition"
            >
              Edit Profil
            </Link>
          </div>
        </div>
      </div>

      {/* Banner Restricted Mode: Akun Terdaftar Tapi Belum Lengkap / Belum e-KYC */}
      {patientData.statusKyc !== "VERIFIED" && (
        <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400">
                FITUR MEDIS TERKUNCI (BELUM e-KYC)
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">
              Lengkapi Profil & Ajukan e-KYC NIK untuk Membuka Fitur Medis
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Akun Anda telah aktif dibuat. Demi privasi kedaulatan data medis (UU PDP & Permenkes 24/2022), fitur <strong>Booking Konsultasi</strong> dan <strong>Akses Rekam Medis Elektronik</strong> masih terkunci hingga data kependudukan NIK Anda diajukan dan diverifikasi oleh Admin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pasien/profil"
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition whitespace-nowrap"
            >
              Lengkapi Data Diri Sekarang →
            </Link>
          </div>
        </div>
      )}

      {/* Banner Sesi Pemeriksaan Aktif & PIN DPJP (UR-P10) */}
      {activeEncounter && (
        <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400">
                ACTIVE ENCOUNTER BERLANGSUNG (UR-P10)
              </span>
              <span className="text-xs font-mono font-bold text-amber-800">
                {activeEncounter.id} • {activeEncounter.poli}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">
              Pemeriksaan Sedang Ditangani oleh: {activeEncounter.dokterNama} (DPJP)
            </h3>
            <p className="text-xs text-slate-600">
              Dokter ini memegang kunci pembungkus sementara (*Session Access Key*) untuk membuka RME Anda selama sesi aktif.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-amber-300 text-center space-y-0.5 min-w-[160px]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              PIN Persetujuan Admisi
            </span>
            <p className="text-2xl font-black font-mono text-blue-700 tracking-widest">
              {activeEncounter.consentPin || "884120"}
            </p>
            <span className="text-xs text-slate-500">Tunjukkan ke Staf Nakes</span>
          </div>
        </div>
      )}

      {/* Emergency Medical Card & Critical Allergy Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Kartu Darurat Medis Nasional (Resilio ID)
              </span>
            </div>
            {patientData.statusKyc === "VERIFIED" ? (
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                KYC Terverifikasi (Dukcapil)
              </span>
            ) : (
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                e-KYC Belum Lengkap
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Golongan Darah</p>
              <p className="text-2xl font-black text-red-400 mt-0.5">{patientData.bloodType || "O+"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Usia / Gender</p>
              <p className="text-base font-bold mt-0.5">
                {displayAge > 0 ? `${displayAge} Tahun` : "Belum diisi"} ({patientData.gender === "P" ? "Perempuan" : "Laki-laki"})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Kontak Darurat</p>
              <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                {patientData.emergencyContact?.name || "Keluarga"}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {patientData.emergencyContact?.phone || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Kunci Enkripsi Klien</p>
              <p
                className="text-xs font-mono text-emerald-400 truncate mt-0.5"
                title={patientData.encryptionKeyHex}
              >
                {patientData.encryptionKeyHex ? patientData.encryptionKeyHex.slice(0, 16) : "..."}...
              </p>
              <span className="text-xs text-slate-400">Zero-Knowledge Storage</span>
            </div>
          </div>

          {/* Alert Alergi Kritis */}
          {allergiesList.length > 0 ? (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-200 text-xs">
              <div>
                <span className="font-bold uppercase tracking-wider text-red-400">
                  Peringatan Alergi Kritis:{" "}
                </span>
                <span className="font-semibold text-white">
                  {allergiesList.join(", ")}
                </span>
                <span className="block text-[10px] text-red-300 mt-0.5">
                  Ditampilkan mencolok pada stasiun kerja dokter saat Anda menjalani pemeriksaan fisik.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-medium">
              Tidak ada riwayat alergi obat berbahaya yang tercatat.
            </div>
          )}
        </div>

        {/* Status Privasi & Izin Akses */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Kedaulatan Data Medis Pasien
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Hak Akses Aktif (Consent)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Anda memegang kendali penuh atas rekam medis Anda. Dokter atau rumah sakit hanya dapat membaca rekam medis jika memiliki tiket izin aktif.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Faskes/Dokter Diizinkan:</span>
              <span className="text-sm font-black text-blue-600">{activeGrantsCount} Entitas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Pencabutan Akses (Revoke):</span>
              <span className="text-xs font-bold text-emerald-600">Didukung 1-Click</span>
            </div>
          </div>

          <Link
            href="/pasien/consent"
            className="w-full text-center py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Kelola Izin & Cabut Akses →
          </Link>
        </div>
      </div>

      {/* Grafik Tren Tanda Vital (Permenkes 24/2022) */}
      <VitalSignsTrendChart data={vitalMetrics} />

      {/* Jadwal Booking Mendatang & Aksi Cepat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Jadwal Pemeriksaan Mendatang
            </h3>
            <Link href="/pasien/booking" className="text-xs font-bold text-blue-600 hover:underline">
              Lihat Semua →
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Belum ada jadwal konsultasi dokter yang dipesan.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 3).map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-black uppercase text-blue-600">
                      {apt.poli} • {apt.faskesNama}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 mt-0.5">{apt.dokterNama}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jadwal: {apt.tanggal} pukul {apt.jam}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
                      apt.status === "IN_EXAMINATION" || apt.status === "IN_PROGRESS"
                        ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }`}
                  >
                    {apt.status === "IN_EXAMINATION" || apt.status === "IN_PROGRESS"
                      ? "Sedang Diperiksa"
                      : "Menunggu"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu Navigasi Cepat Pasien */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Menu Layanan Terintegrasi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/pasien/rekam-medis"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-red-700">
                Riwayat RME, Tensi & Rontgen
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Dekripsi riwayat rekam medis pribadi, tensi, dan citra medis.
              </p>
            </Link>

            <Link
              href="/pasien/faskes"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                Cari Faskes Pintar
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Cari klinik & RS berdasarkan keluhan penyakit atau poli.
              </p>
            </Link>

            <Link
              href="/pasien/audit-log"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
                Audit Trail Pribadi
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Transparansi siapa dan kapan data Anda dibuka (UU PDP).
              </p>
            </Link>

            <Link
              href="/pasien/tiket-kendala"
              className="p-4 rounded-2xl bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 transition group"
            >
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                Pusat Kendala & Bug
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Laporkan ketidaksesuaian data medis ke Admin Regulator.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
