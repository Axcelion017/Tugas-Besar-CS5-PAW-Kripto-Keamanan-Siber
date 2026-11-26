"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UserSession, normalizeRole } from "@/lib/auth/auth";
import { LoginSchema, RegisterPasienSchema, RegisterPasienCepatSchema } from "@/lib/validations/auth";
import {
  registerSessionAsync,
  revokeSessionAsync,
  getSessionFromStoreAsync,
} from "@/lib/auth/sessionStore";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus, AuditAction, AuditSeverity, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan di luar request context
  }
}

export interface ServerAuthResponse {
  success: boolean;
  message?: string;
  session?: UserSession;
  targetRole?: string;
}

/**
 * Server Action: Login Pengguna & Penerbitan Cookie Sesi HTTP-Only Persisten (PostgreSQL)
 * - Verifikasi 100% Bcrypt (`bcrypt.compare`) tanpa fallback plaintext atau DEMO_USERS.
 * - Menerapkan atribut cookie keamanan: HttpOnly, Secure (prod), SameSite=Lax, Max-Age=14400.
 */
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

    // Verifikasi 100% Bcrypt — tolak segala hash non-Bcrypt atau perbandingan plaintext
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

  // Bangkitkan Token Sesi Acak CSPRNG (Opaque Session Token) & simpan ke tabel `sessions`
  const sessionToken = crypto.randomUUID();
  const maxAge = 14400; // 4 Jam (14.400 detik)

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
    // Bersihkan cookie peran publik lama agar tidak pernah menjadi vektor eskalasi
    cookieStore.delete("resilio_user_role");
  } catch {
    // Diabaikan jika dieksekusi di lingkungan uji CLI / script tanpa request context
  }

  return {
    success: true,
    session: userSession,
    targetRole,
  };
}

/**
 * Server Action: Pendaftaran Pasien Baru (e-KYC) ke PostgreSQL (Publik)
 */
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

  const {
    nik,
    namaLengkap,
    email,
    password,
    phone,
    tanggalLahir,
    alamat,
    golDarah,
    alergi,
  } = validation.data;

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { patient: { nik } }],
      },
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
    return {
      success: false,
      message: `Gagal menyimpan pendaftaran ke database: ${msg}`,
    };
  }
}

/**
 * Server Action: Admin Menyetujui e-KYC Pasien — khusus peran Admin Regulator
 */
export async function approveKycServerAction(
  submissionId: string
): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["admin"], `approveKyc:${submissionId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const kyc = await prisma.kycSubmission.findUnique({
      where: { id: submissionId },
      include: { user: true },
    });

    if (!kyc) {
      return { success: false, message: "Permohonan e-KYC tidak ditemukan di database." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: AccountStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: {
          status: AccountStatus.VERIFIED,
        },
      });
    });

    safeRevalidate("/admin/verifikasi-kyc");

    return {
      success: true,
      message: `e-KYC untuk ${kyc.namaLengkap} berhasil disetujui. Akun pasien telah resmi aktif di basis data.`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    console.error("Approve KYC Error:", error);
    return {
      success: false,
      message: `Gagal menyetujui e-KYC: ${msg}`,
    };
  }
}

/**
 * Server Action: Admin Menolak e-KYC Pasien — khusus peran Admin Regulator
 */
export async function rejectKycServerAction(
  submissionId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["admin"], `rejectKyc:${submissionId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const kyc = await prisma.kycSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!kyc) {
      return { success: false, message: "Permohonan e-KYC tidak ditemukan." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: AccountStatus.REJECTED,
          alasanPenolakan:
            reason || "Data identitas tidak sesuai standar verifikasi visual Kemenkes.",
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: {
          status: AccountStatus.REJECTED,
        },
      });
    });

    safeRevalidate("/admin/verifikasi-kyc");

    return {
      success: true,
      message: `Pengajuan e-KYC telah ditolak.`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    console.error("Reject KYC Error:", error);
    return {
      success: false,
      message: `Gagal menolak e-KYC: ${msg}`,
    };
  }
}

/**
 * Mengambil daftar pengajuan e-KYC dari PostgreSQL — khusus peran Admin Regulator
 */
