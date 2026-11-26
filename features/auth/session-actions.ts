"use server";

import { cookies } from "next/headers";
import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { LoginSchema, RegisterPasienSchema, RegisterPasienCepatSchema } from "@/lib/validations/auth";
import {
  registerSessionAsync,
  revokeSessionAsync,
  getSessionFromStoreAsync,
} from "@/lib/auth/sessionStore";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus, AuditAction, AuditSeverity, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

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
      return {
        success: false,
        message: "Kredensial atau NIK tidak valid. Periksa kembali akun Anda.",
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
        message: "Kata sandi salah. Periksa kembali kredensial Anda.",
      };
    }

    if (dbUser.status === AccountStatus.SUSPENDED || dbUser.status === AccountStatus.REJECTED) {
      return {
        success: false,
        message: "Akun Anda dinonaktifkan atau permohonan verifikasi ditolak oleh Admin Kemenkes.",
      };
    }

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

export async function registerPasienServerAction(
  data: Record<string, unknown>
): Promise<{ success: boolean; message: string; kycId?: string; userId?: string }> {
  const validation = RegisterPasienSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format formulir pendaftaran tidak valid.",
    };
  }

  const { nik, namaLengkap, email, password, phone, tanggalLahir, alamat, golDarah, alergi } =
    validation.data;

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { patient: { nik } }] },
    });

    if (existingUser) {
      return {
        success: false,
        message: "NIK atau alamat email sudah terdaftar di sistem JagaMedis.",
      };
    }

    const userId = `P-${Date.now().toString().slice(-6)}`;
    const kycId = `KYC-${Date.now().toString().slice(-6)}`;
    const mrn = `MRN-2026-${randomInt(1000, 10000)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const encryptionKeyHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const birthDate = new Date(tanggalLahir);
    const allergiesList = alergi
      ? alergi
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean)
      : [];

    const watermarkText = `HANYA UNTUK VERIFIKASI JAGAMEDIS - ${new Date()
      .toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      .toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          username: nik,
          email,
          passwordHash,
          role: "pasien",
          status: AccountStatus.PENDING,
        },
      });

      await tx.patient.create({
        data: {
          id: userId,
          userId,
          nik,
          name: namaLengkap,
          birthDate,
          gender: Gender.L,
          bloodType: golDarah,
          mrn,
          allergies: allergiesList,
          emergencyContactPhone: phone,
          emergencyContactName: "Keluarga Pasien",
          emergencyContactRelation: "Keluarga",
          encryptionKeyHex,
        },
      });

      await tx.kycSubmission.create({
        data: {
          id: kycId,
          userId,
          namaLengkap,
          nik,
          birthDate,
          alamat,
          ktpUrl: `/uploads/ktp-${nik}.jpg`,
          selfieUrl: `/uploads/selfie-${nik}.jpg`,
          watermarkText,
          status: AccountStatus.PENDING,
        },
      });
    });

    return {
      success: true,
      message: "Pendaftaran berhasil disimpan ke basis data dan menunggu verifikasi e-KYC.",
      kycId,
      userId,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan internal";
    console.error("Register Pasien Error:", error);
    return { success: false, message: `Gagal menyimpan pendaftaran ke database: ${msg}` };
  }
}

export async function registerPasienCepatServerAction(
  rawData: Record<string, unknown>
): Promise<{ success: boolean; message: string; username?: string; userId?: string }> {
  const validation = RegisterPasienCepatSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message || "Format pendaftaran tidak valid.",
    };
  }

  const { username, namaLengkap, email, password } = validation.data;
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] },
    });

    if (existing) {
      return {
        success: false,
        message: "Username atau alamat email sudah terdaftar di sistem. Gunakan yang lain.",
      };
    }

    const userId = `P-${Date.now().toString().slice(-6)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const mrn = `MRN-2026-${randomInt(1000, 10000)}`;
    const tempNik = `TEMP-${Date.now().toString().slice(-8)}`;

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          username: cleanUsername,
          email: cleanEmail,
          passwordHash,
          role: "pasien",
          status: AccountStatus.PENDING,
        },
      });

      const defaultKeyHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await tx.patient.create({
        data: {
          id: userId,
          userId,
          nik: tempNik,
          name: namaLengkap,
          birthDate: new Date("2000-01-01"),
          mrn,
          gender: Gender.L,
          bloodType: "O+",
          emergencyContactName: "Keluarga Terdaftar",
          emergencyContactRelation: "Keluarga",
          emergencyContactPhone: "0812000000",
          encryptionKeyHex: defaultKeyHex,
        },
      });
    });

    return {
      success: true,
      message: "Akun berhasil dibuat! Silakan masuk untuk melengkapi data diri Anda.",
      username: cleanUsername,
      userId,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal membuat akun: ${msg}` };
  }
}
