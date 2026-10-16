"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MOCK_KYD_REQUESTS,
  getStorageData,
  setStorageData,
  KydSubmission,
} from "@/lib/db/mockData";

export default function VerifikasiKydPage() {
  const [kydList, setKydList] = useState<KydSubmission[]>([]);
  const [selectedKyd, setSelectedKyd] = useState<KydSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

  const loadKyd = () => {
    const list = getStorageData<KydSubmission[]>("resilio_kyd_list", MOCK_KYD_REQUESTS);
    setKydList(list);
  };

  useEffect(() => {
    loadKyd();
  }, []);

  const handleApprove = (item: KydSubmission) => {
    const all = getStorageData<KydSubmission[]>("resilio_kyd_list", MOCK_KYD_REQUESTS);
    const updated = all.map((k) =>
      k.id === item.id ? { ...k, status: "VERIFIED" as const } : k
    );
    setStorageData("resilio_kyd_list", updated);
    setKydList(updated);

    setNotif(`Kredensial ${item.namaLengkap} (${item.spesialisasi}) berhasil diverifikasi Kemenkes.`);
    setTimeout(() => setNotif(null), 4000);
  };

  const handleReject = () => {
    if (!selectedKyd) return;
    const all = getStorageData<KydSubmission[]>("resilio_kyd_list", MOCK_KYD_REQUESTS);
    const updated = all.map((k) =>
      k.id === selectedKyd.id
        ? { ...k, status: "REJECTED" as const, alasanPenolakan: rejectReason || "Nomor STR tidak ditemukan di KKI" }
        : k
    );
    setStorageData("resilio_kyd_list", updated);
    setKydList(updated);
    setShowRejectModal(false);
    setRejectReason("");
    setNotif(`Pengajuan kredensial ${selectedKyd.namaLengkap} ditolak.`);
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
          <span>Verifikasi Lisensi Tenaga Medis (UR-A02)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Antrean Verifikasi Kredensial Dokter & Perawat (KYD - STR & SIP)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Mencegah penyusupan akun dokter gadungan ke dalam sistem RME Nasional.
        </p>
      </div>

      {notif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
          {notif}
        </div>
      )}

      {/* Tabel Kredensial Nakes */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Daftar Berkas Kredensial Medis Menunggu Persetujuan
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            {kydList.filter((k) => k.status === "PENDING").length} Menunggu
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Tanggal Pengajuan</th>
                <th className="p-4">Nama & Gelar Nakes</th>
                <th className="p-4">Nomor STR (Konsil)</th>
                <th className="p-4">Nomor SIP (Dinkes)</th>
                <th className="p-4">Spesialisasi & Faskes</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kydList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4 text-slate-500">{item.submittedAt}</td>
                  <td className="p-4 font-bold text-slate-900">{item.namaLengkap}</td>
                  <td className="p-4 font-mono font-bold text-purple-700">{item.strNumber}</td>
                  <td className="p-4 font-mono text-slate-600">{item.sipNumber}</td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-800">{item.spesialisasi}</span>
                    <span className="block text-[11px] text-slate-500">{item.faskesNama}</span>
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
                          Validasi STR
                        </button>
                        <button
                          onClick={() => {
                            setSelectedKyd(item);
                            setShowRejectModal(true);
                          }}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold uppercase transition cursor-pointer"
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold italic">
                        {item.status === "VERIFIED" ? "Lisensi Sah" : `Ditolak: ${item.alasanPenolakan || "-"}`}
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
              Tolak Kredensial: {selectedKyd?.namaLengkap}
            </h3>
            <p className="text-xs text-slate-500">
              Berikan alasan penolakan (misal: STR telah kedaluwarsa atau nama tidak cocok).
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Nomor STR tidak tercatat di pangkalan data KKI..."
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