export async function getKycSubmissionsServerAction() {
  const auth = await requireSession(["admin"], "getKycSubmissions");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const list = await prisma.kycSubmission.findMany({
      orderBy: { submittedAt: "desc" },
    });
    return { success: true, data: list };
  } catch {
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Logout Pengguna & Pemusnahan Sesi Persisten + Cookie HTTP-Only
 */
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

/**
 * Mengambil sesi server yang valid berdasarkan cookie aktif (PostgreSQL persistent)
 */
export async function getServerSessionData(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("resilio_session_token")?.value;

  if (!token) return null;

  return getSessionFromStoreAsync(token);
}

/**
 * Server Action: Pendaftaran Cepat Pasien Baru (Publik)
 */
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
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
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

/**
 * Server Action: Mengambil Profil Pasien Terkini dari PostgreSQL
 * Pasien hanya dapat membaca profil dirinya sendiri (Anti-BOLA).
 */
export async function getPatientProfileServerAction(userId?: string) {
  const auth = await requireSession(["pasien", "admin", "nakes", "staf"], "getPatientProfile");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: null };
  }

  const targetUserId = auth.role === "pasien" ? auth.session.id : userId || auth.session.id;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: targetUserId }, { username: targetUserId }, { patient: { id: targetUserId } }],
      },
      include: {
        patient: {
          include: {
            familyMembers: true,
          },
        },
        kycSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user || !user.patient) {
      return { success: false, data: null };
    }

    // Jangan kirim encryptionKeyHex ke staf/admin yang tidak memerlukan kunci dekripsi RME
    const sanitizedPatient =
      auth.role === "pasien"
        ? user.patient
        : { ...user.patient, encryptionKeyHex: "" };

    return {
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        statusAccount: user.status,
        patient: sanitizedPatient,
        latestKyc: user.kycSubmissions[0] || null,
      },
    };
  } catch (error: unknown) {
    console.warn("Get Patient Profile Error:", error);
    return { success: false, data: null };
  }
}

/**
 * Server Action: Perbarui Data Mandiri Pasien — dibatasi hanya pemilik akun / Admin
 */
export async function updatePatientProfileServerAction(
  patientId: string,
  data: {
    phone?: string;
    alamat?: string;
    bloodType?: string;
    allergies?: string[];
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactPhone?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["pasien", "admin"], `updatePatientProfile:${patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  if (auth.role === "pasien" && patientId && patientId !== auth.session.id) {
    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.IDOR_BLOCKED,
      targetResource: `/api/patients/${patientId}/profile`,
      severity: AuditSeverity.CRITICAL,
      detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengubah profil pasien ${patientId}.`,
    });
    return {
      success: false,
      message: "403 Forbidden: Anda hanya dapat mengubah data profil milik Anda sendiri.",
    };
  }

  const targetPatientId = auth.role === "admin" ? patientId : auth.session.id;

  try {
    await prisma.patient.update({
      where: { id: targetPatientId },
      data: {
        emergencyContactPhone: data.emergencyContactPhone || data.phone,
        bloodType: data.bloodType,
        allergies: data.allergies,
        emergencyContactName: data.emergencyContactName,
        emergencyContactRelation: data.emergencyContactRelation,
      },
    });

    safeRevalidate("/pasien");
    safeRevalidate("/pasien/profil");

    return { success: true, message: "Data profil mandiri berhasil diperbarui di basis data." };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal memperbarui profil: ${msg}` };
  }
}

/**
 * Server Action: Ajukan Verifikasi Data Sensitif e-KYC — dibatasi hanya pemilik sesi Pasien
 */
export async function submitKycVerificationServerAction(params: {
  userId?: string;
  patientId?: string;
  nik: string;
  namaLengkap: string;
  tanggalLahir: string;
  alamat: string;
  ktpUrl?: string;
  selfieUrl?: string;
  watermarkText?: string;
}): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["pasien"], "submitKycVerification");
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const {
    nik,
    namaLengkap,
    tanggalLahir,
    alamat,
    ktpUrl = `/uploads/ktp-${nik}.jpg`,
    selfieUrl = `/uploads/selfie-${nik}.jpg`,
    watermarkText = `HANYA UNTUK VERIFIKASI JAGAMEDIS - ${new Date().toLocaleDateString("id-ID")}`,
  } = params;

  if (!/^\d{16}$/.test(nik)) {
    return { success: false, message: "NIK wajib terdiri dari tepat 16 digit angka." };
  }

  const ownerId = auth.session.id;

  try {
    const kycId = `KYC-${Date.now().toString().slice(-6)}`;
    const birthDate = new Date(tanggalLahir);

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: ownerId },
        data: {
          nik,
          name: namaLengkap,
          birthDate,
        },
      });

      await tx.kycSubmission.create({
        data: {
          id: kycId,
          userId: ownerId,
          namaLengkap,
          nik,
          birthDate,
          alamat,
          ktpUrl,
          selfieUrl,
          watermarkText,
          status: AccountStatus.PENDING,
        },
      });
    });

    safeRevalidate("/pasien");
    safeRevalidate("/pasien/profil");
    safeRevalidate("/admin/verifikasi-kyc");

    return {
      success: true,
      message: "Pengajuan verifikasi e-KYC NIK berhasil dikirim ke Admin Kemenkes.",
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mengajukan e-KYC: ${msg}` };
  }
}
