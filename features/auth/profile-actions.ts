"use server";

import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { safeRevalidate } from "@/lib/utils/revalidate";

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
        patient: { include: { familyMembers: true } },
        kycSubmissions: { orderBy: { submittedAt: "desc" }, take: 1 },
      },
    });

    if (!user || !user.patient) {
      return { success: false, data: null };
    }

    const sanitizedPatient =
      auth.role === "pasien" ? user.patient : { ...user.patient, encryptionKeyHex: "" };

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

    safeRevalidate(["/pasien", "/pasien/profil"]);

    return { success: true, message: "Data profil mandiri berhasil diperbarui di basis data." };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan server";
    return { success: false, message: `Gagal memperbarui profil: ${msg}` };
  }
}
