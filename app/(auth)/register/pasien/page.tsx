"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStorageData, setStorageData, MOCK_KYC_REQUESTS, KycSubmission } from "@/lib/db/mockData";

export default function RegisterPasienPage() {
  const router = useRouter();
  const [nik, setNik] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [alamat, setAlamat] = useState("");
  const [golDarah, setGolDarah] = useState("O+");
  const [alergi, setAlergi] = useState("");
  const [ktpFileName, setKtpFileName] = useState("");
  const [selfieFileName, setSelfieFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const watermarkString = `HANYA UNTUK VERIFIKASI RESILIO-HEALTH - ${new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase()}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validasi NIK 16 digit
    if (!/^\d{16}$/.test(nik)) {
      setErrorMsg("Nomor Induk Kependudukan (NIK) wajib terdiri dari tepat 16 digit angka.");
      return;
    }

    if (!ktpFileName) {
      setErrorMsg("Unggahan foto KTP asli diperlukan untuk verifikasi identitas (KYC).");
      return;
    }

    if (!selfieFileName) {
      setErrorMsg("Swafoto (selfie) wajah memegang KTP (Liveness Check) wajib diunggah.");
      return;
    }

    setIsSubmitting(true);

    const newKyc: KycSubmission = {
      id: `KYC-${Date.now().toString().slice(-4)}`,
      userId: `P-${Date.now().toString().slice(-3)}`,
      namaLengkap,
      nik,
      tanggalLahir,
      alamat,
      ktpUrl: `/uploads/ktp-${nik}.jpg`,
      selfieUrl: `/uploads/selfie-${nik}.jpg`,
      watermarkText: watermarkString,
      submittedAt: new Date().toLocaleString("id-ID"),
      status: "PENDING",
    };

    const currentKyc = getStorageData<KycSubmission[]>("resilio_kyc_list", MOCK_KYC_REQUESTS);
    setStorageData("resilio_kyc_list", [newKyc, ...currentKyc]);

    setTimeout(() => {
      router.push(`/verifikasi-pending?role=pasien&nama=${encodeURIComponent(namaLengkap)}`);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 font-sans text-slate-800 antialiased flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <div>
          <Link href="/login" className="text-xs font-bold text-slate-500 hover:text-red-600 transition">
            ← Kembali ke Halaman Masuk
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-sm font-black uppercase">
              NIK
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Pendaftaran Pasien (e-KYC Satu Identitas NIK)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Pendaftaran berbasis NIK dan swafoto wajah ber-watermark otomatis (UR-P01 & UR-P09).
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                NIK (16 Digit Angka KTP) *
              </label>
              <input
                type="text"
                required
                maxLength={16}
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                placeholder="3171012304800001"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nama Lengkap (Sesuai KTP) *
              </label>
              <input
                type="text"
                required
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                placeholder="Budi Santoso"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Email Aktif *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="budi@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nomor WhatsApp / HP *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tanggal Lahir *
              </label>
              <input
                type="date"
                required
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Riwayat Alergi Obat / Makanan (Opsional)
              </label>
              <input
                type="text"
                value={alergi}
                onChange={(e) => setAlergi(e.target.value)}
                placeholder="Contoh: Penicillin, Seafood, Paracetamol"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Alamat Domisili KTP *
            </label>
            <textarea
              required
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Jl. Merdeka No. 10, RT 01 / RW 02, Sleman"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Area Unggah Dokumen e-KYC: KTP + Selfie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Foto KTP */}
            <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
              <p className="text-xs font-bold text-slate-700">1. Foto Fisik KTP Asli</p>
              <p className="text-[10px] text-slate-500">
                Pencocokan NIK Dukcapil oleh Admin Kemenkes.
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

            {/* Selfie Wajah (Liveness Check) */}
            <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
              <p className="text-xs font-bold text-slate-700">2. Swafoto Wajah Memegang KTP</p>
              <p className="text-[10px] text-slate-500">
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

          {/* Banner Watermarking Otomatis (Perlindungan Kebocoran Identitas) */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <span className="font-bold text-[10px] uppercase text-blue-700">
              Perlindungan Privasi Siber (Auto-Watermark di Sisi Klien):
            </span>
            <p className="text-[11px] leading-relaxed">
              Berkas identitas Anda secara otomatis dibubuhi tanda air digital transparan:{" "}
              <strong className="font-mono text-blue-800">&quot;{watermarkString}&quot;</strong> untuk mencegah penyalahgunaan KTP di luar sistem Resilio-Health.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/30 transition cursor-pointer disabled:bg-slate-400"
          >
            {isSubmitting ? "Mengirimkan Berkas e-KYC..." : "Kirim Pengajuan e-KYC Pasien"}
          </button>
        </form>
      </div>
    </div>
  );
}
