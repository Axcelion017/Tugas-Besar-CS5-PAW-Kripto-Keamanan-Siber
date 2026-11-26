"use client";

import React, { useState } from "react";
import {
  FamilyMemberDto,
  upsertFamilyMemberServerAction,
  deleteFamilyMemberServerAction,
} from "@/lib/actions/auth";
import { ConfirmModal } from "@/components/ui/Modal";
import { IconUsers } from "@/components/ui/Icons";

interface FamilyMemberManagerProps {
  members: FamilyMemberDto[];
  todayIso: string;
  onMembersChange: (next: FamilyMemberDto[]) => void;
  onNotify: (type: "success" | "error", text: string) => void;
}

const RELATION_LABELS: Record<FamilyMemberDto["relation"], string> = {
  Anak: "Anak",
  Orang_Tua: "Orang Tua",
  Pasangan: "Pasangan",
  Wali: "Wali",
};

export function FamilyMemberManager({
  members,
  todayIso,
  onMembersChange,
  onNotify,
}: FamilyMemberManagerProps) {
  const [selectedId, setSelectedId] = useState<string | "NEW">(
    members.length > 0 ? members[0].id : "NEW"
  );
  const selectedMember = selectedId === "NEW" ? null : members.find((m) => m.id === selectedId) || null;

  const [name, setName] = useState(selectedMember?.name || "");
  const [nik, setNik] = useState(selectedMember?.nik || "");
  const [relation, setRelation] = useState<FamilyMemberDto["relation"]>(
    selectedMember?.relation || "Anak"
  );
  const [birthDate, setBirthDate] = useState(selectedMember?.birthDate || "2018-01-01");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FamilyMemberDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectForEdit = (member: FamilyMemberDto) => {
    setSelectedId(member.id);
    setName(member.name);
    setNik(member.nik);
    setRelation(member.relation);
    setBirthDate(member.birthDate);
  };

  const startCreateNew = () => {
    setSelectedId("NEW");
    setName("");
    setNik("");
    setRelation("Anak");
    setBirthDate("2018-01-01");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const res = await upsertFamilyMemberServerAction({
        id: selectedId === "NEW" ? undefined : selectedId,
        name,
        nik,
        relation,
        birthDate,
      });

      if (!res.success || !res.data) {
        onNotify("error", res.message);
        return;
      }

      const saved = res.data;
      if (selectedId === "NEW") {
        onMembersChange([...members, saved]);
        selectForEdit(saved);
      } else {
        onMembersChange(members.map((m) => (m.id === saved.id ? saved : m)));
      }
      onNotify("success", res.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await deleteFamilyMemberServerAction(pendingDelete.id);
      if (res.success) {
        const remaining = members.filter((m) => m.id !== pendingDelete.id);
        onMembersChange(remaining);
        if (remaining.length > 0) {
          selectForEdit(remaining[0]);
        } else {
          startCreateNew();
        }
        onNotify("success", res.message);
      } else {
        onNotify("error", res.message);
      }
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Kolom Kiri (5): Daftar Anggota Keluarga Tanggungan */}
      <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconUsers size={16} className="text-blue-700" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Anggota Keluarga ({members.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={startCreateNew}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            + Tambah
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
          {members.length === 0 ? (
            <div className="p-8 text-center space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Belum ada anggota keluarga terdaftar.</p>
              <p className="text-xs text-slate-500">
                Tambahkan profil anak, pasangan, atau orang tua agar dapat dikelola dalam satu akun.
              </p>
            </div>
          ) : (
            members.map((m) => {
              const isSelected = selectedId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectForEdit(m)}
                  aria-pressed={isSelected}
                  className={`w-full p-4 text-left transition cursor-pointer border-l-4 space-y-1 ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-600"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900 truncate">{m.name}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {RELATION_LABELS[m.relation]}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-600">NIK: {m.nik}</p>
                  <p className="text-[11px] text-slate-500">Tanggal Lahir: {m.birthDate}</p>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Kolom Kanan (7): Form Tambah / Edit Anggota Keluarga */}
      <section className="lg:col-span-7 bg-white p-6 md:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900">
              {selectedId === "NEW"
                ? "Tambah Anggota Keluarga Baru"
                : `Edit Profil: ${selectedMember?.name || "Anggota Keluarga"}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perubahan langsung tersinkronisasi dengan pengalih Family Proxy pada Ringkasan Kesehatan.
            </p>
          </div>
          {selectedMember && (
            <button
              type="button"
              onClick={() => setPendingDelete(selectedMember)}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition"
            >
              Hapus
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fam-name" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Nama Lengkap Anggota *
              </label>
              <input
                id="fam-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Bintang Pratama Santoso"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="fam-relation" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Hubungan Keluarga *
              </label>
              <select
                id="fam-relation"
                value={relation}
                onChange={(e) => setRelation(e.target.value as FamilyMemberDto["relation"])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Anak">Anak</option>
                <option value="Pasangan">Pasangan</option>
                <option value="Orang_Tua">Orang Tua</option>
                <option value="Wali">Wali</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fam-nik" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                NIK (16 Digit Kependudukan) *
              </label>
              <input
                id="fam-nik"
                type="text"
                required
                maxLength={16}
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                placeholder="3171010505180002"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="fam-birthdate" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Tanggal Lahir *
              </label>
              <input
                id="fam-birthdate"
                type="date"
                required
                max={todayIso}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {selectedId !== "NEW" && (
              <button
                type="button"
                onClick={startCreateNew}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Buat Anggota Baru
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition cursor-pointer"
            >
              {isSaving
                ? "Menyimpan..."
                : selectedId === "NEW"
                ? "Simpan Anggota Baru"
                : "Simpan Perubahan Profil"}
            </button>
          </div>
        </form>
      </section>

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus Anggota Keluarga?"
        description={`Profil "${pendingDelete?.name || ""}" akan dihapus dari daftar tanggungan Family Proxy akun Anda.`}
        confirmLabel="Ya, Hapus Anggota"
        tone="danger"
        isBusy={isDeleting}
      />
    </div>
  );
}
