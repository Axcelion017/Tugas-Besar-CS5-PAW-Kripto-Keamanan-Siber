import { cookies } from "next/headers";
import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { getSessionFromStoreAsync } from "@/lib/auth/sessionStore";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, UserRole } from "@prisma/client";

export type NormalizedRole = "pasien" | "nakes" | "staf" | "admin";

export type AuthGuardResult =
  | {
      ok: true;
      session: UserSession;
      role: NormalizedRole;
      token: string;
    }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

function mapNormalizedRoleToPrisma(role: NormalizedRole): UserRole {
  switch (role) {
    case "nakes":
      return UserRole.nakes;
    case "staf":
      return UserRole.staf;
    case "admin":
      return UserRole.admin;
    default:
      return UserRole.pasien;
  }
}

/**
 * Mencatat jejak keamanan ke tabel `security_audit_logs` secara best-effort
 * tanpa menggagalkan respons utama jika terjadi kendala penulisan log.
 */
export async function recordSecurityAuditBestEffort(params: {
  actorId?: string | null;
  actorName: string;
  actorRole: NormalizedRole;
  action: AuditAction;
  targetResource: string;
  severity?: AuditSeverity;
  detail: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorName: params.actorName,
        actorRole: mapNormalizedRoleToPrisma(params.actorRole),
        action: params.action,
        targetResource: params.targetResource,
        ipAddress: params.ipAddress || "127.0.0.1",
        userAgent: params.userAgent || "JagaMedis Server Guard",
        severity: params.severity ?? AuditSeverity.INFO,
        detail: params.detail,
      },
    });
  } catch (err) {
    console.warn("[SecurityAudit] Best-effort write skipped:", err);
  }
}

/**
 * Membaca sesi autentikasi terverifikasi dari cookie HTTP-Only `resilio_session_token`
 * yang dicocokkan langsung dengan tabel `sessions` di PostgreSQL.
 */
export async function getAuthenticatedSession(): Promise<{
  session: UserSession;
  role: NormalizedRole;
  token: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("resilio_session_token")?.value;
    if (!token) return null;

    const session = await getSessionFromStoreAsync(token);
    if (!session) return null;

    return {
      session,
      role: normalizeRole(session.role),
      token,
    };
  } catch {
    return null;
  }
}

/**
 * Guard Otorisasi Server-Side Terpusat (OWASP ASVS V4.1.1 & V4.2.1).
 * Wajib dipanggil pada baris awal setiap Server Action dan Route Handler sensitif.
 */
export async function requireSession(
  allowedRoles?: NormalizedRole[],
  resourceLabel?: string
): Promise<AuthGuardResult> {
  const auth = await getAuthenticatedSession();

  if (!auth) {
    return {
      ok: false,
      status: 401,
      message: "401 Unauthorized: Sesi tidak sah atau telah kedaluwarsa. Silakan masuk kembali.",
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(auth.role)) {
    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.IDOR_BLOCKED,
      targetResource: resourceLabel || "server-action",
      severity: AuditSeverity.CRITICAL,
      detail: `RBAC Guard: Pengguna ${auth.session.name} (${auth.role}) mencoba mengakses ${resourceLabel || "aksi terproteksi"} yang hanya diizinkan untuk peran [${allowedRoles.join(", ")}].`,
    });

    return {
      ok: false,
      status: 403,
      message: "403 Forbidden: Peran Anda tidak memiliki wewenang untuk melakukan aksi ini.",
    };
  }

  return {
    ok: true,
    session: auth.session,
    role: auth.role,
    token: auth.token,
  };
}
