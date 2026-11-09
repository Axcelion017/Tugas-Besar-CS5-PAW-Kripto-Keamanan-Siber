"use client";

import React from "react";

export interface PrintableRecordData {
  recordId: string;
  faskesNama: string;
  faskesAlamat?: string;
  faskesKota?: string;
  faskesKontak?: string;
  patientNama: string;
  patientNik: string;
  patientMrn: string;
  patientBirthDate?: string;
  patientAge?: number | string;
  patientGender?: string;
  patientBloodType?: string;
  penjaminBiaya?: string;
  tanggalPeriksa: string;
  poli: string;
  // Tenaga Medis
  dokterNama: string;
  dokterSpecialty?: string;
  dokterStr?: string;
  dokterSip?: string;
  perawatNama?: string;
  perawatNip?: string;
  perawatPosisi?: string;
  // Triase
  triaseLevel?: string;
  triageVitals?: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    temperature?: number;
    spo2?: number;
    respiratoryRate?: number;
    painScale?: number;
    beratBadan?: number;
    tinggiBadan?: number;
  };
  tindakanStaf?: string;
  // Klinis
  subjective?: string;
  rpsHistory?: string;
  diagnosisIcd10?: string;
  diagnosisShort: string;
  prosedurIcd9?: string;
  tindakanMedis?: string;
  prescriptions?: string[];
  catatanFarmasi?: string;
  edukasiDokter?: string;
  // Surat Medis
  suratKeteranganSakit?: {
    diberikan: boolean;
    lamaHari?: number;
    mulaiTanggal?: string;
    sampaiTanggal?: string;
  };
  suratRujukan?: {
    isRujukan: boolean;
    tujuanFaskes?: string;
    poliTujuan?: string;
    alasanRujukan?: string;
  };
  // Billing
  billing?: {
    biayaKonsultasi?: number;
    biayaTindakan?: number;
    biayaObat?: number;
    totalBiaya?: number;
    statusKlaim?: string;
  };
  // Versi & Addendum
  version: number;
  addendumReason?: string;
}

interface PrintableMedicalResumeProps {
  data: PrintableRecordData;
  onClose?: () => void;
}

