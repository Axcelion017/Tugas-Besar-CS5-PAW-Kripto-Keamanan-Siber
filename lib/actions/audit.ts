"use server";

import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, UserRole } from "@prisma/client";

export interface AuditLogActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Server Action: Mengambil Jejak Notifikasi Akses Medis (Audit Log) untuk Pasien
 * Menampilkan aktivitas siapa dan faskes apa yang mengakses/merujuk data medis pasien
 */
export async function getPatientAuditLogsServerAction(patientId: string = "P-101") {
  try {
    // Ambil log yang menargetkan pasien ini atau aktornya adalah pasien ini
    const logs = await prisma.securityAuditLog.findMany({
      where: {
        OR: [
          { targetResource: { contains: patientId } },
          { actorId: patientId },
          { detail: { contains: patientId } },
        ],
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    return { success: true, data: logs };
  } catch (error: unknown) {
    console.warn("Get Patient Audit Logs Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mencatat Notifikasi Kejadian Akses Baru ke Basis Data PostgreSQL
 */
export async function createAuditLogServerAction(params: {
  actorId?: string;
  actorName: string;
  actorRole: "pasien" | "nakes" | "staf" | "admin";
  action: AuditAction;
  targetResource: string;
  severity?: AuditSeverity;
  detail: string;
}): Promise<AuditLogActionResponse> {
  const {
    actorId,
    actorName,
    actorRole,
    action,
    targetResource,
    severity = AuditSeverity.INFO,
    detail,
  } = params;

  try {
    const roleMap: Record<string, UserRole> = {
      pasien: UserRole.pasien,
      nakes: UserRole.nakes,
      staf: UserRole.staf,
      admin: UserRole.admin,
    };

    const saved = await prisma.securityAuditLog.create({
      data: {
        actorId,
        actorName,
        actorRole: roleMap[actorRole] || UserRole.pasien,
        action,
        targetResource,
        ipAddress: "127.0.0.1",
        userAgent: "Resilio-Health Web Client",
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
