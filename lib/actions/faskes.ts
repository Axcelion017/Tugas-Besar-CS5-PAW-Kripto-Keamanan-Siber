"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, FaskesStatus } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

export interface FaskesActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Mengambil Daftar Seluruh Faskes & Dokter Praktik dari PostgreSQL
 * (Data direktori faskes bersifat publik/terautentikasi untuk pencarian fasilitas)
 */
export async function getFaskesListServerAction() {
  try {
    const list = await prisma.faskes.findMany({
      include: {
        doctors: {
          select: {
            id: true,
            name: true,
            specialty: true,
            kuotaHarian: true,
            strNumber: true,
            sipNumber: true,
            fotoProfilUrl: true,
          },
        },
      },
      orderBy: { nama: "asc" },
    });
    return { success: true, data: list };
  } catch (error: unknown) {
    console.warn("Get Faskes List Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mengambil Detail Faskes Spesifik dari PostgreSQL
 */
export async function getFaskesDetailServerAction(faskesId: string) {
  try {
    const faskes = await prisma.faskes.findUnique({
      where: { id: faskesId },
      include: {
        doctors: true,
      },
    });
    if (!faskes) {
      return { success: false, data: null, message: "Faskes tidak ditemukan." };
    }
    return { success: true, data: faskes };
  } catch {
    return { success: false, data: null, message: "Kesalahan server saat memuat faskes." };
  }
}

/**
 * Server Action: Saklar Isolasi Siber Faskes (Ransomware Kill-Switch - UR-A03)
 * Dibatasi ketat khusus peran Admin Regulator (`requireSession(["admin"])`).
 */
export async function toggleFaskesKillSwitchServerAction(
  faskesId: string,
  newStatus: FaskesStatus
): Promise<FaskesActionResponse> {
  const auth = await requireSession(["admin"], `toggleFaskesKillSwitch:${faskesId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const updated = await prisma.faskes.update({
      where: { id: faskesId },
      data: { status: newStatus },
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.QUARANTINE_FASKES,
      targetResource: `/api/faskes/${faskesId}/kill-switch`,
      severity: newStatus === FaskesStatus.QUARANTINED ? AuditSeverity.CRITICAL : AuditSeverity.WARN,
      detail: `Admin ${auth.session.name} mengubah status isolasi faskes ${updated.nama} (${faskesId}) menjadi ${newStatus}.`,
    });

    safeRevalidate("/admin/faskes");
    safeRevalidate("/admin");
    safeRevalidate("/pasien/faskes");

    return {
      success: true,
      message: `Status isolasi faskes berhasil diperbarui menjadi ${newStatus} di basis data.`,
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mengubah status faskes: ${msg}` };
  }
}
