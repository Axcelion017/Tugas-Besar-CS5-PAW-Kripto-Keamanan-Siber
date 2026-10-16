"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStorageData, setStorageData, MOCK_KYD_REQUESTS, KydSubmission, MOCK_FASKES } from "@/lib/db/mockData";

export default function RegisterNakesPage() {
  const router = useRouter();
  const [nik, setNik] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [strNumber, setStrNumber] = useState("");
  const [sipNumber, setSipNumber] = useState("");
  const [spesialisasi, setSpesialisasi] = useState("Spesialis Penyakit Dalam");
  const [faskesNama, setFaskesNama] = useState("RSUP Dr. Sardjito");
  const [dokumenStrFileName, setDokumenStrFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!/^\d{16}$/.test(nik)) {
      setErrorMsg("NIK wajib terdiri dari tepat 16 digit angka.");
      return;
    }

    if (!strNumber.trim() || !sipNumber.trim()) {
      setErrorMsg("Nomor STR dan SIP dokter/nakes wajib diisi.");
      return;
    }

    if (!dokumenStrFileName) {
      setErrorMsg("Dokumen bukti STR / SIP resmi wajib diunggah.");
      return;
    }

    setIsSubmitting(true);

    const newKyd: KydSubmission = {
      id: `KYD-${Date.now().toString().slice(-4)}`,
      userId: `DOC-${Date.now().toString().slice(-3)}`,
      namaLengkap,
      nik,
      strNumber,
      sipNumber,
      spesialisasi,
      faskesNama,
      dokumenStrUrl: `/uploads/str-${strNumber}.pdf`,
      submittedAt: new Date().toLocaleString("id-ID"),
      status: "PENDING",
    };

    const currentKyd = getStorageData<KydSubmission[]>("resilio_kyd_list", MOCK_KYD_REQUESTS);
    setStorageData("resilio_kyd_list", [newKyd, ...currentKyd]);

    setTimeout(() => {
      router.push(`/verifikasi-pending?role=nakes&nama=${encodeURIComponent(namaLengkap)}`);
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
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center text-sm font-black uppercase">
              STR
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Pendaftaran Kredensial Tenaga Medis (KYD)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Pendaftaran dokter dan perawat dengan validasi STR & SIP resmi Kemenkes.
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
                NIK (16 Digit Angka) *
              </label>
              <input
                type="text"
                required
                maxLength={16}
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                placeholder="3171011102830001"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nama Lengkap & Gelar *
              </label>
              <input
                type="text"
                required
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                placeholder="dr. Hendra Prasetya, Sp.PD"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nomor STR (Surat Tanda Registrasi) *
              </label>
              <input
                type="text"
                required
                value={strNumber}
                onChange={(e) => setStrNumber(e.target.value)}
                placeholder="31.1.1.100.2.22.123456"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nomor SIP (Surat Izin Praktik) *
              </label>
              <input
                type="text"
                required
                value={sipNumber}
                onChange={(e) => setSipNumber(e.target.value)}
                placeholder="446/SIP-D/2023/001"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Spesialisasi / Poli Pelayanan
              </label>
              <select
                value={spesialisasi}
                onChange={(e) => setSpesialisasi(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                <option value="Spesialis Penyakit Dalam">Spesialis Penyakit Dalam</option>
                <option value="Spesialis Kardiologi">Spesialis Kardiologi</option>
                <option value="Spesialis Anak">Spesialis Anak</option>
                <option value="Dokter Umum">Dokter Umum</option>
                <option value="Spesialis Bedah Umum">Spesialis Bedah Umum</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Fasilitas Kesehatan Tempat Bertugas
              </label>
              <select
                value={faskesNama}
                onChange={(e) => setFaskesNama(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white"
              >
                {MOCK_FASKES.map((f) => (
                  <option key={f.id} value={f.nama}>
                    {f.nama} ({f.tipe})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Upload Bukti STR & SIP */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">Unggah Dokumen STR / SIP Resmi (PDF)</p>
            <p className="text-[11px] text-slate-500">
              Dokumen akan diverifikasi oleh Admin Regulator sebelum akun diberi wewenang menulis rekam medis.
            </p>
            <input
              type="file"
              id="strFile"
              className="hidden"
              accept=".pdf,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setDokumenStrFileName(e.target.files[0].name);
                }
              }}
            />
            <label
              htmlFor="strFile"
              className="inline-block px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer shadow-xs transition"
            >
              {dokumenStrFileName ? `Terpilih: ${dokumenStrFileName}` : "Pilih Berkas Dokumen"}
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition cursor-pointer disabled:bg-slate-400"
          >
            {isSubmitting ? "Mendaftarkan Kredensial..." : "Ajukan Verifikasi Kredensial Tenaga Medis"}
          </button>
        </form>
      </div>
    </div>
  );
}
