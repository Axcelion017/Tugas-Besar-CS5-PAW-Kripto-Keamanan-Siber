"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  FamilyMemberDto,
  getPatientProfileServerAction,
  updatePatientProfileServerAction,
  submitKycVerificationServerAction,
} from "@/lib/actions/auth";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { ToastBanner } from "@/components/ui/ToastBanner";
import { FamilyMemberManager } from "@/features/auth/FamilyMemberManager";
import { IconUsers, IconShield, IconFileText } from "@/components/ui/Icons";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

type ProfileTab = "MANDIRI" | "KELUARGA" | "KYC";

function getLocalTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function PasienProfilContent() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const initialTab: ProfileTab =
    initialTabParam === "keluarga" ? "KELUARGA" : initialTabParam === "kyc" ? "KYC" : "MANDIRI";

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const [statusKyc, setStatusKyc] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [mrn, setMrn] = useState("");
  const [patientId, setPatientId] = useState("");
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberDto[]>([]);
  const todayIso = getLocalTodayIso();

  // Bagian 1: Data Mandiri Pemilik Akun
  const [phone, setPhone] = useState("");
  const [alamat, setAlamat] = useState("");
  const [golDarah, setGolDarah] = useState("O+");
  const [alergi, setAlergi] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("Keluarga");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Bagian 2: Data Sensitif e-KYC Pemilik Akun
  const [nik, setNik] = useState("");
  const [namaKtp, setNamaKtp] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("1995-01-01");
  const [ktpFileName, setKtpFileName] = useState("");
  const [selfieFileName, setSelfieFileName] = useState("");

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const watermarkString = `HANYA UNTUK VERIFIKASI JAGAMEDIS - ${new Date().toLocaleDateString("id-ID")}`;

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const s = getUserSession();
      if (!s) {
        if (active) setIsLoading(false);
        return;
      }
      if (active) setSession(s);

      try {
        const res = await getPatientProfileServerAction(s.id);
        if (active && res.success && res.data?.patient) {
          const p = res.data.patient;
          setPatientId(p.id);
          setMrn(p.mrn);
          const latestKyc = res.data.latestKyc;
          if (res.data.statusAccount === "VERIFIED") {
            setStatusKyc("VERIFIED");
            setRejectionReason(null);
          } else if (res.data.statusAccount === "REJECTED" || latestKyc?.status === "REJECTED") {
            setStatusKyc("REJECTED");
            setRejectionReason(latestKyc?.alasanPenolakan || null);
          } else {
            setStatusKyc("PENDING");
            setRejectionReason(null);
          }

          setPhone(p.emergencyContactPhone || s.phone || "");
          setGolDarah(p.bloodType || "O+");
          setAlergi(p.allergies?.join(", ") || "");
          setEmergencyName(p.emergencyContactName || "");
          setEmergencyRelation(p.emergencyContactRelation || "Keluarga");
          setEmergencyPhone(p.emergencyContactPhone || "");

          const isTemp = p.nik.startsWith("TEMP-");
          setNik(isTemp ? "" : p.nik);
          setNamaKtp(p.name);
          if (p.birthDate) {
            setTanggalLahir(new Date(p.birthDate).toISOString().split("T")[0]);
          }

          const rawFamily = (p.familyMembers || []) as Array<{
            id: string;
            name: string;
            nik: string;
            relation: string;
            birthDate: Date | string;
          }>;
          setFamilyMembers(
            rawFamily.map((f) => ({
              id: f.id,
              name: f.name,
              nik: f.nik,
              relation: (f.relation as FamilyMemberDto["relation"]) || "Anak",
              birthDate: new Date(f.birthDate).toISOString().split("T")[0],
            }))
          );
        }
      } catch (e) {
        console.warn("Load profile error:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    if (!patientId) return;

    setIsSubmittingContact(true);
    try {
      const res = await updatePatientProfileServerAction(patientId, {
        phone,
        bloodType: golDarah,
        allergies: alergi
          ? alergi
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        emergencyContactName: emergencyName,
        emergencyContactRelation: emergencyRelation,
        emergencyContactPhone: emergencyPhone,
      });

      setToast({
        type: res.success ? "success" : "error",
        text: res.success
          ? "Data kontak dan biodata mandiri berhasil disimpan."
          : res.message,
      });
    } catch {
      setToast({ type: "error", text: "Terjadi kendala saat memperbarui data mandiri." });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    if (!session || !patientId) return;

    if (!/^\d{16}$/.test(nik)) {
      setToast({ type: "error", text: "NIK wajib terdiri dari tepat 16 digit angka kependudukan." });
      return;
    }

    if (!ktpFileName || !selfieFileName) {
      setToast({
        type: "error",
        text: "Berkas foto KTP asli dan swafoto wajah (selfie) wajib dipilih sebelum mengajukan e-KYC.",
      });
      return;
    }

    setIsSubmittingKyc(true);
    try {
      const res = await submitKycVerificationServerAction({
        userId: session.id,
        patientId,
        nik,
        namaLengkap: namaKtp,
        tanggalLahir,
        alamat: alamat || "Alamat domisili terdaftar",
        ktpUrl: `/uploads/ktp-${nik}.jpg`,
        selfieUrl: `/uploads/selfie-${nik}.jpg`,
        watermarkText: watermarkString,
      });

      setToast({
        type: res.success ? "success" : "error",
        text: res.success
          ? "Pengajuan verifikasi e-KYC NIK berhasil dikirim ke Admin Kemenkes."
          : res.message,
      });
    } catch {
      setToast({ type: "error", text: "Terjadi kendala saat mengirimkan pengajuan e-KYC." });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  if (isLoading || !session) {
    return <DashboardSkeleton noticeText="Memuat data profil & anggota keluarga..." />;
  }

  const isVerified = statusKyc === "VERIFIED";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Portal Pasien", href: "/pasien" },
          { label: "Profil, Anggota Keluarga & e-KYC" },
        ]}
      />

      {/* Header Identitas Pemilik Akun */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {mrn || "MRN-2026-0000"}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {familyMembers.length} Anggota Keluarga Terdaftar
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {namaKtp || session.name}
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Kelola biodata pemilik akun, perbarui profil anggota keluarga tanggungan (Family Proxy), dan status verifikasi e-KYC.
          </p>
        </div>

        <div className="shrink-0">
          {isVerified ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              e-KYC Terverifikasi
            </span>
          ) : statusKyc === "REJECTED" ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              e-KYC Ditolak
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none" />
              Menunggu Verifikasi
            </span>
          )}
        </div>
      </div>

      {statusKyc === "REJECTED" && rejectionReason && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold">
          Alasan Penolakan e-KYC Sebelumnya: {rejectionReason}
        </div>
      )}

      {/* Navigasi Tab 3 Bagian */}
      <div
        role="tablist"
        aria-label="Bagian pengaturan profil pasien"
        className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "MANDIRI"}
          onClick={() => setActiveTab("MANDIRI")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "MANDIRI"
              ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <IconFileText size={15} />
          <span>Data Diri & Kontak</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "KELUARGA"}
          onClick={() => setActiveTab("KELUARGA")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "KELUARGA"
              ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <IconUsers size={15} />
          <span>Anggota Keluarga ({familyMembers.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "KYC"}
          onClick={() => setActiveTab("KYC")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "KYC"
              ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <IconShield size={15} />
          <span>Verifikasi Identitas e-KYC</span>
        </button>
      </div>

      {/* TAB 1: DATA MANDIRI PEMILIK AKUN */}
      {activeTab === "MANDIRI" && (
        <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Biodata Mandiri & Kontak Darurat Pemilik Akun
              </h2>
              <p className="text-xs text-slate-500">
                Dapat diubah langsung kapan saja tanpa memerlukan persetujuan ulang Admin.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
              Pembaruan Langsung
            </span>
          </div>

          <form onSubmit={handleSaveContact} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profil-phone" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Nomor WhatsApp / HP
                </label>
                <input
                  id="profil-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profil-goldarah" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Golongan Darah
                </label>
                <select
                  id="profil-goldarah"
                  value={golDarah}
                  onChange={(e) => setGolDarah(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="profil-alergi" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Riwayat Alergi Obat & Makanan
              </label>
              <input
                id="profil-alergi"
                type="text"
                value={alergi}
                onChange={(e) => setAlergi(e.target.value)}
                placeholder="Contoh: Penicillin, Seafood, Paracetamol (pisahkan dengan koma)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Digunakan sistem untuk memunculkan peringatan kontraindikasi resep di ruang periksa dokter.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Kontak Darurat Keluarga (IGD)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="emg-name" className="block text-xs font-bold text-slate-600 mb-1">
                    Nama Kontak
                  </label>
                  <input
                    id="emg-name"
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Nama wali / keluarga"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="emg-rel" className="block text-xs font-bold text-slate-600 mb-1">
                    Hubungan
                  </label>
                  <input
                    id="emg-rel"
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    placeholder="Pasangan / Orang Tua"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="emg-phone" className="block text-xs font-bold text-slate-600 mb-1">
                    Nomor HP Darurat
                  </label>
                  <input
                    id="emg-phone"
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="0812000000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingContact}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:bg-slate-400"
              >
                {isSubmittingContact ? "Menyimpan..." : "Simpan Data Mandiri"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: KELOLA ANGGOTA KELUARGA (FAMILY PROXY) */}
      {activeTab === "KELUARGA" && (
        <FamilyMemberManager
          members={familyMembers}
          todayIso={todayIso}
          onMembersChange={setFamilyMembers}
          onNotify={(type, text) => setToast({ type, text })}
        />
      )}

      {/* TAB 3: VERIFIKASI IDENTITAS RESMI e-KYC */}
      {activeTab === "KYC" && (
        <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Identitas Kependudukan Resmi (e-KYC NIK)
              </h2>
              <p className="text-xs text-slate-500">
                Perubahan data identitas KTP membutuhkan peninjauan dokumen resmi oleh Admin Regulator.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border self-start sm:self-auto ${
                isVerified
                  ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                  : "text-amber-800 bg-amber-50 border-amber-200"
              }`}
            >
              {isVerified ? "Data Terkunci Resmi" : "Perlu Verifikasi"}
            </span>
          </div>

          {isVerified ? (
            <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-4">
              <h3 className="text-emerald-900 font-black text-sm">
                Identitas Kependudukan Terverifikasi Satu Data Kesehatan
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Nomor NIK Resmi</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{nik || "-"}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Nama Lengkap KTP</span>
                  <span className="font-bold text-slate-900 text-sm">{namaKtp || "-"}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Tanggal Lahir</span>
                  <span className="font-bold text-slate-900 text-sm">{tanggalLahir || "-"}</span>
                </div>
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                Untuk menjaga keamanan medikolegal, perubahan identitas KTP terverifikasi hanya dapat diproses melalui verifikasi ulang loket faskes atau tiket kendala resmi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitKyc} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kyc-nik" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Nomor Induk Kependudukan (16 Digit) *
                  </label>
                  <input
                    id="kyc-nik"
                    type="text"
                    required
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                    placeholder="3171012304800001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="kyc-nama" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Nama Lengkap Sesuai KTP *
                  </label>
                  <input
                    id="kyc-nama"
                    type="text"
                    required
                    value={namaKtp}
                    onChange={(e) => setNamaKtp(e.target.value)}
                    placeholder="Nama persis di KTP asli"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kyc-lahir" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Tanggal Lahir KTP *
                  </label>
                  <input
                    id="kyc-lahir"
                    type="date"
                    required
                    max={todayIso}
                    value={tanggalLahir}
                    onChange={(e) => setTanggalLahir(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="kyc-alamat" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Alamat Domisili KTP *
                  </label>
                  <input
                    id="kyc-alamat"
                    type="text"
                    required
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Jl. Merdeka No. 45 Sleman"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">1. Foto Fisik KTP Asli *</p>
                  <input
                    type="file"
                    id="ktpFile"
                    className="sr-only"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) setKtpFileName(e.target.files[0].name);
                    }}
                  />
                  <label
                    htmlFor="ktpFile"
                    className="inline-block px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-2xs transition"
                  >
                    {ktpFileName ? `KTP: ${ktpFileName}` : "Pilih Berkas KTP"}
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">2. Swafoto Wajah (Selfie) *</p>
                  <input
                    type="file"
                    id="selfieFile"
                    className="sr-only"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) setSelfieFileName(e.target.files[0].name);
                    }}
                  />
                  <label
                    htmlFor="selfieFile"
                    className="inline-block px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-2xs transition"
                  >
                    {selfieFileName ? `Swafoto: ${selfieFileName}` : "Pilih Swafoto Wajah"}
                  </label>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <strong className="uppercase text-blue-800">Auto-Watermark Digital:</strong>{" "}
                Dokumen otomatis dibubuhi tanda air transparan{" "}
                <span className="font-mono font-bold">&quot;{watermarkString}&quot;</span> sebelum dikirim.
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingKyc}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:bg-slate-400"
                >
                  {isSubmittingKyc ? "Mengirim Pengajuan..." : "Ajukan Verifikasi e-KYC"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <ToastBanner
        message={toast?.text || null}
        type={toast?.type === "error" ? "error" : "success"}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

export default function PasienProfilPage() {
  return (
    <Suspense fallback={<DashboardSkeleton noticeText="Memuat data profil & anggota keluarga..." />}>
      <PasienProfilContent />
    </Suspense>
  );
}
