"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEMO_USERS, UserSession, normalizeRole } from "@/lib/auth/auth";
import { LoginSchema, RegisterPasienSchema, RegisterPasienCepatSchema } from "@/lib/validations/auth";
import { registerSession, revokeSession, getSessionFromStore } from "@/lib/auth/sessionStore";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // 2. Verifikasi Kredensial Pengguna via PostgreSQL (Prisma)
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
        doctor: true,
        staffMember: true,
      },
    });

    if (dbUser) {
      // Verifikasi Password Hash Bcrypt (Salt rounds 10) atau legacy demo
      let isPasswordMatch = false;
      try {
        if (
          dbUser.passwordHash.startsWith("$2a$") ||
          dbUser.passwordHash.startsWith("$2b$")
        ) {
          // Tangani string placeholder seed misalnya "$2b$10$hashed_doctor123"
          if (dbUser.passwordHash.startsWith("$2b$10$hashed_")) {
            const expectedPlain = dbUser.passwordHash.replace("$2b$10$hashed_", "");
            isPasswordMatch = password === expectedPlain;
          } else {
            isPasswordMatch = await bcrypt.compare(password, dbUser.passwordHash);
          }
        } else {
          isPasswordMatch = dbUser.passwordHash === password;
        }
      } catch {
        isPasswordMatch = dbUser.passwordHash === password;
      }

      if (!isPasswordMatch) {
        return {
          success: false,
          message: "Kata sandi salah. Periksa kembali kredensial Anda.",
        };
      }

      // Verifikasi Status Akun Kemenkes: jika akun ditangguhkan/ditolak
      if (dbUser.status === AccountStatus.SUSPENDED || dbUser.status === AccountStatus.REJECTED) {
        return {
          success: false,
          message: "Akun Anda dinonaktifkan atau permohonan verifikasi ditolak oleh Admin Kemenkes.",
        };
      }

      const roleStr = dbUser.role.toString();
      const role =
        roleStr === "nakes"
          ? ("doctor" as const)
          : roleStr === "pasien"
          ? ("patient" as const)
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
        status: dbUser.status === AccountStatus.VERIFIED ? "VERIFIED" : "PENDING",
        allergies: dbUser.patient?.allergies || [],
        bloodType: dbUser.patient?.bloodType || undefined,
        encryptionKeyHex: dbUser.patient?.encryptionKeyHex || undefined,
      };
    }
  } catch (dbErr) {
    console.warn("Prisma User Login Lookup fallback:", dbErr);
  }

  // Fallback ke DEMO_USERS jika tidak ditemukan di DB
  if (!userSession) {
    const demoUser = DEMO_USERS.find(
      (u) =>
        (u.username.toLowerCase() === cleanId ||
          u.email.toLowerCase() === cleanId ||
          (u.nik && u.nik === cleanId)) &&
        u.password === password
    );

    if (!demoUser) {
      return {
        success: false,
        message: "Kredensial atau NIK tidak valid. Periksa kembali atau gunakan tombol demo.",
      };
    }

    userSession = {
      id: demoUser.id,
      name: demoUser.name,
      username: demoUser.username,
      role: demoUser.role,
      nik: demoUser.nik,
      strNumber: demoUser.strNumber,
      sipNumber: demoUser.sipNumber,
      specialization: demoUser.specialization,
      faskesId: demoUser.faskesId,
      faskesName: demoUser.faskesName,
      status: demoUser.status,
      allergies: demoUser.allergies,
      bloodType: demoUser.bloodType,
      phone: demoUser.phone,
      encryptionKeyHex: demoUser.encryptionKeyHex,
      posisiStaf: demoUser.posisiStaf,
    };
  }

  // 3. Bangkitkan Token Sesi Acak CSPRNG (Opaque Session Token)
  const sessionToken = crypto.randomUUID();
  const maxAge = 14400; // 4 Jam (14.400 detik)

  // 4. Catat Sesi ke Stateful Session Store Server
  registerSession(sessionToken, userSession, maxAge);

  // 5. Terbitkan Cookie Sesi Melalui Header Set-Cookie Resmi (jika dalam request context)
  try {
    const cookieStore = await cookies();

    // Cookie 1: Token Sesi Terenkripsi / Opaque (HttpOnly, Secure, SameSite=Lax, Max-Age)
    cookieStore.set("resilio_session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    // Cookie 2: Peran Pengguna Publik
    cookieStore.set("resilio_user_role", normalizeRole(userSession.role), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
  } catch {
    // Diabaikan jika dieksekusi di lingkungan uji CLI / script tanpa request context
  }

  const targetRole = normalizeRole(userSession.role);

  return {
    success: true,
    session: userSession,
    targetRole,
  };
}

/**
 * Server Action: Pendaftaran Pasien Baru (e-KYC) ke PostgreSQL
 * Menyimpan data ke tabel User (status: PENDING_VERIFICATION), Patient, dan KycSubmission
 */
export async function registerPasienServerAction(
  data: Record<string, unknown>
): Promise<{ success: boolean; message: string; kycId?: string; userId?: string }> {
  // 1. Validasi Skema Zod
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
    // 2. Periksa apakah NIK atau Email sudah terdaftar di PostgreSQL
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { patient: { nik } }],
      },
    });

    if (existingUser) {
      return {
        success: false,
        message: "NIK atau alamat email sudah terdaftar di sistem Resilio-Health.",
      };
    }

    const userId = `P-${Date.now().toString().slice(-4)}`;
    const kycId = `KYC-${Date.now().toString().slice(-4)}`;
    const mrn = `MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
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

    const watermarkText = `HANYA UNTUK VERIFIKASI RESILIO-HEALTH - ${new Date()
      .toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      .toUpperCase()}`;

    // 3. Mutasi Transaksional ke PostgreSQL: User + Patient + KycSubmission
    await prisma.$transaction(async (tx) => {
      // Buat Induk Akun Pengguna (User) dengan status PENDING
      await tx.user.create({
        data: {
          id: userId,
          username: nik, // Default login NIK
          email,
          passwordHash,
          role: "pasien",
          status: AccountStatus.PENDING,
        },
      });

      // Buat Profil Pasien (Patient)
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

      // Buat Pengajuan e-KYC (KycSubmission)
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
 * Server Action: Admin Menyetujui e-KYC Pasien
 * Mengubah status KycSubmission dan User menjadi VERIFIED di PostgreSQL
 */
export async function approveKycServerAction(
  submissionId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const kyc = await prisma.kycSubmission.findUnique({
      where: { id: submissionId },
      include: { user: true },
    });

    if (!kyc) {
      return { success: false, message: "Permohonan e-KYC tidak ditemukan di database." };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update status KycSubmission
      await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: AccountStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });

      // 2. Aktifkan akun pengguna User agar dapat login
      await tx.user.update({
        where: { id: kyc.userId },
        data: {
          status: AccountStatus.VERIFIED,
        },
      });
    });

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
 * Server Action: Admin Menolak e-KYC Pasien
 */
export async function rejectKycServerAction(
  submissionId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
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
          status: AccountStatus.SUSPENDED,
          alasanPenolakan: reason || "Data identitas tidak sesuai standar verifikasi visual Kemenkes.",
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: {
          status: AccountStatus.SUSPENDED,
        },
      });
    });

    return {
      success: true,
      message: `Pengajuan e-KYC telah ditolak. Status akun ditangguhkan.`,
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
 * Mengambil daftar pengajuan e-KYC dari PostgreSQL
 */
export async function getKycSubmissionsServerAction() {
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
 * Server Action: Logout Pengguna & Pemusnahan Cookie Sesi
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

/**
 * Server Action: Pendaftaran Cepat Pasien Baru (Username, Nama, Email, Password)
 * Akun langsung aktif di PostgreSQL dengan status PENDING untuk diverifikasi kemudian
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

    const userId = `P-${Date.now().toString().slice(-4)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const mrn = `MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
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
 * Server Action: Mengambil Profil Pasien Terkini dari PostgreSQL berdasarkan Session ID / Username
 */
export async function getPatientProfileServerAction(userId: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { username: userId }, { patient: { id: userId } }],
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

    return {
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        statusAccount: user.status,
        patient: user.patient,
        latestKyc: user.kycSubmissions[0] || null,
      },
    };
  } catch (error: unknown) {
    console.warn("Get Patient Profile Error:", error);
    return { success: false, data: null };
  }
}

/**
 * Server Action: Perbarui Data Mandiri Pasien (Non-Sensitif: HP, Alamat, Alergi, Kontak Darurat)
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
  try {
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        emergencyContactPhone: data.phone,
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
 * Server Action: Ajukan Verifikasi Data Sensitif e-KYC (NIK, Nama KTP, Tgl Lahir, KTP + Selfie)
 */
export async function submitKycVerificationServerAction(params: {
  userId: string;
  patientId: string;
  nik: string;
  namaLengkap: string;
  tanggalLahir: string;
  alamat: string;
  ktpUrl?: string;
  selfieUrl?: string;
  watermarkText?: string;
}): Promise<{ success: boolean; message: string }> {
  const {
    userId,
    patientId,
    nik,
    namaLengkap,
    tanggalLahir,
    alamat,
    ktpUrl = `/uploads/ktp-${nik}.jpg`,
    selfieUrl = `/uploads/selfie-${nik}.jpg`,
    watermarkText = `HANYA UNTUK VERIFIKASI RESILIO-HEALTH - ${new Date().toLocaleDateString("id-ID")}`,
  } = params;

  if (!/^\d{16}$/.test(nik)) {
    return { success: false, message: "NIK wajib terdiri dari tepat 16 digit angka." };
  }

  try {
    const kycId = `KYC-${Date.now().toString().slice(-4)}`;
    const birthDate = new Date(tanggalLahir);

    await prisma.$transaction(async (tx) => {
      // 1. Update profil pasien dengan NIK dan nama baru
      await tx.patient.update({
        where: { id: patientId },
        data: {
          nik,
          name: namaLengkap,
          birthDate,
        },
      });

      // 2. Buat antrean permohonan e-KYC
      await tx.kycSubmission.create({
        data: {
          id: kycId,
          userId,
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
