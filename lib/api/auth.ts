import { NextRequest, NextResponse } from "next/server";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { getSessionFromStoreAsync } from "@/lib/auth/sessionStore";
import {
  NormalizedRole,
  getAuthenticatedSession,
  recordSecurityAuditBestEffort,
} from "@/features/auth/guard";
import { ProblemDetails, problemResponse } from "@/lib/api/problem";

export type ApiAuthResult =
  | {
      ok: true;
      session: UserSession;
      role: NormalizedRole;
      token: string;
    }
  | {
      ok: false;
      response: NextResponse<ProblemDetails>;
    };

/**
 * Guard autentikasi & RBAC terpusat khusus Route Handler `/api/v1/*`.
 * Membaca cookie HTTP-Only `resilio_session_token` dari `NextRequest` (atau fallback `next/headers`),
 * memverifikasi terhadap PostgreSQL `sessions`, dan mengembalikan respons RFC 9457 jika gagal.
 */
export async function requireApiSession(
  request: NextRequest,
  allowedRoles?: NormalizedRole[],
  resourceLabel?: string
): Promise<ApiAuthResult> {
  const instance = request.nextUrl.pathname;
  const label = resourceLabel || instance;

  let session: UserSession | null = null;
  let role: NormalizedRole = "pasien";
  let token = request.cookies.get("resilio_session_token")?.value || "";

  if (token) {
    session = await getSessionFromStoreAsync(token);
    if (session) {
      role = normalizeRole(session.role);
    }
  } else {
    const fallbackAuth = await getAuthenticatedSession();
    if (fallbackAuth) {
      session = fallbackAuth.session;
      role = fallbackAuth.role;
      token = fallbackAuth.token;
    }
  }

  if (!session) {
    return {
      ok: false,
      response: problemResponse({
        slug: "unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Sesi tidak ditemukan, tidak sah, atau telah kedaluwarsa. Silakan autentikasi ulang.",
        instance,
      }),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "JagaMedis API v1 Client";

    await recordSecurityAuditBestEffort({
      actorId: session.id,
      actorName: session.name,
      actorRole: role,
      action: AuditAction.IDOR_BLOCKED,
      targetResource: label,
      severity: AuditSeverity.CRITICAL,
      ipAddress,
      userAgent,
      detail: `RBAC API Guard: Pengguna ${session.name} (${role}) mencoba mengakses ${label} yang hanya diizinkan untuk peran [${allowedRoles.join(", ")}].`,
    });

    return {
      ok: false,
      response: problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Peran akun Anda tidak memiliki wewenang untuk mengakses resource atau aksi ini.",
        instance,
      }),
    };
  }

  return {
    ok: true,
    session,
    role,
    token,
  };
}

export function extractRequestMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1",
    userAgent: request.headers.get("user-agent") || "JagaMedis API v1 Client",
  };
}
