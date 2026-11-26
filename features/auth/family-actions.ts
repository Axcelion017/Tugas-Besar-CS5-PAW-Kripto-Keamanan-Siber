"use server";

import { z } from "zod";
import { AuditAction, AuditSeverity, FamilyRelation } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { safeRevalidate } from "@/lib/utils/revalidate";

const FamilyMemberInputSchema = z.object({
  id: z.string({ message: "ID anggota tidak valid." }).optional(),
  name: z
    .string({ message: "Nama lengkap anggota keluarga wajib diisi." })
    .trim()
    .min(3, { message: "Nama lengkap minimal 3 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  nik: z
    .string({ message: "NIK anggota keluarga wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK anggota keluarga wajib tepat 16 digit angka." }),
  relation: z.enum(["Anak", "Orang_Tua", "Pasangan", "Wali"], {
    message: "Hubungan keluarga wajib dipilih (Anak, Orang Tua, Pasangan, atau Wali).",
  }),
  birthDate: z
    .string({ message: "Tanggal lahir wajib diisi." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format tanggal lahir harus YYYY-MM-DD." }),
});

export interface FamilyMemberDto {
  id: string;
  name: string;
  nik: string;
  relation: "Anak" | "Orang_Tua" | "Pasangan" | "Wali";
  birthDate: string;
}

export async function upsertFamilyMemberServerAction(rawInput: {
  id?: string;
  name: string;
  nik: string;
  relation: "Anak" | "Orang_Tua" | "Pasangan" | "Wali";
  birthDate: string;
}): Promise<{ success: boolean; message: string; data?: FamilyMemberDto }> {
  const auth = await requireSession(["pasien"], "upsertFamilyMember");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const parsed = FamilyMemberInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Data anggota keluarga tidak valid.",
    };
  }

  const { id, name, nik, relation, birthDate } = parsed.data;
  const parsedDate = new Date(birthDate);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
    return { success: false, message: "Tanggal lahir tidak boleh melebihi hari ini." };
  }

  const patientId = auth.session.id;

  try {
    if (id) {
      const existing = await prisma.familyMember.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, message: "Data anggota keluarga tidak ditemukan." };
      }

      if (existing.patientId !== patientId) {
        await recordSecurityAuditBestEffort({
          actorId: patientId,
          actorName: auth.session.name,
          actorRole: auth.role,
          action: AuditAction.IDOR_BLOCKED,
          targetResource: `/api/patients/family/${id}`,
          severity: AuditSeverity.CRITICAL,
          detail: `BOLA Guard: Pasien ${patientId} mencoba mengubah anggota keluarga milik pasien ${existing.patientId}.`,
        });
        return {
          success: false,
          message: "403 Forbidden: Anda hanya dapat mengubah anggota keluarga pada akun Anda sendiri.",
        };
      }

      const updated = await prisma.familyMember.update({
        where: { id },
        data: {
          name,
          nik,
          relation: relation as FamilyRelation,
          birthDate: parsedDate,
        },
      });

      safeRevalidate(["/pasien", "/pasien/profil"]);
      return {
        success: true,
        message: `Profil anggota keluarga "${updated.name}" berhasil diperbarui.`,
        data: {
          id: updated.id,
          name: updated.name,
          nik: updated.nik,
          relation: updated.relation as FamilyMemberDto["relation"],
          birthDate: updated.birthDate.toISOString().split("T")[0],
        },
      };
    }

    const newId = `FAM-${Date.now().toString().slice(-6)}`;
    const created = await prisma.familyMember.create({
      data: {
        id: newId,
        patientId,
        name,
        nik,
        relation: relation as FamilyRelation,
        birthDate: parsedDate,
      },
    });

    safeRevalidate(["/pasien", "/pasien/profil"]);
    return {
      success: true,
      message: `Anggota keluarga "${created.name}" berhasil ditambahkan ke akun Anda.`,
      data: {
        id: created.id,
        name: created.name,
        nik: created.nik,
        relation: created.relation as FamilyMemberDto["relation"],
        birthDate: created.birthDate.toISOString().split("T")[0],
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan basis data";
    console.error("Upsert FamilyMember Error:", err);
    return { success: false, message: `Gagal menyimpan data anggota keluarga: ${msg}` };
  }
}

export async function deleteFamilyMemberServerAction(
  familyMemberId: string
): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["pasien"], `deleteFamilyMember:${familyMemberId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.familyMember.findUnique({ where: { id: familyMemberId } });
    if (!existing) {
      return { success: false, message: "Anggota keluarga tidak ditemukan." };
    }

    if (existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/patients/family/${familyMemberId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba menghapus anggota keluarga milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang menghapus anggota keluarga akun lain.",
      };
    }

    await prisma.familyMember.delete({ where: { id: familyMemberId } });
    safeRevalidate(["/pasien", "/pasien/profil"]);
    return {
      success: true,
      message: `Anggota keluarga "${existing.name}" berhasil dihapus dari daftar tanggungan.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan basis data";
    return { success: false, message: `Gagal menghapus anggota keluarga: ${msg}` };
  }
}
