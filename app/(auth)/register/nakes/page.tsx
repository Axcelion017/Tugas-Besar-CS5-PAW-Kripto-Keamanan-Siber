"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RegisterNakesDbSchema } from "@/lib/validations/auth";
import { registerNakesServerAction } from "@/lib/actions/auth";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { IconCheck, IconFileText, IconShield } from "@/components/ui/Icons";

interface FaskesOption {
  id: string;
  nama: string;
  tipe: string;
  kota: string;
  status: string;
}

const SPESIALISASI_LIST = [
  "Spesialis Penyakit Dalam",
  "Spesialis Kardiologi",
  "Spesialis Anak",
  "Dokter Umum",
  "Spesialis Bedah Umum",
  "Spesialis Obstetri & Ginekologi",
  "Spesialis Saraf",
  "Dokter Gigi",
];

function formatFaskesType(tipe: string): string {
  if (tipe === "RUMAH_SAKIT") return "Rumah Sakit";
  if (tipe === "KLINIK_PRATAMA") return "Klinik Pratama";
  if (tipe === "PUSKESMAS") return "Puskesmas";
  return tipe;
}

export default function RegisterNakesPage() {
  const router = useRouter();
  const [faskesOptions, setFaskesOptions] = useState<FaskesOption[]>([]);
  const [isLoadingFaskes, setIsLoadingFaskes] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nik, setNik] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [strNumber, setStrNumber] = useState("");
  const [sipNumber, setSipNumber] = useState("");
  const [spesialisasi, setSpesialisasi] = useState(SPESIALISASI_LIST[0]);
  const [faskesId, setFaskesId] = useState("");
  const [dokumenStrFileName, setDokumenStrFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    async function loadFaskes() {
      try {
        const res = await getFaskesListServerAction();
        if (active && res.success && Array.isArray(res.data)) {
          const list = (res.data as unknown as FaskesOption[]).map((f) => ({
            id: f.id,
            nama: f.nama,
            tipe: formatFaskesType(f.tipe),
            kota: f.kota,
            status: f.status,
          }));
          setFaskesOptions(list);
          const firstActive = list.find((f) => f.status !== "QUARANTINED") || list[0];
          if (firstActive) setFaskesId(firstActive.id);
        }
      } finally {
        if (active) setIsLoadingFaskes(false);
      }
    }
    void loadFaskes();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Konfirmasi kata sandi tidak cocok. Harap periksa kembali.");
      return;
    }

    const selectedFaskes = faskesOptions.find((f) => f.id === faskesId);
    const payload = {
      username,
      email,
      password,
      nik,
      namaLengkap,
      strNumber,
      sipNumber,
      spesialisasi,
      faskesId,
      faskesNama: selectedFaskes?.nama || "",
      dokumenStrFileName,
      strDokumenUploaded: Boolean(dokumenStrFileName),
    };

    const validation = RegisterNakesDbSchema.safeParse(payload);
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || "Data pendaftaran tenaga medis tidak valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerNakesServerAction(payload);
      if (!res.success) {
        setErrorMsg(res.message);
        setIsSubmitting(false);
        return;
      }

      router.push(`/verifikasi-pending?role=nakes&nama=${encodeURIComponent(namaLengkap)}`);
    } catch {
      setErrorMsg("Terjadi kendala jaringan saat menyimpan pengajuan kredensial ke server.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 font-sans text-slate-800 antialiased flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <Link
            href="/login"
            className="text-xs font-bold text-slate-600 hover:text-red-600 transition"
          >
            ← Kembali ke Halaman Masuk
          </Link>
          <BrandLogo size="sm" />
        </div>

        {/* Heading */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <IconShield size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Pendaftaran Kredensial Tenaga Medis (e-KYD)
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Akun baru berstatus <strong>PENDING</strong> hingga Nomor STR &amp; SIP divalidasi oleh Admin Regulator Kemenkes.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bagian 1: Kredensial Akun */}
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              1. Kredensial Akun Akses
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="nakes-username"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Username Unik *
                </label>
                <input
                  id="nakes-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="cth: dr_hendra"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="nakes-email"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Email Instansi / Profesi *
                </label>
                <input
                  id="nakes-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hendra.sppd@rsup.id"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="nakes-password"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Kata Sandi *
                </label>
                <input
                  id="nakes-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="nakes-confirm-password"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Konfirmasi Kata Sandi *
                </label>
                <input
                  id="nakes-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bagian 2: Identitas & Legalitas STR/SIP */}
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              2. Identitas &amp; Lisensi Praktik (KKI / Dinkes)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nakes-nik" className="block text-xs font-bold text-slate-700 mb-1">
                  NIK (16 Digit Angka) *
                </label>
                <input
                  id="nakes-nik"
                  type="text"
                  required
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                  placeholder="3171011102830001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="nakes-nama" className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar *
                </label>
                <input
                  id="nakes-nama"
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="dr. Hendra Prasetya, Sp.PD"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="nakes-str" className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor STR (Surat Tanda Registrasi) *
                </label>
                <input
                  id="nakes-str"
                  type="text"
                  required
                  value={strNumber}
                  onChange={(e) => setStrNumber(e.target.value)}
                  placeholder="31.1.1.100.2.22.123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="nakes-sip" className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor SIP (Surat Izin Praktik) *
                </label>
                <input
                  id="nakes-sip"
                  type="text"
                  required
                  value={sipNumber}
                  onChange={(e) => setSipNumber(e.target.value)}
                  placeholder="446/SIP-D/2026/001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="nakes-spesialisasi"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Spesialisasi / Poli Pelayanan *
                </label>
                <select
                  id="nakes-spesialisasi"
                  value={spesialisasi}
                  onChange={(e) => setSpesialisasi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {SPESIALISASI_LIST.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="nakes-faskes"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Fasilitas Kesehatan Tempat Bertugas *
                </label>
                <select
                  id="nakes-faskes"
                  value={faskesId}
                  onChange={(e) => setFaskesId(e.target.value)}
                  disabled={isLoadingFaskes}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
                >
                  {isLoadingFaskes ? (
                    <option value="">Memuat daftar faskes dari server...</option>
                  ) : (
                    faskesOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nama} ({f.tipe} — {f.kota})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Bagian 3: Unggah Bukti STR & SIP */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                {dokumenStrFileName ? (
                  <IconCheck size={18} className="text-emerald-600" />
                ) : (
                  <IconFileText size={18} />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Berkas Bukti STR / SIP Resmi (PDF / Gambar) *
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {dokumenStrFileName
                    ? `Terpilih: ${dokumenStrFileName}`
                    : "Dokumen ditinjau langsung oleh Admin Regulator di konsol verifikasi e-KYD."}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <input
                type="file"
                id="strFile"
                className="sr-only"
                accept=".pdf,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setDokumenStrFileName(e.target.files[0].name);
                  }
                }}
              />
              <label
                htmlFor="strFile"
                className="inline-flex items-center px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-xs transition"
              >
                {dokumenStrFileName ? "Ganti Berkas" : "Pilih Berkas"}
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoadingFaskes || !faskesId}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:bg-slate-400"
          >
            {isSubmitting
              ? "Menyimpan Pengajuan ke PostgreSQL..."
              : "Ajukan Verifikasi Kredensial Tenaga Medis"}
          </button>
        </form>
      </div>
    </div>
  );
}
