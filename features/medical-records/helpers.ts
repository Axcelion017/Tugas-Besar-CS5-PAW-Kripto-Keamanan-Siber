import { prisma } from "@/lib/db/prisma";
import { AppointmentStatus, FaskesStatus } from "@prisma/client";

export function maskNik(nik: string): string {
  const clean = (nik || "").trim();
  if (clean.length < 8) return "••••••••";
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

export function hasValidGrantForDoctor(
  grants: Array<{
    entityId: string;
    entityType: string;
    isRevoked: boolean;
    validUntil: Date;
  }>,
  doctorId: string,
  faskesId?: string | null
): boolean {
  const now = new Date();
  return grants.some(
    (g) =>
      !g.isRevoked &&
      new Date(g.validUntil) > now &&
      (g.entityId === doctorId ||
        (g.entityType === "FASKES" && (!faskesId || g.entityId === faskesId)))
  );
}

export function hasActiveEncounterForDoctor(
  appointments: Array<{
    doctorId: string;
    dpjpId: string | null;
    consentActive: boolean;
    status: AppointmentStatus;
  }>,
  doctorId: string
): boolean {
  return appointments.some(
    (a) =>
      (a.doctorId === doctorId || a.dpjpId === doctorId) &&
      a.consentActive &&
      a.status !== AppointmentStatus.CANCELLED
  );
}

export async function assertFaskesNotQuarantined(
  faskesId: string,
  actionLabel: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const activeFaskes = await prisma.faskes.findUnique({
    where: { id: faskesId },
    select: { id: true, nama: true, status: true },
  });
  if (activeFaskes?.status === FaskesStatus.QUARANTINED) {
    return {
      ok: false,
      message: `403 Forbidden (Kill-Switch Siber): ${activeFaskes.nama} sedang berstatus KARANTINA oleh Admin Regulator. ${actionLabel} ditangguhkan.`,
    };
  }
  return { ok: true };
}
