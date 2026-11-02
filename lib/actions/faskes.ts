"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { FaskesStatus } from "@prisma/client";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js
  }
}

export interface FaskesActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Mengambil Daftar Seluruh Faskes & Dokter Praktik dari PostgreSQL
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
 * Mengubah status faskes menjadi QUARANTINED di PostgreSQL
 */
export async function toggleFaskesKillSwitchServerAction(
  faskesId: string,
  newStatus: FaskesStatus
): Promise<FaskesActionResponse> {
  try {
    const updated = await prisma.faskes.update({
      where: { id: faskesId },
      data: { status: newStatus },
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
