"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, UserRole } from "@prisma/client";
import { requireSession } from "@/features/auth/guard";

export interface AuditLogActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Mengambil Jejak Notifikasi Akses Medis (Audit Log) untuk Pasien
 * Pasien hanya dapat melihat audit log miliknya sendiri (Anti-BOLA).
 */
export async function getPatientAuditLogsServerAction(patientId?: string) {
  const auth = await requireSession(["pasien", "admin"], "getPatientAuditLogs");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  const targetPatientId = auth.role === "admin" && patientId ? patientId : auth.session.id;

  try {
    const logs = await prisma.securityAuditLog.findMany({
      where: {
        OR: [
          { targetResource: { contains: targetPatientId } },
          { actorId: targetPatientId },
          { detail: { contains: targetPatientId } },
        ],
      },
      orderBy: { timestamp: "desc" },
      take: 30,
    });

    return { success: true, data: logs };
  } catch (error: unknown) {
    console.warn("Get Patient Audit Logs Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mencatat Notifikasi Kejadian Akses / Keamanan Baru ke PostgreSQL
 * Identitas aktor (actorId, actorName, actorRole) dikunci dari sesi server terverifikasi
 * agar klien tidak dapat memalsukan identitas log SIEM.
 */
export async function createAuditLogServerAction(params: {
  actorId?: string;
  actorName?: string;
  actorRole?: "pasien" | "nakes" | "staf" | "admin";
  action: AuditAction;
  targetResource: string;
  severity?: AuditSeverity;
  detail: string;
}): Promise<AuditLogActionResponse> {
  const auth = await requireSession(["pasien", "nakes", "staf", "admin"], "createAuditLog");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const { action, targetResource, severity = AuditSeverity.INFO, detail } = params;

  try {
    const roleMap: Record<string, UserRole> = {
      pasien: UserRole.pasien,
      nakes: UserRole.nakes,
      staf: UserRole.staf,
      admin: UserRole.admin,
    };

    const saved = await prisma.securityAuditLog.create({
      data: {
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: roleMap[auth.role] || UserRole.pasien,
        action,
        targetResource,
        ipAddress: "127.0.0.1",
        userAgent: "JagaMedis Web Client",
        severity,
        detail,
      },
    });

    return { success: true, data: saved };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mencatat log audit: ${msg}` };
  }
}