export function PrintableMedicalResume({ data, onClose }: PrintableMedicalResumeProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const formattedTotal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(data.billing?.totalBiaya || 235000);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-300 overflow-hidden flex flex-col my-4 print:my-0 print:border-none print:shadow-none print:rounded-none">
        
        {/* ACTION BAR ATAS (Hanya Muncul di Layar, Tersembunyi saat Cetak) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dokumen Administratif Resume Medis Elektronik (Standar Permenkes RI No. 24/2022)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm"
            >
              Cetak / Simpan PDF
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border border-slate-700"
              >
                ✕ Tutup Dokumen
              </button>
            )}
          </div>
        </div>

        {/* DOKUMEN ADMINISTRATIF KONTINU (Format Standar Rumah Sakit Tanpa Kotak-Kotak Terpisah) */}
        <div className="p-8 md:p-12 space-y-6 text-slate-900 text-xs font-sans print:p-6 print:text-[10px] leading-relaxed">
          
          {/* 1. KOP SURAT RESMI RUMAH SAKIT */}
          <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-700 text-white rounded-xl flex items-center justify-center font-black text-xl shrink-0 print:border print:border-slate-800">
                R
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">
                  {data.faskesNama || "RSUP DR. SARDJITO YOGYAKARTA"}
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  {data.faskesAlamat || "Jl. Kesehatan No. 1, Sekip, Sleman, D.I. Yogyakarta 55284"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Telp: {data.faskesKontak || "(0274) 587333"} • Akreditasi Kemenkes RI: PARIPURNA
                </p>
              </div>
            </div>

            <div className="text-right text-[10px] font-mono space-y-0.5">
              <span className="font-bold uppercase px-2 py-0.5 bg-slate-100 border border-slate-300 rounded inline-block">
                LEMBAR REKAM MEDIS SAH
              </span>
              <p className="font-bold text-slate-900 pt-1">No. Berkas: {data.recordId}</p>
              <p className="text-slate-500">Versi Dokumen: {data.version} {data.version > 1 ? "(Addendum)" : "(Utama)"}</p>
            </div>
          </div>

          {/* 2. JUDUL DOKUMEN ADMINISTRATIF RESMI */}
          <div className="text-center py-1 border-b border-slate-300 space-y-0.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              RINGKASAN REKAM MEDIS RAWAT JALAN &amp; RESUME PELAYANAN MEDIS
            </h2>
            <p className="text-[10px] text-slate-600 font-medium">
              Lokasi Pelayanan: {data.faskesNama} • Unit / Poliklinik: {data.poli} • Waktu Periksa: {data.tanggalPeriksa}
            </p>
          </div>

          {/* 3. INFORMASI ADMINISTRATIF IDENTITAS PASIEN LENGKAP (TABEL BERKESINAMBUNGAN) */}
          <div className="space-y-1">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              I. DATA ADMINISTRATIF &amp; IDENTITAS PASIEN
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 w-44 font-semibold">Nama Lengkap Pasien</td>
                  <td className="py-1.5 pr-4 font-bold text-slate-900">: {data.patientNama}</td>
                  <td className="py-1.5 pr-4 text-slate-500 w-44 font-semibold">No. Rekam Medis (MRN)</td>
                  <td className="py-1.5 font-mono font-bold text-slate-900">: {data.patientMrn}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Nomor Induk Kependudukan (NIK)</td>
                  <td className="py-1.5 pr-4 font-mono font-semibold text-slate-800">: {data.patientNik}</td>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Jenis Kelamin / Gol. Darah</td>
                  <td className="py-1.5 font-semibold text-slate-800">: {data.patientGender === "P" ? "Perempuan" : "Laki-laki"} / {data.patientBloodType || "O+"}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Penjamin Biaya</td>
                  <td className="py-1.5 pr-4 font-bold text-emerald-800">: {data.penjaminBiaya || "BPJS Kesehatan (JKN)"}</td>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Lokasi Penyimpanan RME</td>
                  <td className="py-1.5 font-semibold text-slate-800">: Server HIS Terenkripsi W3C Web Crypto ({data.faskesNama})</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. TENAGA KESEHATAN PENANGGUNG JAWAB & PELAKSANA TRIASE */}
          <div className="space-y-1">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              II. TENAGA KESEHATAN PEMERIKSA (DPJP &amp; STAF PERAWAT)
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 w-44 font-semibold">Dokter DPJP</td>
                  <td className="py-1.5 pr-4 font-bold text-slate-900">: {data.dokterNama} ({data.dokterSpecialty || "Spesialis Penyakit Dalam"})</td>
                  <td className="py-1.5 pr-4 text-slate-500 w-44 font-semibold">Legalitas DPJP</td>
                  <td className="py-1.5 font-mono text-slate-700">: STR: {data.dokterStr || "31.1.1.100.2.22.123456"} • SIP: {data.dokterSip || "503/SIP.01/2026"}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Staf Pelaksana Triase</td>
                  <td className="py-1.5 pr-4 font-bold text-slate-900">: {data.perawatNama || "Ns. Maya Indah, S.Kep"} ({data.perawatPosisi || "Perawat Triase & Admisi"})</td>
                  <td className="py-1.5 pr-4 text-slate-500 font-semibold">Identitas Pegawai</td>
                  <td className="py-1.5 font-mono text-slate-700">: NIP: {data.perawatNip || "198804122015022001"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. PEMERIKSAAN FISIK AWAL & TRIASE KEPERAWATAN */}
          <div className="space-y-1">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              III. PENGKAJIAN TRIASE &amp; TANDA-TANDA VITAL AWAL
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 py-1 text-slate-800">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Tekanan Darah</span>
                <span className="font-bold text-xs">{data.triageVitals?.systolic || 120}/{data.triageVitals?.diastolic || 80} mmHg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Denyut Nadi</span>
                <span className="font-bold text-xs">{data.triageVitals?.heartRate || 75} bpm</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Suhu Tubuh</span>
                <span className="font-bold text-xs">{data.triageVitals?.temperature || 36.5} °C</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Saturasi Oksigen</span>
                <span className="font-bold text-xs">{data.triageVitals?.spo2 || 98}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Laju Napas</span>
                <span className="font-bold text-xs">{data.triageVitals?.respiratoryRate || 18} x/mnt</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-semibold">Klasifikasi Triase</span>
                <span className="font-bold text-xs uppercase">{data.triaseLevel || "HIJAU (Non-Urgent)"}</span>
              </div>
            </div>
            {data.tindakanStaf && (
              <p className="text-[11px] text-slate-700 pt-0.5">
                <strong className="text-slate-900">Tindakan Keperawatan Awal:</strong> {data.tindakanStaf}
              </p>
            )}
          </div>

          {/* 6. DOKUMENTASI KLINIS MEDIKOLEGAL (SOAP & DIAGNOSIS) */}
          <div className="space-y-1.5">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              IV. TELAAH KLINIS DOKTER DPJP (SOAP &amp; KODEFIKASI ICD)
            </h3>
            
            <div className="space-y-1 text-xs">
              <div>
                <strong className="text-slate-900">1. Anamnesis &amp; Riwayat Keluhan (Subjective):</strong>
                <p className="text-slate-700 pl-3 pt-0.5 leading-relaxed">{data.subjective || "Pasien datang dengan keluhan pusing dan tengkuk berat."}</p>
              </div>

              <div>
                <strong className="text-slate-900">2. Diagnosis Medis Utama &amp; Sekunder (Assessment):</strong>
                <p className="text-slate-900 font-bold pl-3 pt-0.5">
                  [{data.diagnosisIcd10 || "I10"}] {data.diagnosisShort} — <span className="font-normal text-slate-500 text-[10px]">Klasifikasi Standar WHO ICD-10</span>
                </p>
              </div>

              <div>
                <strong className="text-slate-900">3. Prosedur &amp; Tindakan Medis (Procedure ICD-9-CM):</strong>
                <p className="text-slate-800 pl-3 pt-0.5">
                  [{data.prosedurIcd9 || "89.52"}] {data.tindakanMedis || "Elektrokardiogram (EKG 12-Lead) dan Konsultasi DPJP"}
                </p>
              </div>
            </div>
          </div>

          {/* 7. TERAPI RESEP OBAT & PETUNJUK FARMASI (TABEL ADMINISTRATIF RESEP) */}
          <div className="space-y-1">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              V. RESEP OBAT DIGITAL (e-PRESCRIPTION) &amp; ANJURAN TERAPI
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[9px] uppercase">
                  <th className="py-1 pr-3 w-8">No</th>
                  <th className="py-1 pr-4">Nama Obat &amp; Dosis</th>
                  <th className="py-1 pr-4">Signa / Aturan Minum</th>
                  <th className="py-1">Keterangan Farmasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.prescriptions && data.prescriptions.length > 0 ? (
                  data.prescriptions.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 font-mono text-slate-400">{i + 1}.</td>
                      <td className="py-1.5 pr-4 font-bold text-slate-900">{r}</td>
                      <td className="py-1.5 pr-4 text-slate-700">Diminum teratur sesudah makan</td>
                      <td className="py-1.5 text-slate-600">Diserahkan dalam kemasan etiket resmi apotek</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-500 italic">Tidak ada peresepan obat tertulis.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {data.edukasiDokter && (
              <p className="text-[11px] text-slate-700 pt-1">
                <strong className="text-slate-900">Edukasi &amp; Anjuran Dokter:</strong> {data.edukasiDokter}
              </p>
            )}
          </div>

          {/* 8. SURAT KETERANGAN MEDIS & RUJUKAN (JIKA ADA) */}
          {(data.suratKeteranganSakit?.diberikan || data.suratRujukan?.isRujukan) && (
            <div className="space-y-1">
              <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                VI. KELENGKAPAN SURAT MEDIS RESMI
              </h3>
              <div className="space-y-1 pl-3 text-xs text-slate-800">
                {data.suratKeteranganSakit?.diberikan && (
                  <p>
                    • <strong>Surat Istirahat Sakit:</strong> Diberikan selama {data.suratKeteranganSakit.lamaHari || 3} hari terhitung mulai tanggal {data.suratKeteranganSakit.mulaiTanggal || data.tanggalPeriksa}.
                  </p>
                )}
                {data.suratRujukan?.isRujukan && (
                  <p>
                    • <strong>Surat Rujukan Faskes:</strong> Dirujuk ke {data.suratRujukan.tujuanFaskes || "RS Harapan Sehat"} dengan alasan klinis: &quot;{data.suratRujukan.alasanRujukan}&quot;.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 9. RINCIAN BIAYA & STATUS KLAIM PENJAMIN (BILLING RESMI) */}
          <div className="space-y-1">
            <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              VII. RINCIAN BIAYA PELAYANAN (BILLING ADMINISTRATIF)
            </h3>
            <div className="flex flex-wrap justify-between items-center text-xs py-1">
              <span>Konsultasi DPJP: <strong>Rp 100.000</strong></span>
              <span>Tindakan Prosedur: <strong>Rp 50.000</strong></span>
              <span>Farmasi &amp; Obat: <strong>Rp 85.000</strong></span>
              <span className="font-black text-slate-900">Total Tagihan: {formattedTotal}</span>
            </div>
            <p className="text-[10px] text-emerald-800 font-bold">
              Status Klaim: {data.billing?.statusKlaim || "DITANGGUNG PENUH OLEH JKN BPJS KESEHATAN (KLAIM INA-CBG)"}
            </p>
          </div>

          {/* 10. BLOK PENGESAHAN & TANDA TANGAN RESMI */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Tenaga Medis Pelaksana Triase,</p>
              <div className="h-14 flex items-end justify-center">
                <span className="font-mono text-[9px] text-slate-400 italic">[Tanda Tangan Terverifikasi Log HIS]</span>
              </div>
              <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mt-1">
                {data.perawatNama || "Ns. Maya Indah, S.Kep"}
              </p>
              <p className="text-[9px] font-mono text-slate-500">NIP. {data.perawatNip || "198804122015022001"}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500 uppercase">Dokter Penanggung Jawab Pelayanan (DPJP),</p>
              <div className="h-14 flex items-end justify-center">
                <span className="font-mono text-[9px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  DISETUJUI &amp; DITANDATANGANI SECARA DIGITAL (W3C CRYPTO)
                </span>
              </div>
              <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mt-1">
                {data.dokterNama}
              </p>
              <p className="text-[9px] font-mono text-slate-500">SIP: {data.dokterSip || "503/SIP.01/2026"} • STR: {data.dokterStr || "31.1.1.100.2.22.123456"}</p>
            </div>
          </div>

          {/* CATATAN MEDIKOLEGAL KAKI DOKUMEN */}
          <div className="pt-2 text-[9px] text-slate-400 text-center font-mono border-t border-slate-200">
            Dokumen rekam medis elektronik ini sah dan berkekuatan hukum sesuai UU ITE No. 1/2024, UU Kesehatan No. 17/2023, dan Permenkes RI No. 24/2022.
          </div>
        </div>

        {/* ACTION BAR BAWAH (Hanya Muncul di Layar) */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500">
            Gunakan tombol <strong>Cetak / Simpan PDF</strong> untuk mencetak lembar resume pelayanan standar rumah sakit.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
            >
              Cetak / Simpan PDF
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                ✕ Tutup Dokumen
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
