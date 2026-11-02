"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  getPatientProfileServerAction,
  updatePatientProfileServerAction,
  submitKycVerificationServerAction,
} from "@/lib/actions/auth";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

export default function PasienProfilPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Status e-KYC
  const [statusKyc, setStatusKyc] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [mrn, setMrn] = useState("");
  const [patientId, setPatientId] = useState("");

  // Bagian 1: Data Mandiri (Bisa diubah sendiri)
  const [phone, setPhone] = useState("");
  const [alamat, setAlamat] = useState("");
  const [golDarah, setGolDarah] = useState("O+");
  const [alergi, setAlergi] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("Keluarga");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Bagian 2: Data Sensitif (e-KYC)
  const [nik, setNik] = useState("");
  const [namaKtp, setNamaKtp] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("1995-01-01");
  const [ktpFileName, setKtpFileName] = useState("");
  const [selfieFileName, setSelfieFileName] = useState("");

  // Notifikasi
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);

  const watermarkString = `HANYA UNTUK VERIFIKASI RESILIO-HEALTH - ${new Date().toLocaleDateString("id-ID")}`;

  useEffect(() => {
    async function loadProfile() {
      const s = getUserSession();
      if (!s) {
        setIsLoading(false);
        return;
      }
      setSession(s);

      try {
        const res = await getPatientProfileServerAction(s.id);
        if (res.success && res.data?.patient) {
          const p = res.data.patient;
          setPatientId(p.id);
          setMrn(p.mrn);
          setStatusKyc(res.data.statusAccount === "VERIFIED" ? "VERIFIED" : "PENDING");

          // Data mandiri
          setPhone(p.emergencyContactPhone || s.phone || "");
          setGolDarah(p.bloodType || "O+");
          setAlergi(p.allergies?.join(", ") || "");
          setEmergencyName(p.emergencyContactName || "");
          setEmergencyRelation(p.emergencyContactRelation || "Keluarga");
          setEmergencyPhone(p.emergencyContactPhone || "");

          // Data sensitif
          const isTemp = p.nik.startsWith("TEMP-");
          setNik(isTemp ? "" : p.nik);
          setNamaKtp(p.name);
          if (p.birthDate) {
            setTanggalLahir(new Date(p.birthDate).toISOString().split("T")[0]);
          }
        }
      } catch (e) {
        console.warn("Load profile error:", e);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  // Handler Simpan Data Mandiri
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSuccess(null);
    setNotifError(null);
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

      if (res.success) {
        setNotifSuccess("Data kontak dan biodata mandiri berhasil disimpan ke basis data.");
      } else {
        setNotifError(res.message);
      }
    } catch {
      setNotifError("Terjadi kendala saat memperbarui data mandiri.");
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Handler Pengajuan Data Sensitif e-KYC
  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSuccess(null);
    setNotifError(null);

    if (!session || !patientId) return;

    if (!/^\d{16}$/.test(nik)) {
      setNotifError("NIK wajib terdiri dari tepat 16 digit angka kependudukan.");
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

      if (res.success) {
        setNotifSuccess("Pengajuan verifikasi e-KYC NIK berhasil dikirim ke Admin Kemenkes. Menunggu persetujuan.");
      } else {
        setNotifError(res.message);
      }
    } catch {
      setNotifError("Terjadi kendala saat mengirimkan pengajuan e-KYC.");
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  if (isLoading || !session) {
    return <DashboardSkeleton noticeText="Memuat data profil pasien..." />;
  }

  const isVerified = statusKyc === "VERIFIED";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
        <Link href="/pasien" className="hover:underline">
          Portal Pasien
        </Link>
        <span>/</span>
        <span>Edit Data Diri & Verifikasi e-KYC</span>
      </div>

      {/* Header Info */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            No. Rekam Medis: {mrn || "MRN-2026-0000"}
          </span>
          <h1 className="text-xl font-black text-slate-900 mt-2">
            Kelola Profil Pasien & Identitas Resmi
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Ubah data kontak mandiri kapan saja atau ajukan verifikasi e-KYC Satu Data Kemenkes.
          </p>
        </div>

        <div>
          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              e-KYC Terverifikasi Resmi
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Menunggu Verifikasi e-KYC
            </span>
          )}
        </div>
      </div>

      {/* Notifikasi Banner */}
      {notifSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {notifSuccess}
        </div>
      )}
      {notifError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
          {notifError}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BAGIAN 1: DATA MANDIRI (Dapat diubah sendiri kapan saja) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">
              1. Data Diri Mandiri (Kontak, Alergi & Domisili)
            </h2>
            <p className="text-xs text-slate-500">
              Data ini dapat Anda ubah dan simpan langsung ke database tanpa perlu persetujuan Admin.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Dapat Diedit Langsung
          </span>
        </div>

        <form onSubmit={handleSaveContact} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nomor WhatsApp / HP
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Golongan Darah
              </label>
              <select
                value={golDarah}
                onChange={(e) => setGolDarah(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                <option value="O+">O+</option>
                <option value="A+">A+</option>
                <option value="B+">B+</option>
                <option value="AB+">AB+</option>
                <option value="O-">O-</option>
                <option value="A-">A-</option>
                <option value="B-">B-</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Riwayat Alergi Obat & Makanan
            </label>
            <input
              type="text"
              value={alergi}
              onChange={(e) => setAlergi(e.target.value)}
              placeholder="Contoh: Penicillin, Seafood, Paracetamol (pisahkan dengan koma)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              Data alergi sangat penting untuk memicu peringatan semantik UR-T10 di stasiun kerja dokter.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase">Kontak Darurat Keluarga</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nama Kontak
                </label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Nama wali / keluarga"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Hubungan Keluarga
                </label>
                <input
                  type="text"
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                  placeholder="Pasangan / Orang Tua"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nomor HP Darurat
                </label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="0812000000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-xs bg-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingContact}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:bg-slate-400"
          >
            {isSubmittingContact ? "Menyimpan ke DB..." : "Simpan Data Mandiri"}
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* BAGIAN 2: DATA SENSITIF & IDENTITAS RESMI (e-KYC KEMENKES) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">
              2. Data Sensitif & Verifikasi Identitas Resmi (e-KYC NIK)
            </h2>
            <p className="text-xs text-slate-500">
              Data identitas kependudukan ini membutuhkan peninjauan dokumen resmi oleh Admin Kemenkes.
            </p>
          </div>
          {isVerified ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Data Terkunci Resmi
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Perlu Pengajuan
            </span>
          )}
        </div>

        {isVerified ? (
          <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <span>Identitas Kependudukan Resmi Terverifikasi</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-bold block text-xs uppercase">Nomor NIK Resmi</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{nik || "-"}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-xs uppercase">Nama Lengkap KTP</span>
                <span className="font-bold text-slate-900 text-sm">{namaKtp || "-"}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-xs uppercase">Tanggal Lahir</span>
                <span className="font-bold text-slate-900 text-sm">{tanggalLahir || "-"}</span>
              </div>
            </div>
            <p className="text-xs text-emerald-700 font-medium pt-1">
              Data kependudukan telah terikat dengan sistem Satu Data Kesehatan Kemenkes dan tidak dapat diubah sembarangan tanpa surat pengantar resmi faskes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitKyc} className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <span className="font-black text-xs uppercase text-amber-800">
                Lengkapi e-KYC untuk Membuka Fitur Medis:
              </span>
              <p className="text-xs leading-relaxed">
                Fitur <strong>Booking Konsultasi Dokter</strong> dan <strong>Akses Rekam Medis Terenkripsi</strong> akan otomatis terbuka begitu pengajuan e-KYC NIK ini disetujui oleh Admin.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Nomor Induk Kependudukan (NIK 16 Digit) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                  placeholder="3171012304800001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Nama Lengkap Sesuai KTP *
                </label>
                <input
                  type="text"
                  required
                  value={namaKtp}
                  onChange={(e) => setNamaKtp(e.target.value)}
                  placeholder="Nama persis di KTP asli"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tanggal Lahir KTP *
                </label>
                <input
                  type="date"
                  required
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Alamat Domisili KTP *
                </label>
                <input
                  type="text"
                  required
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Jl. Merdeka No. 45 Sleman"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Area Unggah Dokumen KTP + Selfie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">1. Foto Fisik KTP Asli *</p>
                <p className="text-xs text-slate-500">
                  Untuk pencocokan NIK Dukcapil oleh Admin Kemenkes.
                </p>
                <input
                  type="file"
                  id="ktpFile"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setKtpFileName(e.target.files[0].name);
                    }
                  }}
                />
                <label
                  htmlFor="ktpFile"
                  className="inline-block px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-xs transition"
                >
                  {ktpFileName ? `KTP: ${ktpFileName}` : "Pilih Berkas KTP"}
                </label>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">2. Swafoto Wajah (Selfie) *</p>
                <p className="text-xs text-slate-500">
                  Liveness check membuktikan Anda adalah pemilik sah KTP.
                </p>
                <input
                  type="file"
                  id="selfieFile"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelfieFileName(e.target.files[0].name);
                    }
                  }}
                />
                <label
                  htmlFor="selfieFile"
                  className="inline-block px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-xs transition"
                >
                  {selfieFileName ? `Swafoto: ${selfieFileName}` : "Pilih Swafoto Wajah"}
                </label>
              </div>
            </div>

            {/* Banner Auto-watermarking */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <span className="font-bold text-xs uppercase text-blue-700">
                Perlindungan Privasi Siber (Auto-Watermark Digital):
              </span>
              <p className="text-xs leading-relaxed">
                Dokumen Anda otomatis diberi tanda air transparan: <strong className="font-mono text-blue-800">&quot;{watermarkString}&quot;</strong> guna mencegah penyalahgunaan KTP di luar sistem Resilio-Health.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmittingKyc}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-purple-600/30 cursor-pointer disabled:bg-slate-400"
            >
              {isSubmittingKyc ? "Mengirimkan Pengajuan..." : "Kirim Pengajuan e-KYC NIK ke Kemenkes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
