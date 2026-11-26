"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, GrantEntityType, Prisma } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js
  }
}

export interface ConsentActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Mengambil Daftar Izin Akses Pasien (UU PDP No. 27/2022)
 * Identitas pasien diambil dari sesi server terverifikasi untuk mencegah BOLA/IDOR.
 */
export async function getAccessGrantsServerAction(patientId?: string) {
  const auth = await requireSession(["pasien", "admin"], "getAccessGrants");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  const targetPatientId = auth.role === "admin" && patientId ? patientId : auth.session.id;

  try {
    const grants = await prisma.accessGrant.findMany({
      where: { patientId: targetPatientId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: grants };
  } catch (error: unknown) {
    console.warn("Get Access Grants Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Memberikan Izin Akses Rekam Medis ke Faskes / Dokter
 */
export async function grantAccessServerAction(params: {
  patientId?: string;
  entityId: string;
  entityName: string;
  entityType: "DOKTER" | "FASKES";
  scope?: string;
  durationHours?: number;
}): Promise<ConsentActionResponse> {
  const auth = await requireSession(["pasien"], "grantAccess");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const {
    entityId,
    entityName,
    entityType,
    scope = "READ_RME",
    durationHours = 24,
  } = params;

  const ownerPatientId = auth.session.id;

  try {
    const grantId = `AG-${Date.now().toString().slice(-6)}`;
    const validUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const created = await prisma.accessGrant.create({
      data: {
        id: grantId,
        patientId: ownerPatientId,
        entityId,
        entityName,
        entityType: entityType === "DOKTER" ? GrantEntityType.DOKTER : GrantEntityType.FASKES,
        scope,
        validUntil,
        isRevoked: false,
      },
    });

    safeRevalidate("/pasien/consent");
    safeRevalidate("/pasien");
    safeRevalidate("/pasien/audit-log");

    return {
      success: true,
      message: `Persetujuan akses medis untuk ${entityName} berhasil dicatat di basis data.`,
      data: created,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    return { success: false, message: `Gagal memberikan izin akses: ${msg}` };
  }
}

/**
 * Server Action: Pencabutan Hak Akses Seketika (1-Click Revoke - UU PDP Pasal 20)
 * Memverifikasi kepemilikan `grant.patientId === auth.session.id` sebelum mutasi.
 */
export async function revokeAccessServerAction(
  grantId: string
): Promise<ConsentActionResponse> {
  const auth = await requireSession(["pasien", "admin"], `revokeAccess:${grantId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.accessGrant.findUnique({
      where: { id: grantId },
    });

    if (!existing) {
      return { success: false, message: "Izin akses tidak ditemukan." };
    }

    if (auth.role !== "admin" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/consent/revoke/${grantId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pengguna ${auth.session.id} mencoba mencabut consent milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang mencabut izin akses milik pasien lain.",
      };
    }

    const updated = await prisma.accessGrant.update({
      where: { id: grantId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.REVOKE_CONSENT,
      targetResource: `/api/consent/revoke/${grantId}`,
      severity: AuditSeverity.INFO,
      detail: `Pasien ${auth.session.name} mencabut izin akses untuk ${existing.entityName} (1-Click Revoke UU PDP).`,
    });

    safeRevalidate("/pasien/consent");
    safeRevalidate("/pasien");
    safeRevalidate("/pasien/audit-log");

    return {
      success: true,
      message: `Hak akses berhasil dicabut seketika (1-Click Revoke) dari basis data.`,
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mencabut izin akses: ${msg}` };
  }
}

/**
 * Server Action: Perbarui Masa Berlaku Izin Akses (UPDATE - Extend Duration)
 */
export async function updateAccessGrantServerAction(
  grantId: string,
  additionalHours: number = 24
): Promise<ConsentActionResponse> {
  const auth = await requireSession(["pasien", "admin"], `updateAccessGrant:${grantId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.accessGrant.findUnique({
      where: { id: grantId },
    });

    if (!existing) {
      return { success: false, message: "Izin akses tidak ditemukan." };
    }

    if (auth.role !== "admin" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/consent/extend/${grantId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pengguna ${auth.session.id} mencoba memperpanjang consent milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang mengubah izin akses milik pasien lain.",
      };
    }

    const currentExpiry =
      new Date(existing.validUntil) > new Date() ? new Date(existing.validUntil) : new Date();
    const newValidUntil = new Date(currentExpiry.getTime() + additionalHours * 60 * 60 * 1000);

    const updated = await prisma.accessGrant.update({
      where: { id: grantId },
      data: {
        validUntil: newValidUntil,
        isRevoked: false,
      },
    });

    safeRevalidate("/pasien/consent");
    safeRevalidate("/pasien");
    safeRevalidate("/pasien/audit-log");

    return {
      success: true,
      message: `Masa berlaku izin akses untuk ${existing.entityName} berhasil diperpanjang hingga ${newValidUntil.toLocaleString("id-ID")}.`,
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal memperpanjang izin: ${msg}` };
  }
}

/**
 * Server Action: Hapus Riwayat Izin Akses Permanen (DELETE)
 */
export async function deleteAccessGrantServerAction(
  grantId: string
): Promise<ConsentActionResponse> {
  const auth = await requireSession(["pasien", "admin"], `deleteAccessGrant:${grantId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const existing = await prisma.accessGrant.findUnique({
      where: { id: grantId },
    });

    if (!existing) {
      return {
        success: false,
        message:
          "[Prisma P2025] Rekaman tidak ditemukan: Izin akses yang hendak dihapus tidak ada di database.",
      };
    }

    if (auth.role !== "admin" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `/api/consent/delete/${grantId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `BOLA Guard: Pengguna ${auth.session.id} mencoba menghapus consent milik pasien ${existing.patientId}.`,
      });
      return {
        success: false,
        message: "403 Forbidden: Anda tidak berwenang menghapus izin akses milik pasien lain.",
      };
    }

    await prisma.accessGrant.delete({
      where: { id: grantId },
    });

    safeRevalidate("/pasien/consent");
    safeRevalidate("/pasien");
    safeRevalidate("/pasien/audit-log");

    return {
      success: true,
      message: "Riwayat izin akses berhasil dihapus dari basis data.",
      data: { id: grantId },
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          message:
            "[Prisma P2025] Rekaman tidak ditemukan: Izin akses yang hendak dihapus tidak ada di database.",
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal menghapus izin akses: ${msg}` };
  }
}
