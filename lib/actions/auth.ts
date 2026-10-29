"use server";

import { cookies } from "next/headers";
import { DEMO_USERS, UserSession, normalizeRole } from "@/lib/auth/auth";
import { LoginSchema } from "@/lib/validations/auth";
import { registerSession, revokeSession, getSessionFromStore } from "@/lib/auth/sessionStore";

export interface ServerAuthResponse {
  success: boolean;
  message?: string;
  session?: UserSession;
  targetRole?: string;
}

/**
 * Server Action: Login Pengguna & Penerbitan Cookie Sesi HTTP-Only
 * Menerapkan 4 atribut cookie keamanan: HttpOnly, Secure, SameSite=Lax, Max-Age=14400
 */
export async function loginServerAction(
  identifier: string,
  password: string
): Promise<ServerAuthResponse> {
  // 1. Validasi Bentuk Kredensial via Skema Zod
  const validation = LoginSchema.safeParse({ identifier, password });
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format masukan tidak valid.",
    };
  }

  const cleanId = identifier.trim().toLowerCase();

  // 2. Verifikasi Kredensial Pengguna
  const user = DEMO_USERS.find(
    (u) =>
      (u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        (u.nik && u.nik === cleanId)) &&
      u.password === password
  );

  if (!user) {
    return {
      success: false,
      message: "Kredensial atau NIK tidak valid. Periksa kembali atau gunakan tombol demo.",
    };
  }

  const session: UserSession = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    nik: user.nik,
    strNumber: user.strNumber,
    sipNumber: user.sipNumber,
    specialization: user.specialization,
    faskesId: user.faskesId,
    faskesName: user.faskesName,
    status: user.status,
    allergies: user.allergies,
    bloodType: user.bloodType,
    phone: user.phone,
    encryptionKeyHex: user.encryptionKeyHex,
    posisiStaf: user.posisiStaf,
  };

  // 3. Bangkitkan Token Sesi Acak CSPRNG (Opaque Session Token)
  const sessionToken = crypto.randomUUID();
  const maxAge = 14400; // 4 Jam (14.400 detik)

  // 4. Catat Sesi ke Stateful Session Store Server
  registerSession(sessionToken, session, maxAge);

  // 5. Terbitkan Cookie Sesi Melalui Header Set-Cookie Resmi
  const cookieStore = await cookies();

  // Cookie 1: Token Sesi Terenkripsi / Opaque (HttpOnly, Secure, SameSite=Lax, Max-Age)
  cookieStore.set("resilio_session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  // Cookie 2: Peran Pengguna Publik (Bisa dibaca klien untuk keperluan routing visual)
  cookieStore.set("resilio_user_role", normalizeRole(session.role), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  const targetRole = normalizeRole(session.role);

  return {
    success: true,
    session,
    targetRole,
  };
}

/**
 * Server Action: Logout Pengguna & Pemusnahan Cookie Sesi
 * Menerapkan Stateful Session Invalidation dan penghapusan cookie via Max-Age=0
 */
export async function logoutServerAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("resilio_session_token")?.value;

  if (token) {
    revokeSession(token);
  }

  // Hapus cookie sesi dari peramban
  cookieStore.delete("resilio_session_token");
  cookieStore.delete("resilio_user_role");

  return { success: true };
}

/**
 * Mengambil sesi server yang valid berdasarkan cookie aktif
 */
export async function getServerSessionData(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("resilio_session_token")?.value;

  if (!token) return null;

  return getSessionFromStore(token);
}
