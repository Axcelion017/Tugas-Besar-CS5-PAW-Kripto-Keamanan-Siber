"use server";

import { cookies } from "next/headers";
import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { LoginSchema } from "@/lib/validations/auth";
import {
  registerSessionAsync,
  revokeSessionAsync,
  getSessionFromStoreAsync,
} from "@/lib/auth/sessionStore";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  checkRateLimit,
  resetRateLimit,
  DUMMY_BCRYPT_HASH,
  UNIFORM_LOGIN_ERROR,
} from "@/lib/auth/rateLimit";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus, AuditAction, AuditSeverity } from "@prisma/client";
import bcrypt from "bcryptjs";

export interface ServerAuthResponse {
  success: boolean;
  message?: string;
  session?: UserSession;
  targetRole?: string;
}

export async function loginServerAction(
  identifier: string,
  password: string
): Promise<ServerAuthResponse> {
  const validation = LoginSchema.safeParse({ identifier, password });
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format masukan tidak valid.",
    };
  }

  const cleanId = identifier.trim().toLowerCase();
  const rateLimitKey = `login:action:${cleanId}`;
  const rateCheck = checkRateLimit(rateLimitKey, { maxAttempts: 10, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    await recordSecurityAuditBestEffort({
      actorId: "ANON",
      actorName: cleanId.slice(0, 40),
      actorRole: "pasien",
      action: AuditAction.IDOR_BLOCKED,
      targetResource: "/login",
      severity: AuditSeverity.WARN,
      detail: `Rate Limit Login dipicu untuk identifier '${cleanId.slice(0, 40)}'. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
    });
    return {
      success: false,
      message: `Terlalu banyak percobaan masuk. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
    };
  }

  let userSession: UserSession | null = null;

  try {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanId },
          { email: cleanId },
          { patient: { nik: cleanId } },
          { doctor: { strNumber: cleanId } },
        ],
      },
      include: {
        patient: true,
        doctor: { include: { faskes: { select: { nama: true } } } },
        staffMember: { include: { faskes: { select: { nama: true } } } },
      },
    });

    if (!dbUser) {
      // Pembandingan dummy Bcrypt agar waktu respons setara (CWE-204 / OWASP ASVS V2.2.2)
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return {
        success: false,
        message: UNIFORM_LOGIN_ERROR,
      };
    }

    const isBcryptHash =
      dbUser.passwordHash.startsWith("$2a$") || dbUser.passwordHash.startsWith("$2b$");
    const isPasswordMatch = isBcryptHash
      ? await bcrypt.compare(password, dbUser.passwordHash)
      : false;

    if (!isPasswordMatch) {
      return {
        success: false,
        message: UNIFORM_LOGIN_ERROR,
      };
    }

    if (dbUser.status === AccountStatus.SUSPENDED || dbUser.status === AccountStatus.REJECTED) {
      return {
        success: false,
        message: "Akun Anda dinonaktifkan atau permohonan verifikasi ditolak oleh Admin Kemenkes.",
      };
    }

    resetRateLimit(rateLimitKey);

    const roleStr = dbUser.role.toString();
    const role: UserSession["role"] =
      roleStr === "nakes"
        ? "nakes"
        : roleStr === "pasien"
        ? "pasien"
        : (roleStr as "admin" | "staf");

    const displayName =
      dbUser.doctor?.name ||
      dbUser.patient?.name ||
      dbUser.staffMember?.name ||
      dbUser.username;

    userSession = {
      id: dbUser.id,
      name: displayName,
      username: dbUser.username,
      role,
      nik: dbUser.patient?.nik,
      strNumber: dbUser.doctor?.strNumber,
      sipNumber: dbUser.doctor?.sipNumber,
      specialization: dbUser.doctor?.specialty,
      faskesId: dbUser.doctor?.faskesId || dbUser.staffMember?.faskesId,
      faskesName: dbUser.doctor?.faskes?.nama || dbUser.staffMember?.faskes?.nama,
      status: dbUser.status === AccountStatus.VERIFIED ? "VERIFIED" : "PENDING",
      allergies: dbUser.patient?.allergies || [],
      bloodType: dbUser.patient?.bloodType || undefined,
      phone: dbUser.patient?.emergencyContactPhone || undefined,
      encryptionKeyHex: dbUser.patient?.encryptionKeyHex || undefined,
      posisiStaf: dbUser.staffMember?.posisi as UserSession["posisiStaf"],
    };
  } catch (dbErr) {
    console.error("[Auth] Prisma User Login Lookup error:", dbErr);
    return {
      success: false,
      message: "Layanan autentikasi basis data sedang tidak tersedia. Coba beberapa saat lagi.",
    };
  }

  const sessionToken = crypto.randomUUID();
  const maxAge = 14400; // 4 Jam

  await registerSessionAsync(sessionToken, userSession, maxAge);
  const targetRole = normalizeRole(userSession.role);

  await recordSecurityAuditBestEffort({
    actorId: userSession.id,
    actorName: userSession.name,
    actorRole: targetRole,
    action: AuditAction.LOGIN,
    targetResource: "/login",
    severity: AuditSeverity.INFO,
    detail: `Autentikasi berhasil untuk ${userSession.name} (${targetRole}) dengan sesi persisten HTTP-Only.`,
  });

  try {
    const cookieStore = await cookies();
    cookieStore.set("resilio_session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    cookieStore.delete("resilio_user_role");
  } catch {
    // Diabaikan di luar request context
  }

  return { success: true, session: userSession, targetRole };
}

export async function logoutServerAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("resilio_session_token")?.value;

  if (token) {
    await revokeSessionAsync(token);
  }

  cookieStore.delete("resilio_session_token");
  cookieStore.delete("resilio_user_role");

  return { success: true };
}

export async function getServerSessionData(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("resilio_session_token")?.value;
  if (!token) return null;
  return getSessionFromStoreAsync(token);
}
