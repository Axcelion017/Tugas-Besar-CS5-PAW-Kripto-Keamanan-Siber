"use client";

import { Breadcrumb } from "@/components/ui/Breadcrumb";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  IconBuilding,
  IconCheck,
  IconSearch,
  IconShield,
  IconStethoscope,
} from "@/components/ui/Icons";

interface GrantRow {
  id: string;
  pasienId: string;
  entityId: string;
  entityNama: string;
  entityType: "DOKTER" | "FASKES";
  scope: string;
  validUntilIso: string;
  validUntilFormatted: string;
  isRevoked: boolean;
  isExpired: boolean;
  createdAt: string;
}

interface DbDoctorOption {
  id: string;
  name: string;
  specialty: string;
  faskesNama: string;
  faskesStatus?: string;
}

interface DbFaskesOption {
  id: string;
  nama: string;
  tipe: string;
  kota: string;
  status: string;
}

const DURATION_OPTIONS = [
  { days: 1, label: "1 Hari", desc: "Konsultasi singkat" },
  { days: 3, label: "3 Hari", desc: "Pemeriksaan lanjutan" },
  { days: 7, label: "7 Hari", desc: "1 minggu perawatan" },
  { days: 30, label: "30 Hari", desc: "Rujukan rawat jalan" },
];

function formatFaskesType(tipe: string): string {
  if (tipe === "RUMAH_SAKIT") return "Rumah Sakit";
  if (tipe === "KLINIK_PRATAMA") return "Klinik Pratama";
  if (tipe === "PUSKESMAS") return "Puskesmas";
  return tipe;
}

