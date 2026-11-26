"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  AccountStatus,
  AuditAction,
  AuditSeverity,
  FaskesStatus,
  FaskesType,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { requireSession } from "@/features/auth/guard";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Diabaikan di luar request context
  }
}

/**
 * Server Action: Ringkasan Eksekutif Dashboard Admin dari PostgreSQL (100% DB)
 */
export async function getAdminDashboardSummaryServerAction() {
  const auth = await requireSession(["admin"], "getAdminDashboardSummary");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: null };
  }

  try {
    const [
      kycPendingCount,
      kydPendingCount,
      idorCount,
      quarantinedFaskesCount,
      recentLogs,
      openTickets,
      faskesList,
    ] = await Promise.all([
      prisma.kycSubmission.count({ where: { status: AccountStatus.PENDING } }),
      prisma.kydSubmission.count({ where: { status: AccountStatus.PENDING } }),
      prisma.securityAuditLog.count({ where: { action: AuditAction.IDOR_BLOCKED } }),
      prisma.faskes.count({ where: { status: FaskesStatus.QUARANTINED } }),
      prisma.securityAuditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 8,
      }),
      prisma.troubleTicket.findMany({
        where: { status: { not: TicketStatus.RESOLVED } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.faskes.findMany({
        orderBy: { nama: "asc" },
        select: { id: true, nama: true, status: true },
      }),
    ]);

    return {
      success: true,
      data: {
        kycPendingCount,
        kydPendingCount,
        idorCount,
        quarantinedFaskesCount,
        faskesList,
        recentLogs: recentLogs.map((l) => ({
          id: l.id,
          timestamp: l.timestamp.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          actorId: l.actorId || "-",
          actorName: l.actorName,
          actorRole: l.actorRole.toUpperCase(),
          action: l.action,
          targetResource: l.targetResource,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          severity: l.severity,
          detail: l.detail,
        })),
        openTickets: openTickets.map((t) => ({
          id: t.id,
          pengirimId: t.reporterId || "-",
          pengirimNama: t.reporterName,
          pengirimRole: t.reporterRole.toUpperCase(),
          kategori: t.kategori,
          judul: t.judul,
          deskripsi: t.deskripsi,
          status: t.status,
          createdAt: t.createdAt.toLocaleString("id-ID"),
        })),
      },
    };
  } catch (err) {
    console.warn("Admin Dashboard Summary Error:", err);
    return { success: false, message: "Gagal memuat ringkasan Admin dari PostgreSQL.", data: null };
  }
}

/**
 * Server Action: Mengambil Log SIEM Forensik langsung dari PostgreSQL
 */
export async function getSiemAuditLogsServerAction() {
  const auth = await requireSession(["admin"], "getSiemAuditLogs");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const logs = await prisma.securityAuditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    return {
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp.toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        actorId: l.actorId || "-",
        actorName: l.actorName,
        actorRole: l.actorRole.toUpperCase(),
        action: l.action,
        targetResource: l.targetResource,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        severity: l.severity,
        detail: l.detail,
      })),
    };
  } catch (err) {
    console.warn("Get SIEM Audit Logs Error:", err);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Simulasi Event Keamanan ke Tabel `security_audit_logs` PostgreSQL
 */
export async function simulateSiemSecurityEventServerAction(
  type: "IDOR" | "HMAC" | "BREAK_GLASS"
) {
  const auth = await requireSession(["admin"], `simulateSiem:${type}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const payload =
      type === "IDOR"
        ? {
            action: AuditAction.IDOR_BLOCKED,
            targetResource: "/api/rme/record-P102-09",
            severity: AuditSeverity.CRITICAL,
            detail:
              "[Simulasi Uji SIEM] BOLA Guard: Memblokir percobaan akses langsung rekam medis pasien P-102 tanpa consent aktif.",
          }
        : type === "HMAC"
        ? {
            action: AuditAction.HMAC_MISMATCH,
            targetResource: "/api/sync/batch",
            severity: AuditSeverity.CRITICAL,
            detail:
              "[Simulasi Uji SIEM] Deteksi Kripto: Nilai HMAC-SHA256 tidak valid pada transmisi payload RME. Dekripsi diblokir (Fail-Closed).",
          }
        : {
            action: AuditAction.BREAK_GLASS_ACCESS,
            targetResource: "/api/rme/break-glass/P-104",
            severity: AuditSeverity.CRITICAL,
            detail:
              "[Simulasi Uji SIEM] BREAK-GLASS EMERGENCY ACCESS: Aktivasi darurat IGD tercatat dan diteruskan ke regulator.",
          };

    await prisma.securityAuditLog.create({
      data: {
        actorId: auth.session.id,
        actorName: `${auth.session.name} (Uji SIEM)`,
        actorRole: UserRole.admin,
        action: payload.action,
        targetResource: payload.targetResource,
        ipAddress: "127.0.0.1 (Admin SIEM Console)",
        userAgent: "JagaMedis SIEM Simulator",
        severity: payload.severity,
        detail: payload.detail,
      },
    });

    safeRevalidate("/admin/siem-monitor");
    safeRevalidate("/admin");

    return { success: true, message: `Event uji ${payload.action} dicatat di PostgreSQL.` };
  } catch (err) {
    console.warn("Simulate SIEM Error:", err);
    return { success: false, message: "Gagal mencatat simulasi SIEM ke PostgreSQL." };
  }
}

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
    });

    safeRevalidate("/admin/verifikasi-kyd");
    safeRevalidate("/admin");

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

    safeRevalidate("/admin/verifikasi-kyd");
    safeRevalidate("/admin");

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

    safeRevalidate("/admin/faskes");
    safeRevalidate("/pasien/faskes");

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

    safeRevalidate("/admin/incident-center");
    safeRevalidate("/admin");
    safeRevalidate("/pasien/tiket-kendala");

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
