"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { TroubleTicketSchema } from "@/lib/validations/patient";
import { TicketCategory, TicketStatus, UserRole } from "@prisma/client";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan jika dieksekusi di luar request context Next.js
  }
}

export interface TicketActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Pembuatan Tiket Kendala Sistem & Sengketa Data Medis
 */
export async function createTroubleTicketServerAction(
  rawData: Record<string, unknown>
): Promise<TicketActionResponse> {
  const validation = TroubleTicketSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format laporan kendala tidak valid.",
    };
  }

  const { kategori, judul, deskripsi } = validation.data;
  const reporterId = String(rawData.reporterId || "P-101");
  const reporterName = String(rawData.reporterName || "Budi Santoso");
  const ticketId = `TCK-${Date.now().toString().slice(-4)}`;

  try {
    const created = await prisma.troubleTicket.create({
      data: {
        id: ticketId,
        reporterId,
        reporterName,
        reporterRole: UserRole.pasien,
        faskesId: "FAS-01",
        kategori: kategori as TicketCategory,
        judul,
        deskripsi,
        status: TicketStatus.OPEN,
      },
    });

    safeRevalidate("/pasien/tiket-kendala");
    safeRevalidate("/admin/incident-center");

    return {
      success: true,
      message: "Laporan kendala berhasil dikirim dan dicatat di basis data.",
      data: created,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    return { success: false, message: `Gagal membuat tiket kendala: ${msg}` };
  }
}

/**
 * Server Action: Mengambil Daftar Seluruh Tiket Kendala dari PostgreSQL
 */
export async function getTroubleTicketsServerAction() {
  try {
    const tickets = await prisma.troubleTicket.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: tickets };
  } catch (error: unknown) {
    console.warn("Get Tickets Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Resolusi / Penutupan Tiket Kendala oleh Admin
 */
export async function resolveTroubleTicketServerAction(
  ticketId: string
): Promise<TicketActionResponse> {
  try {
    const updated = await prisma.troubleTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    safeRevalidate("/admin/incident-center");
    safeRevalidate("/pasien/tiket-kendala");

    return {
      success: true,
      message: "Tiket kendala berhasil diselesaikan di basis data.",
      data: updated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal menyelesaikan tiket: ${msg}` };
  }
}
