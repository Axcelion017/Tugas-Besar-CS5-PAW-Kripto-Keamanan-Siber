"use server";

import { prisma } from "@/lib/db/prisma";
import { TroubleTicketSchema } from "@/lib/validations/patient";
import { TicketCategory, TicketStatus, UserRole } from "@prisma/client";
import { requireSession } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

export interface TicketActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Pembuatan Tiket Kendala Sistem & Sengketa Data Medis
 * Identitas pelapor diambil langsung dari sesi server terverifikasi.
 */
export async function createTroubleTicketServerAction(
  rawData: Record<string, unknown>
): Promise<TicketActionResponse> {
  const auth = await requireSession(["pasien", "staf", "nakes", "admin"], "createTroubleTicket");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const validation = TroubleTicketSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format laporan kendala tidak valid.",
    };
  }

  const { kategori, judul, deskripsi } = validation.data;
  const ticketId = `TCK-${Date.now().toString().slice(-6)}`;

  const roleMap: Record<string, UserRole> = {
    pasien: UserRole.pasien,
    nakes: UserRole.nakes,
    staf: UserRole.staf,
    admin: UserRole.admin,
  };

  try {
    const created = await prisma.troubleTicket.create({
      data: {
        id: ticketId,
        reporterId: auth.session.id,
        reporterName: auth.session.name,
        reporterRole: roleMap[auth.role] || UserRole.pasien,
        faskesId: auth.session.faskesId || "FAS-01",
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
 * Server Action: Mengambil Daftar Tiket Kendala dari PostgreSQL
 * Non-admin hanya melihat tiket yang dibuat oleh dirinya sendiri (Anti-BOLA).
 */
export async function getTroubleTicketsServerAction() {
  const auth = await requireSession(["pasien", "staf", "nakes", "admin"], "getTroubleTickets");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const tickets = await prisma.troubleTicket.findMany({
      where: auth.role === "admin" ? {} : { reporterId: auth.session.id },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: tickets };
  } catch (error: unknown) {
    console.warn("Get Tickets Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Resolusi / Penutupan Tiket Kendala — khusus Admin Regulator
 */
export async function resolveTroubleTicketServerAction(
  ticketId: string
): Promise<TicketActionResponse> {
  const auth = await requireSession(["admin"], `resolveTroubleTicket:${ticketId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

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
