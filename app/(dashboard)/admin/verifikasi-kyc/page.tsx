"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_KYC_REQUESTS,
  MOCK_PATIENTS,
  getStorageData,
  setStorageData,
  KycSubmission,
  Patient,
} from "@/lib/db/mockData";

export default function VerifikasiKycPage() {
  const [kycList, setKycList] = useState<KycSubmission[]>([]);
  const [selectedKyc, setSelectedKyc] = useState<KycSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

  const loadKyc = () => {
    const list = getStorageData<KycSubmission[]>("resilio_kyc_list", MOCK_KYC_REQUESTS);
    setKycList(list);
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleApprove = (item: KycSubmission) => {
    const all = getStorageData<KycSubmission[]>("resilio_kyc_list", MOCK_KYC_REQUESTS);
    const updated = all.map((k) =>
      k.id === item.id ? { ...k, status: "VERIFIED" as const } : k
    );
    setStorageData("resilio_kyc_list", updated);

    // Aktifkan atau tambahkan ke daftar pasien resmi
    const patients = getStorageData<Patient[]>("resilio_patients", MOCK_PATIENTS);
    const existing = patients.find((p) => p.nik === item.nik);
    if (existing) {
      const updatedPts = patients.map((p) =>
        p.nik === item.nik ? { ...p, statusKyc: "VERIFIED" as const } : p
      );
      setStorageData("resilio_patients", updatedPts);
    } else {
      const newPatient: Patient = {
        id: item.userId,
        nik: item.nik,
        name: item.namaLengkap,
        age: 30,
        gender: "L",
        mrn: `MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        bloodType: "O+",
        allergies: [],
        emergencyContact: { name: "Keluarga", relation: "Keluarga", phone: "0812000000" },
        lastVisit: "-",
        hasAccess: true,
        encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
        statusKyc: "VERIFIED",
      };
      setStorageData("resilio_patients", [newPatient, ...patients]);
    }

    setKycList(updated);
    setNotif(`KYC untuk ${item.namaLengkap} (NIK: ${item.nik}) berhasil disetujui. Akun pasien telah aktif.`);
    setTimeout(() => setNotif(null), 4000);
  };

  const handleReject = () => {
    if (!selectedKyc) return;
    const all = getStorageData<KycSubmission[]>("resilio_kyc_list", MOCK_KYC_REQUESTS);
    const updated = all.map((k) =>
      k.id === selectedKyc.id
        ? { ...k, status: "REJECTED" as const, alasanPenolakan: rejectReason || "Data NIK tidak sesuai KTP" }
        : k
    );
    setStorageData("resilio_kyc_list", updated);
    setKycList(updated);
    setShowRejectModal(false);
    setRejectReason("");
    setNotif(`Pengajuan KYC ${selectedKyc.namaLengkap} ditolak.`);
    setTimeout(() => setNotif(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
          <Link href="/admin" className="hover:underline">
            Konsol Admin
          </Link>
          <span>/</span>
          <span>Verifikasi Dokumen Kependudukan (UR-A01)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Antrean Verifikasi Identitas Pasien (KYC - NIK & KTP)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Mencegah pembuatan akun fiktif dan memastikan 1 NIK terhubung ke 1 Rekam Medis Nasional terenkripsi.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Tabel Pengajuan */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Daftar Berkas Pendaftaran Pasien Baru
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            {kycList.filter((k) => k.status === "PENDING").length} Menunggu Verifikasi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Tanggal Pengajuan</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4">NIK (Kependudukan)</th>
                <th className="p-4">Alamat Domisili</th>
                <th className="p-4">Berkas KTP</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kycList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4 text-slate-500">{item.submittedAt}</td>
                  <td className="p-4 font-bold text-slate-900">{item.namaLengkap}</td>
                  <td className="p-4 font-mono font-bold text-blue-700">{item.nik}</td>
                  <td className="p-4 text-slate-600 max-w-xs">{item.alamat}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700">
                      Foto_KTP_{item.nik.slice(-4)}.jpg
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                        item.status === "PENDING"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : item.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {item.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(item)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => {
                            setSelectedKyc(item);
                            setShowRejectModal(true);
                          }}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold italic">
                        {item.status === "VERIFIED" ? "Disetujui" : `Ditolak: ${item.alasanPenolakan || "-"}`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Penolakan */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-black text-slate-900">
              Tolak Pengajuan KYC: {selectedKyc?.namaLengkap}
            </h3>
            <p className="text-xs text-slate-500">
              Berikan alasan penolakan agar pemohon dapat mengunggah ulang dokumen yang sah.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Foto KTP buram dan nomor NIK tidak terbaca jelas..."
              className="w-full px-3 py-2 border rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