export default function ConsentManagerPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [doctors, setDoctors] = useState<DbDoctorOption[]>([]);
  const [faskesList, setFaskesList] = useState<DbFaskesOption[]>([]);
  const [targetType, setTargetType] = useState<"DOKTER" | "FASKES">("DOKTER");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [validDays, setValidDays] = useState(7);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "REVOKED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [notif, setNotif] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteGrantId, setPendingDeleteGrantId] = useState<string | null>(null);

  const fetchGrantsFromDb = useCallback(async (user: UserSession) => {
    const grantsRes = await getAccessGrantsServerAction(user.id);
    if (grantsRes.success && Array.isArray(grantsRes.data)) {
      const nowMs = Date.now();
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
      ).map((g) => {
        const validDate = new Date(g.validUntil);
        return {
          id: g.id,
          pasienId: g.patientId,
          entityId: g.entityId,
          entityNama: g.entityName,
          entityType: g.entityType === "FASKES" ? "FASKES" : "DOKTER",
          scope: g.scope,
          validUntilIso: validDate.toISOString(),
          validUntilFormatted: validDate.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          isRevoked: g.isRevoked,
          isExpired: !g.isRevoked && validDate.getTime() < nowMs,
          createdAt: new Date(g.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };
      });
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
            kota: string;
            status: string;
            doctors?: Array<{ id: string; name: string; specialty: string }>;
          }>) {
            dbFaskes.push({
              id: f.id,
              nama: f.nama,
              tipe: formatFaskesType(f.tipe),
              kota: f.kota,
              status: f.status,
            });
            for (const d of f.doctors || []) {
              dbDoctors.push({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
                faskesNama: f.nama,
                faskesStatus: f.status,
              });
            }
          }

          setFaskesList(dbFaskes);
          setDoctors(dbDoctors);

          const firstActiveDoc = dbDoctors.find((d) => d.faskesStatus !== "QUARANTINED");
          const firstActiveFaskes = dbFaskes.find((f) => f.status !== "QUARANTINED");
          if (firstActiveDoc) {
            setTargetType("DOKTER");
            setSelectedEntityId(firstActiveDoc.id);
          } else if (firstActiveFaskes) {
            setTargetType("FASKES");
            setSelectedEntityId(firstActiveFaskes.id);
          }
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

  const handleSwitchTargetType = (nextType: "DOKTER" | "FASKES") => {
    setTargetType(nextType);
    if (nextType === "DOKTER") {
      const firstDoc = doctors.find((d) => d.faskesStatus !== "QUARANTINED") || doctors[0];
      setSelectedEntityId(firstDoc?.id || "");
    } else {
      const firstFas = faskesList.find((f) => f.status !== "QUARANTINED") || faskesList[0];
      setSelectedEntityId(firstFas?.id || "");
    }
  };

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
        showNotif("ok", `Izin akses untuk ${entityNama} diperpanjang +48 jam.`);
      } else {
        showNotif("err", res.message || "Gagal memperpanjang izin akses.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteGrant = async () => {
    if (!session || !pendingDeleteGrantId || isSubmitting) return;
    const grantId = pendingDeleteGrantId;
    setIsSubmitting(true);
    try {
      const res = await deleteAccessGrantServerAction(grantId);
      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif("ok", `Riwayat izin akses ${grantId} berhasil dihapus permanen.`);
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
        showNotif("ok", `Izin akses untuk ${entityNama} dicabut seketika (1-Click Revoke).`);
      } else {
        showNotif("err", res.message || "Gagal mencabut izin akses.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedEntityId || isSubmitting) return;

    const doctor = targetType === "DOKTER" ? doctors.find((d) => d.id === selectedEntityId) : undefined;
    const faskes = targetType === "FASKES" ? faskesList.find((f) => f.id === selectedEntityId) : undefined;

    if (faskes?.status === "QUARANTINED" || doctor?.faskesStatus === "QUARANTINED") {
      showNotif(
        "err",
        "Pemberian izin ditolak: Faskes terkait sedang berstatus KARANTINA (Kill-Switch Siber)."
      );
      return;
    }

    const entityNama = doctor ? doctor.name : faskes ? faskes.nama : "Entitas Kesehatan";

    setIsSubmitting(true);
    try {
      const res = await grantAccessServerAction({
        patientId: session.id,
        entityId: selectedEntityId,
        entityName: entityNama,
        entityType: targetType,
        durationHours: Number(validDays) * 24,
      });

      if (res.success) {
        await fetchGrantsFromDb(session);
        showNotif("ok", `Izin akses RME berhasil diberikan kepada ${entityNama} selama ${validDays} hari.`);
      } else {
        showNotif("err", res.message || "Gagal mencatat pemberian izin akses.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = useMemo(
    () => grants.filter((g) => !g.isRevoked && !g.isExpired).length,
    [grants]
  );
  const revokedCount = useMemo(() => grants.filter((g) => g.isRevoked).length, [grants]);

  const filteredGrants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return grants.filter((g) => {
      if (statusFilter === "ACTIVE" && (g.isRevoked || g.isExpired)) return false;
      if (statusFilter === "REVOKED" && !g.isRevoked) return false;
      if (
        q &&
        !g.entityNama.toLowerCase().includes(q) &&
        !g.scope.toLowerCase().includes(q) &&
        !g.id.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [grants, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: "Portal Pasien", href: "/pasien" },
              { label: "Izin Akses Medis" },
            ]}
          />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Manajemen Hak Akses Medis (Consent Control)
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5 max-w-2xl">
            Atur dokter atau fasilitas kesehatan yang diizinkan membaca rekam medis terenkripsi Anda sesuai{" "}
            <strong>UU PDP No. 27/2022</strong>. Pencabutan berlaku seketika.
          </p>
        </div>

        <Link
          href="/pasien/audit-log"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 text-xs font-bold shadow-xs transition self-start"
        >
          <IconShield size={15} className="text-slate-600" />
          <span>Lihat Jejak Akses Medis →</span>
        </Link>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Izin Aktif</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Entitas berizin membaca RME</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <IconCheck size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dicabut (Revoked)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{revokedCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Akses diputus lewat 1-Click Revoke</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
            <IconShield size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Riwayat</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{grants.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tercatat permanen di PostgreSQL</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
            <IconBuilding size={18} />
          </div>
        </div>
      </div>

      {/* Formulir Berikan Izin Baru */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Berikan Izin Akses Baru (Perpindahan Faskes / Rujukan)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Bagikan riwayat RME terenkripsi ke dokter atau rumah sakit tujuan tanpa berkas fisik.
            </p>
          </div>

          {/* Toggle Dokter / Faskes */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => handleSwitchTargetType("DOKTER")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                targetType === "DOKTER"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconStethoscope size={14} />
              <span>Dokter</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTargetType("FASKES")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                targetType === "FASKES"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconBuilding size={14} />
              <span>Faskes</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleGrantNew} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <label
                htmlFor="consent-entity"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                {targetType === "DOKTER"
                  ? "Pilih Dokter Spesialis Tujuan"
                  : "Pilih Fasilitas Kesehatan Tujuan"}
              </label>
              <select
                id="consent-entity"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                disabled={isLoading || isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
              >
                {targetType === "DOKTER"
                  ? doctors.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.faskesStatus === "QUARANTINED"}>
                        {d.name} — {d.specialty} ({d.faskesNama})
                        {d.faskesStatus === "QUARANTINED" ? " [KARANTINA]" : ""}
                      </option>
                    ))
                  : faskesList.map((f) => (
                      <option key={f.id} value={f.id} disabled={f.status === "QUARANTINED"}>
                        {f.nama} ({f.tipe} — {f.kota})
                        {f.status === "QUARANTINED" ? " [KARANTINA]" : ""}
                      </option>
                    ))}
              </select>
            </div>

            <div className="lg:col-span-6">
              <span className="block text-xs font-bold text-slate-700 mb-1.5">
                Masa Berlaku Izin
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setValidDays(opt.days)}
                    className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                      validDays === opt.days
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-xs font-black">{opt.label}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || !selectedEntityId}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? "Menyimpan Izin..." : "Terbitkan Izin Akses Digital"}
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Izin Akses */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Daftar Izin Akses &amp; Riwayat Pencabutan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredGrants.length} dari {grants.length} catatan izin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <IconSearch
                size={14}
                className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dokter atau faskes..."
                aria-label="Cari dokter atau faskes pada daftar izin"
                className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-400 focus:outline-none"
              />
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
              {(
                [
                  { id: "ALL", label: "Semua" },
                  { id: "ACTIVE", label: "Aktif" },
                  { id: "REVOKED", label: "Dicabut" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-10 text-center text-xs font-medium text-slate-500">
              Memuat data izin akses dari PostgreSQL...
            </div>
          ) : filteredGrants.length === 0 ? (
            <div className="p-10 text-center space-y-1">
              <p className="text-sm font-bold text-slate-700">Tidak ada data izin akses</p>
              <p className="text-xs text-slate-500">
                {grants.length === 0
                  ? "Anda memegang kendali penuh — belum ada pihak luar yang memiliki akses ke RME Anda."
                  : "Ubah filter status atau kata kunci pencarian untuk melihat riwayat lainnya."}
              </p>
            </div>
          ) : (
            filteredGrants.map((g) => {
              const statusBadge = g.isRevoked
                ? { label: "Dicabut", cls: "bg-red-50 text-red-800 border-red-200" }
                : g.isExpired
                ? { label: "Kedaluwarsa", cls: "bg-amber-50 text-amber-800 border-amber-200" }
                : { label: "Aktif", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };

              return (
                <div
                  key={g.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        g.entityType === "DOKTER"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-blue-50 border-blue-200 text-blue-700"
                      }`}
                    >
                      {g.entityType === "DOKTER" ? (
                        <IconStethoscope size={18} />
                      ) : (
                        <IconBuilding size={18} />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {g.entityNama}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {g.entityType === "DOKTER" ? "Dokter" : "Faskes"}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>
                          Cakupan: <strong className="text-slate-800">{g.scope}</strong>
                        </span>
                        <span>
                          Berlaku s.d.{" "}
                          <strong className="font-mono text-slate-800">
                            {g.validUntilFormatted}
                          </strong>
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">{g.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
                    {!g.isRevoked && !g.isExpired ? (
                      <>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleExtendGrant(g.id, g.entityNama)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          +48 Jam
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleRevoke(g.id, g.entityNama)}
                          className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          Cabut Akses
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleExtendGrant(g.id, g.entityNama)}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition cursor-pointer"
                      >
                        Aktifkan Kembali
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setPendingDeleteGrantId(g.id)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })
          )}
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
