"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import {
  revokeAccessServerAction,
  grantAccessServerAction,
  getAccessGrantsServerAction,
  updateAccessGrantServerAction,
  deleteAccessGrantServerAction,
} from "@/lib/actions/consent";
import { getFaskesListServerAction } from "@/lib/actions/faskes";
import { ConfirmModal } from "@/components/ui/Modal";
import { ToastBanner } from "@/components/ui/ToastBanner";

interface GrantRow {
  id: string;
  pasienId: string;
  pasienNama: string;
  entityId: string;
  entityNama: string;
  entityType: "DOKTER" | "FASKES";
  scope: string;
  validUntil: string;
  isRevoked: boolean;
  createdAt: string;
}

interface DbDoctorOption {
  id: string;
  name: string;
  specialty: string;
  faskesStatus?: string;
}

interface DbFaskesOption {
  id: string;
  nama: string;
  tipe: string;
  status: string;
}

export default function ConsentManagerPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [doctors, setDoctors] = useState<DbDoctorOption[]>([]);
  const [faskesList, setFaskesList] = useState<DbFaskesOption[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [validDays, setValidDays] = useState(7);
  const [notif, setNotif] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteGrantId, setPendingDeleteGrantId] = useState<string | null>(null);

  const fetchGrantsFromDb = useCallback(async (user: UserSession) => {
    const grantsRes = await getAccessGrantsServerAction(user.id);
    if (grantsRes.success && Array.isArray(grantsRes.data)) {
      const mappedGrants: GrantRow[] = (
        grantsRes.data as unknown as Array<{
          id: string;
          patientId: string;
          entityId: string;
          entityName: string;
          entityType: string;
          scope: string;
          validUntil: Date | string;
          isRevoked: boolean;
          createdAt: Date | string;
        }>
      ).map((g) => ({
        id: g.id,
        pasienId: g.patientId,
        pasienNama: user.name,
        entityId: g.entityId,
        entityNama: g.entityName,
        entityType: g.entityType === "FASKES" ? "FASKES" : "DOKTER",
        scope: g.scope,
        validUntil: new Date(g.validUntil).toLocaleString("id-ID"),
        isRevoked: g.isRevoked,
        createdAt: new Date(g.createdAt).toLocaleString("id-ID"),
      }));
      setGrants(mappedGrants);
    } else {
      setGrants([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const s = getUserSession();
        if (!s || !active) return;
        setSession(s);

        const [, faskesRes] = await Promise.all([
          fetchGrantsFromDb(s),
          getFaskesListServerAction(),
        ]);

        if (!active) return;
        if (faskesRes.success && Array.isArray(faskesRes.data)) {
          const dbFaskes: DbFaskesOption[] = [];
          const dbDoctors: DbDoctorOption[] = [];

          for (const f of faskesRes.data as Array<{
            id: string;
            nama: string;
            tipe: string;
            status: string;
            doctors?: Array<{ id: string; name: string; specialty: string }>;
          }>) {
            dbFaskes.push({ id: f.id, nama: f.nama, tipe: f.tipe, status: f.status });
            for (const d of f.doctors || []) {
              dbDoctors.push({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
                faskesStatus: f.status,
              });
            }
          }

          setFaskesList(dbFaskes);
          setDoctors(dbDoctors);

          const firstActiveDoc = dbDoctors.find((d) => d.faskesStatus !== "QUARANTINED");
          const firstActiveFaskes = dbFaskes.find((f) => f.status !== "QUARANTINED");
          setSelectedEntityId(firstActiveDoc?.id || firstActiveFaskes?.id || "");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [fetchGrantsFromDb]);

  const showNotif = (type: "ok" | "err", msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 4500);
  };

  const handleExtendGrant = async (grantId: string, entityNama: string) => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await updateAccessGrantServerAction(grantId, 48);
      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif("ok", `Izin akses untuk ${entityNama} berhasil diperpanjang 48 jam di PostgreSQL.`);
      } else {
        showNotif("err", res.message || "Gagal memperpanjang izin akses.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGrant = (grantId: string) => {
    if (!session || isSubmitting) return;
    setPendingDeleteGrantId(grantId);
  };

  const confirmDeleteGrant = async () => {
    if (!session || !pendingDeleteGrantId || isSubmitting) return;
    const grantId = pendingDeleteGrantId;
    setIsSubmitting(true);
    try {
      const res = await deleteAccessGrantServerAction(grantId);
      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif("ok", `Riwayat izin akses ${grantId} berhasil dihapus permanen dari PostgreSQL.`);
      } else {
        showNotif("err", res.message || "Gagal menghapus izin akses.");
      }
    } finally {
      setIsSubmitting(false);
      setPendingDeleteGrantId(null);
    }
  };

  const handleRevoke = async (grantId: string, entityNama: string) => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await revokeAccessServerAction(grantId);
      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif("ok", `Izin akses untuk ${entityNama} berhasil dicabut seketika (1-Click Revoke UU PDP).`);
      } else {
        showNotif("err", res.message || "Gagal mencabut izin akses di basis data.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedEntityId || isSubmitting) return;

    const doctor = doctors.find((d) => d.id === selectedEntityId);
    const faskes = faskesList.find((f) => f.id === selectedEntityId);

    if (faskes?.status === "QUARANTINED" || doctor?.faskesStatus === "QUARANTINED") {
      showNotif(
        "err",
        "Pemberian izin ditolak: Faskes terkait sedang berstatus KARANTINA (Kill-Switch Siber)."
      );
      return;
    }

    const entityNama = doctor ? doctor.name : faskes ? faskes.nama : "Entitas Kesehatan";
    const entityType = doctor ? "DOKTER" : "FASKES";

    setIsSubmitting(true);
    try {
      const res = await grantAccessServerAction({
        patientId: session.id,
        entityId: selectedEntityId,
        entityName: entityNama,
        entityType,
        durationHours: Number(validDays) * 24,
      });

      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif(
          "ok",
          `Sukses: Izin akses RME resmi diberikan kepada ${entityNama} selama ${validDays} hari di PostgreSQL.`
        );
      } else {
        showNotif("err", res.message || "Gagal mencatat pemberian izin akses di basis data.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <Link href="/pasien" className="hover:underline">
            Portal Pasien
          </Link>
          <span>/</span>
          <span>Kedaulatan Izin Akses (UR-P05 & UR-P07)</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
          Manajemen Hak Akses Medis (Consent Control) & Perpindahan Faskes
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Sesuai <strong>UU Pelindungan Data Pribadi (UU PDP No. 27/2022)</strong>, Anda memiliki hak mutlak untuk membagikan atau mencabut hak dokter/faskes dalam membaca riwayat penyakit Anda kapan saja.
        </p>
      </div>

      {notif && (
        <div
          role={notif.type === "err" ? "alert" : "status"}
          className={`p-4 rounded-2xl border text-xs font-bold ${
            notif.type === "err"
              ? "bg-red-50 border-red-300 text-red-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}
        >
          {notif.msg}
        </div>
      )}

      {/* Formulir Berikan Akses Baru (Perpindahan Faskes) */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">
          Berikan Izin Akses Baru (Perpindahan Faskes / Rujukan Mandiri)
        </h2>
        <p className="text-xs text-slate-500">
          Saat Anda berpindah rumah sakit atau berkonsultasi ke spesialis baru, Anda tidak perlu membawa berkas fisik. Berikan izin di bawah ini agar dokter baru langsung dapat membaca riwayat RME terenkripsi Anda.
        </p>

        <form onSubmit={handleGrantNew} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label
              htmlFor="consent-entity"
              className="block text-xs font-bold text-slate-600 uppercase mb-1"
            >
              Pilih Dokter / Faskes Tujuan
            </label>
            <select
              id="consent-entity"
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              disabled={isLoading || isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white disabled:opacity-60"
            >
              <optgroup label="Dokter Spesialis (PostgreSQL)">
                {doctors.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.faskesStatus === "QUARANTINED"}>
                    {d.name} ({d.specialty})
                    {d.faskesStatus === "QUARANTINED" ? " [KARANTINA]" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Fasilitas Kesehatan (PostgreSQL)">
                {faskesList.map((f) => (
                  <option key={f.id} value={f.id} disabled={f.status === "QUARANTINED"}>
                    {f.nama} ({f.tipe})
                    {f.status === "QUARANTINED" ? " [KARANTINA]" : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label
              htmlFor="consent-duration"
              className="block text-xs font-bold text-slate-600 uppercase mb-1"
            >
              Masa Berlaku Izin (Hari)
            </label>
            <select
              id="consent-duration"
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white disabled:opacity-60"
            >
              <option value={1}>1 Hari (Konsultasi Singkat)</option>
              <option value={3}>3 Hari (Pemeriksaan Lanjutan)</option>
              <option value={7}>7 Hari (1 Minggu Perawatan)</option>
              <option value={30}>30 Hari (Rujukan Rawat Jalan)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedEntityId}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer"
            >
              {isSubmitting ? "Menyimpan ke Database..." : "+ Berikan Izin Digital"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Izin Aktif & Tombol Revoke */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">
            Daftar Izin Akses Aktif & Riwayat Pencabutan
          </h3>
          <span className="text-xs text-slate-500 font-semibold">
            Zero-Trust Gateway Enforcement (PostgreSQL)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-4">Entitas Terotorisasi</th>
                <th className="p-4">Tipe</th>
                <th className="p-4">Cakupan Izin (Scope)</th>
                <th className="p-4">Berlaku Hingga</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    Memuat data izin akses dari PostgreSQL...
                  </td>
                </tr>
              ) : grants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    Belum ada izin akses aktif. Anda memegang kendali penuh atas seluruh data medis Anda.
                  </td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900">{g.entityNama}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">
                        {g.entityType}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{g.scope}</td>
                    <td className="p-4 font-mono text-slate-500">{g.validUntil}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                          g.isRevoked
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {g.isRevoked ? "Dicabut (Revoked)" : "Aktif (Active)"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!g.isRevoked ? (
                          <>
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleExtendGrant(g.id, g.entityNama)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 rounded-lg text-xs font-bold uppercase transition cursor-pointer border border-blue-200"
                              title="Perpanjang Masa Berlaku Izin (UPDATE)"
                            >
                              +48 Jam
                            </button>
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleRevoke(g.id, g.entityNama)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition cursor-pointer shadow-xs"
                              title="Cabut Hak Akses (1-Click Revoke)"
                            >
                              Cabut (Revoke)
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleExtendGrant(g.id, g.entityNama)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 rounded-lg text-xs font-bold uppercase transition cursor-pointer border border-emerald-200"
                            title="Aktifkan Kembali Izin Akses (UPDATE)"
                          >
                            Aktifkan Lagi
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleDeleteGrant(g.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="Hapus Rekaman Izin (DELETE)"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteGrantId)}
        onClose={() => setPendingDeleteGrantId(null)}
        onConfirm={() => void confirmDeleteGrant()}
        title="Hapus Riwayat Izin Akses?"
        description={`Riwayat izin akses ${pendingDeleteGrantId || ""} akan dihapus permanen dari PostgreSQL. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Permanen"
        tone="danger"
        isBusy={isSubmitting}
      />

      <ToastBanner
        message={notif?.msg || null}
        type={notif?.type === "err" ? "error" : "success"}
        onDismiss={() => setNotif(null)}
      />
    </div>
  );
}
