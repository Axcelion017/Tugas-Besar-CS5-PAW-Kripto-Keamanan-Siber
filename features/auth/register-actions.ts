"use server";

import { RegisterPasienSchema, RegisterPasienCepatSchema } from "@/lib/validations/auth";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

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
