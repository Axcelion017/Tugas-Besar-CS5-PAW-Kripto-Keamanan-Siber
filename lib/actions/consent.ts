"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { GrantEntityType, Prisma } from "@prisma/client";

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
 */
export async function getAccessGrantsServerAction(patientId: string = "P-101") {
  try {
    const grants = await prisma.accessGrant.findMany({
      where: { patientId },
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
  patientId: string;
  entityId: string;
  entityName: string;
  entityType: "DOKTER" | "FASKES";
  scope?: string;
  durationHours?: number;
}): Promise<ConsentActionResponse> {
  const {
    patientId = "P-101",
    entityId,
    entityName,
    entityType,
    scope = "READ_RME",
    durationHours = 24,
  } = params;

  try {
    const grantId = `AG-${Date.now().toString().slice(-4)}`;
    const validUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const created = await prisma.accessGrant.create({
      data: {
        id: grantId,
        patientId,
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
 * Mengubah kolom `is_revoked` menjadi TRUE dan mencatat `revoked_at` di PostgreSQL
 */
export async function revokeAccessServerAction(
  grantId: string
): Promise<ConsentActionResponse> {
  try {
    const updated = await prisma.accessGrant.update({
      where: { id: grantId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
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
  try {
    const existing = await prisma.accessGrant.findUnique({
      where: { id: grantId },
    });

    if (!existing) {
      return { success: false, message: "Izin akses tidak ditemukan." };
    }

    const currentExpiry = new Date(existing.validUntil) > new Date() ? new Date(existing.validUntil) : new Date();
    const newValidUntil = new Date(currentExpiry.getTime() + additionalHours * 60 * 60 * 1000);

    const updated = await prisma.accessGrant.update({
      where: { id: grantId },
      data: {
        validUntil: newValidUntil,
        isRevoked: false, // Otomatis aktif kembali jika diperpanjang
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
  try {
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
          message: "[Prisma P2025] Rekaman tidak ditemukan: Izin akses yang hendak dihapus tidak ada di database.",
        };
      }
    }
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal menghapus izin akses: ${msg}` };
  }
}
