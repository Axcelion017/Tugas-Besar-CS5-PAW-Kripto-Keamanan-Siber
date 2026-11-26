"use server";

import { requireSession } from "@/features/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AccountStatus } from "@prisma/client";
import { safeRevalidate } from "@/lib/utils/revalidate";

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
        data: { status: AccountStatus.VERIFIED, verifiedAt: new Date() },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: { status: AccountStatus.VERIFIED },
      });

      await tx.patient.updateMany({
        where: { userId: kyc.userId },
        data: {
          nik: kyc.nik,
          name: kyc.namaLengkap,
          birthDate: kyc.birthDate,
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
    return { success: false, message: `Gagal menyetujui e-KYC: ${msg}` };
  }
}

export async function rejectKycServerAction(
  submissionId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const auth = await requireSession(["admin"], `rejectKyc:${submissionId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  try {
    const kyc = await prisma.kycSubmission.findUnique({ where: { id: submissionId } });
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
        data: { status: AccountStatus.REJECTED },
      });
    });

    safeRevalidate("/admin/verifikasi-kyc");

    return { success: true, message: "Pengajuan e-KYC telah ditolak." };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan basis data";
    console.error("Reject KYC Error:", error);
    return { success: false, message: `Gagal menolak e-KYC: ${msg}` };
  }
}

export async function getKycSubmissionsServerAction() {
  const auth = await requireSession(["admin"], "getKycSubmissions");
  if (!auth.ok) {
    return { success: false, message: auth.message, data: [] };
  }

  try {
    const list = await prisma.kycSubmission.findMany({ orderBy: { submittedAt: "desc" } });
    return { success: true, data: list };
  } catch {
    return { success: false, data: [] };
  }
}

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

    await prisma.kycSubmission.create({
      data: {
        id: kycId,
        userId: ownerId,
        namaLengkap,
        nik,
        birthDate,
        alamat: (alamat || "").trim() || "Alamat belum dilengkapi",
        ktpUrl,
        selfieUrl,
        watermarkText,
        status: AccountStatus.PENDING,
      },
    });

    safeRevalidate(["/pasien", "/pasien/profil", "/admin/verifikasi-kyc"]);

    return {
      success: true,
      message: "Pengajuan verifikasi e-KYC NIK berhasil dikirim ke Admin Kemenkes.",
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal mengajukan e-KYC: ${msg}` };
  }
}
