import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Prisma, UserRole } from "@prisma/client";

export interface SessionRecord {
  session: UserSession;
  createdAt: number;
  expiresAt: number;
  isRevoked: boolean;
}

// L1 Write-Through Cache di memori server (PostgreSQL tabel `sessions` sebagai L2 persisten)
const globalForSessions = globalThis as unknown as {
  serverActiveSessions: Map<string, SessionRecord> | undefined;
};

export const SERVER_ACTIVE_SESSIONS =
  globalForSessions.serverActiveSessions ?? new Map<string, SessionRecord>();

if (process.env.NODE_ENV !== "production") {
  globalForSessions.serverActiveSessions = SERVER_ACTIVE_SESSIONS;
}

function toPrismaUserRole(role: UserSession["role"]): UserRole {
  const norm = normalizeRole(role);
  if (norm === "nakes") return UserRole.nakes;
  if (norm === "staf") return UserRole.staf;
  if (norm === "admin") return UserRole.admin;
  return UserRole.pasien;
}

export function registerSession(token: string, session: UserSession, maxAge: number = 14400): void {
  SERVER_ACTIVE_SESSIONS.set(token, {
    session,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge * 1000,
    isRevoked: false,
  });
}

export async function registerSessionAsync(
  token: string,
  session: UserSession,
  maxAge: number = 14400
): Promise<void> {
  const now = Date.now();
  const expiresAtDate = new Date(now + maxAge * 1000);

  registerSession(token, session, maxAge);

  try {
    await prisma.session.upsert({
      where: { token },
      update: {
        userId: session.id,
        role: toPrismaUserRole(session.role),
        payload: session as unknown as Prisma.InputJsonValue,
        expiresAt: expiresAtDate,
        isRevoked: false,
      },
      create: {
        token,
        userId: session.id,
        role: toPrismaUserRole(session.role),
        payload: session as unknown as Prisma.InputJsonValue,
        expiresAt: expiresAtDate,
        isRevoked: false,
      },
    });
  } catch (err) {
    console.warn("[SessionStore] Gagal menyimpan sesi ke PostgreSQL:", err);
  }
}

export function isSessionValid(token: string): boolean {
  if (!token) return false;
  const record = SERVER_ACTIVE_SESSIONS.get(token);
  if (!record) return false;
  if (record.isRevoked || Date.now() > record.expiresAt) {
    SERVER_ACTIVE_SESSIONS.delete(token);
    return false;
  }
  return true;
}

export async function getSessionFromStoreAsync(token: string): Promise<UserSession | null> {
  if (!token) return null;

  // 1. Cek L1 Cache terlebih dahulu
  const cached = SERVER_ACTIVE_SESSIONS.get(token);
  if (cached) {
    if (cached.isRevoked || Date.now() > cached.expiresAt) {
      SERVER_ACTIVE_SESSIONS.delete(token);
    } else {
      return cached.session;
    }
  }

  // 2. Fallback ke L2 PostgreSQL (`sessions`) agar sesi bertahan saat server restart
  try {
    const dbSession = await prisma.session.findUnique({
      where: { token },
    });

    if (!dbSession) return null;

    const expiresMs = dbSession.expiresAt.getTime();
    if (dbSession.isRevoked || Date.now() > expiresMs) {
      SERVER_ACTIVE_SESSIONS.delete(token);
      return null;
    }

    const parsedSession = dbSession.payload as unknown as UserSession;
    if (!parsedSession || !parsedSession.id || !parsedSession.role) {
      return null;
    }

    SERVER_ACTIVE_SESSIONS.set(token, {
      session: parsedSession,
      createdAt: dbSession.createdAt.getTime(),
      expiresAt: expiresMs,
      isRevoked: false,
    });

    return parsedSession;
  } catch (err) {
    console.warn("[SessionStore] Gagal membaca sesi dari PostgreSQL:", err);
    return null;
  }
}

export async function isSessionValidAsync(token: string): Promise<boolean> {
  const session = await getSessionFromStoreAsync(token);
  return session !== null;
}

export function revokeSession(token: string): void {
  const record = SERVER_ACTIVE_SESSIONS.get(token);
  if (record) {
    record.isRevoked = true;
  }
  SERVER_ACTIVE_SESSIONS.delete(token);
}

export async function revokeSessionAsync(token: string): Promise<void> {
  revokeSession(token);
  try {
    await prisma.session.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  } catch (err) {
    console.warn("[SessionStore] Gagal mencabut sesi di PostgreSQL:", err);
  }
}

export function getSessionFromStore(token: string): UserSession | null {
  if (!isSessionValid(token)) return null;
  return SERVER_ACTIVE_SESSIONS.get(token)?.session ?? null;
}
