"use server";

import { prisma } from "@/lib/db/prisma";
import {
  AccountStatus,
  AuditAction,
  AuditSeverity,
  FaskesStatus,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { requireSession } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

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

    safeRevalidate(["/admin/siem-monitor", "/admin"]);

    return { success: true, message: `Event uji ${payload.action} dicatat di PostgreSQL.` };
  } catch (err) {
    console.warn("Simulate SIEM Error:", err);
    return { success: false, message: "Gagal mencatat simulasi SIEM ke PostgreSQL." };
  }
}
