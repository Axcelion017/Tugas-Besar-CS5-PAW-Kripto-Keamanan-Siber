"use server";

import { prisma } from "@/lib/db/prisma";
import { AccountStatus, FaskesStatus, FaskesType, TicketStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { requireSession } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

/**
 * Server Action: Mengambil Daftar Pengajuan e-KYD (STR/SIP Dokter) dari PostgreSQL
 */
export async function getKydSubmissionsServerAction() {
  const auth = await requireSession(["admin"], "getKydSubmissions");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const list = await prisma.kydSubmission.findMany({
      include: {
        user: {
          include: {
            doctor: { include: { faskes: { select: { nama: true } } } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return {
      success: true,
      data: list.map((k) => ({
        id: k.id,
        userId: k.userId,
        namaLengkap: k.namaLengkap,
        nik: k.nik,
        strNumber: k.strNumber,
        sipNumber: k.sipNumber,
        spesialisasi: k.spesialisasi,
        faskesNama: k.user?.doctor?.faskes?.nama || "Faskes Terdaftar",
        dokumenStrUrl: k.dokumenStrUrl,
        watermarkText: k.watermarkText,
        submittedAt: k.submittedAt.toLocaleString("id-ID"),
        status:
          k.status === AccountStatus.VERIFIED
            ? ("VERIFIED" as const)
            : k.status === AccountStatus.REJECTED || k.status === AccountStatus.SUSPENDED
            ? ("REJECTED" as const)
            : ("PENDING" as const),
        alasanPenolakan: k.alasanPenolakan || undefined,
      })),
    };
  } catch (err) {
    console.warn("Get KYD Submissions Error:", err);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Admin Menyetujui e-KYD Dokter (PostgreSQL Transaction)
 */
export async function approveKydServerAction(submissionId: string) {
  const auth = await requireSession(["admin"], `approveKyd:${submissionId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const kyd = await prisma.kydSubmission.findUnique({ where: { id: submissionId } });
    if (!kyd) {
      return { success: false, message: "Pengajuan e-KYD tidak ditemukan di database." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.kydSubmission.update({
        where: { id: submissionId },
        data: { status: AccountStatus.VERIFIED, verifiedAt: new Date() },
      });
      await tx.user.update({
        where: { id: kyd.userId },
        data: { status: AccountStatus.VERIFIED },
      });
      await tx.doctor.updateMany({
        where: { userId: kyd.userId },
        data: { isActive: true },
      });
    });

    safeRevalidate(["/admin/verifikasi-kyd", "/admin"]);

    return {
      success: true,
      message: `Kredensial STR/SIP ${kyd.namaLengkap} berhasil disetujui di PostgreSQL.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan basis data";
    return { success: false, message: `Gagal menyetujui e-KYD: ${msg}` };
  }
}

/**
 * Server Action: Admin Menolak e-KYD Dokter (PostgreSQL Transaction, status REJECTED)
 */
export async function rejectKydServerAction(submissionId: string, reason: string) {
  const auth = await requireSession(["admin"], `rejectKyd:${submissionId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const kyd = await prisma.kydSubmission.findUnique({ where: { id: submissionId } });
    if (!kyd) {
      return { success: false, message: "Pengajuan e-KYD tidak ditemukan." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.kydSubmission.update({
        where: { id: submissionId },
        data: {
          status: AccountStatus.REJECTED,
          alasanPenolakan: reason || "Nomor STR/SIP tidak ditemukan pada registri KKI.",
          verifiedAt: new Date(),
        },
      });
      await tx.user.update({
        where: { id: kyd.userId },
        data: { status: AccountStatus.REJECTED },
      });
    });

    safeRevalidate(["/admin/verifikasi-kyd", "/admin"]);

    return { success: true, message: `Pengajuan e-KYD ${kyd.namaLengkap} ditolak.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan basis data";
    return { success: false, message: `Gagal menolak e-KYD: ${msg}` };
  }
}

/**
 * Server Action: Admin Mendaftarkan Faskes Resmi Baru ke PostgreSQL
 */
export async function createFaskesServerAction(params: {
  nama: string;
  tipe: "Rumah Sakit" | "Klinik Pratama" | "Puskesmas";
  kota: string;
  alamat: string;
  kontak: string;
}) {
  const auth = await requireSession(["admin"], "createFaskes");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const nama = (params.nama || "").trim();
  if (nama.length < 3) {
    return { success: false, message: "Nama fasilitas kesehatan minimal 3 karakter." };
  }

  const tipeMap: Record<string, FaskesType> = {
    "Rumah Sakit": FaskesType.RUMAH_SAKIT,
    "Klinik Pratama": FaskesType.KLINIK_PRATAMA,
    Puskesmas: FaskesType.PUSKESMAS,
  };

  try {
    const id = `FAS-${randomInt(100, 999)}`;
    const kodeFaskes = `RS-${randomInt(1000, 9999)}`;
    const created = await prisma.faskes.create({
      data: {
        id,
        kodeFaskes,
        nama,
        tipe: tipeMap[params.tipe] || FaskesType.RUMAH_SAKIT,
        alamat: params.alamat?.trim() || "Jl. Kesehatan Nasional",
        kota: params.kota?.trim() || "Yogyakarta",
        kontak: params.kontak?.trim() || "(0274) 123456",
        spesialisasiList: ["Dokter Umum", "Kesehatan Ibu & Anak"],
        kategoriPenyakit: ["Penyakit Umum", "ISPA", "Pemeriksaan Rutin"],
        status: FaskesStatus.ACTIVE,
      },
    });

    safeRevalidate(["/admin/faskes", "/pasien/faskes"]);

    return {
      success: true,
      message: `Faskes ${created.nama} (${created.id}) berhasil didaftarkan ke PostgreSQL.`,
      data: created,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan server";
    return { success: false, message: `Gagal mendaftarkan faskes baru: ${msg}` };
  }
}

/**
 * Server Action: Admin Memperbarui Status Tiket Kendala di PostgreSQL
 */
export async function updateTroubleTicketStatusServerAction(
  ticketId: string,
  nextStatus: "OPEN" | "INVESTIGATING" | "RESOLVED"
) {
  const auth = await requireSession(["admin"], `updateTicketStatus:${ticketId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const statusMap: Record<string, TicketStatus> = {
      OPEN: TicketStatus.OPEN,
      INVESTIGATING: TicketStatus.INVESTIGATING,
      RESOLVED: TicketStatus.RESOLVED,
    };

    const updated = await prisma.troubleTicket.update({
      where: { id: ticketId },
      data: {
        status: statusMap[nextStatus] || TicketStatus.OPEN,
        resolvedAt: nextStatus === "RESOLVED" ? new Date() : null,
      },
    });

    safeRevalidate(["/admin/incident-center", "/admin", "/pasien/tiket-kendala"]);

    return {
      success: true,
      message: `Status tiket ${ticketId} berhasil diperbarui menjadi ${nextStatus} di PostgreSQL.`,
      data: updated,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kesalahan basis data";
    return { success: false, message: `Gagal memperbarui status tiket: ${msg}` };
  }
}
