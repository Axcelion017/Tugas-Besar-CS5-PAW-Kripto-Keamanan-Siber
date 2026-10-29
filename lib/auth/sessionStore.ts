import { UserSession } from "@/lib/auth/auth";

export interface SessionRecord {
  session: UserSession;
  createdAt: number;
  expiresAt: number;
  isRevoked: boolean;
}

// Global server memory session map
// Gunakan globalThis agar state bertahan saat Hot Module Reloading (HMR) di mode development
const globalForSessions = globalThis as unknown as {
  serverActiveSessions: Map<string, SessionRecord> | undefined;
};

export const SERVER_ACTIVE_SESSIONS =
  globalForSessions.serverActiveSessions ?? new Map<string, SessionRecord>();

if (process.env.NODE_ENV !== "production") {
  globalForSessions.serverActiveSessions = SERVER_ACTIVE_SESSIONS;
}

export function registerSession(token: string, session: UserSession, maxAge: number = 14400): void {
  SERVER_ACTIVE_SESSIONS.set(token, {
    session,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge * 1000,
    isRevoked: false,
  });
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

export function revokeSession(token: string): void {
  const record = SERVER_ACTIVE_SESSIONS.get(token);
  if (record) {
    record.isRevoked = true;
  }
  SERVER_ACTIVE_SESSIONS.delete(token);
}

export function getSessionFromStore(token: string): UserSession | null {
  if (!isSessionValid(token)) return null;
  return SERVER_ACTIVE_SESSIONS.get(token)?.session ?? null;
}
