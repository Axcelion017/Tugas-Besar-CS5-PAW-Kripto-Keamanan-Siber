import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AppointmentStatus, AuditAction, AuditSeverity, FaskesStatus } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import {
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
  decryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import { safeRevalidate } from "@/lib/utils/revalidate";

const OutboxItemSchema = z.object({
  recordId: z.string({ message: "recordId wajib diisi." }).min(3, { message: "recordId tidak valid." }),
  patientId: z.string({ message: "patientId wajib diisi." }).min(2, { message: "patientId tidak valid." }),
  encounterId: z.string({ message: "encounterId harus string." }).optional().nullable(),
  faskesId: z.string({ message: "faskesId harus string." }).optional(),
  primaryIcd10: z.string({ message: "primaryIcd10 wajib diisi." }).min(1, { message: "Kode ICD-10 wajib diisi." }),
  diagnosisShort: z.string({ message: "diagnosisShort wajib diisi." }).min(2, { message: "Ringkasan diagnosis wajib diisi." }),
  encryptedPayload: z.string({ message: "encryptedPayload wajib berupa hex valid." }).regex(/^[0-9a-fA-F]+$/, { message: "Ciphertext harus berformat heksadesimal." }),
  ivHex: z.string({ message: "ivHex wajib 24 karakter hex (96-bit)." }).regex(/^[0-9a-fA-F]{24}$/, { message: "IV wajib 96-bit (24 karakter hex)." }),
  hmacDigest: z.string({ message: "hmacDigest wajib 64 karakter hex (SHA-256)." }).regex(/^[0-9a-fA-F]{64}$/, { message: "HMAC wajib 64 karakter hex." }),
  version: z.number({ message: "version wajib angka positif." }).int().min(1).default(1),
});

const OutboxSyncPayloadSchema = z.object({
  items: z.array(OutboxItemSchema).min(1, { message: "Minimal 1 berkas outbox diperlukan untuk sinkronisasi." }),
});

/**
 * POST /api/sync/outbox
 * Endpoint REST PWA Background Sync untuk menyinkronkan antrean berkas RME terenkripsi
 * dari IndexedDB lokal (`resilio_offline_db`) ke PostgreSQL dengan verifikasi kriptografi AEAD+HMAC.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(["nakes", "staf", "admin"], "api:sync:outbox");
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Body JSON tidak valid." },
      { status: 400 }
    );
  }

  const parsed = OutboxSyncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message || "Payload sinkronisasi outbox tidak valid.",
      },
      { status: 400 }
    );
  }

  const activeFaskesId = auth.session.faskesId || "FAS-01";
  const faskes = await prisma.faskes.findUnique({
    where: { id: activeFaskesId },
    select: { id: true, nama: true, status: true },
  });

  if (faskes?.status === FaskesStatus.QUARANTINED) {
    return NextResponse.json(
      {
        success: false,
        message: `403 Forbidden (Kill-Switch Siber): ${faskes.nama} sedang berstatus KARANTINA. Sinkronisasi outbox ditangguhkan.`,
      },
      { status: 403 }
    );
  }

  const results: Array<{
    recordId: string;
    status: "SYNCED" | "ALREADY_EXISTS" | "REJECTED";
    reason?: string;
  }> = [];

  for (const item of parsed.data.items) {
    // 1. Tolak keras IV statis atau HMAC kosong
    if (
      item.ivHex.toLowerCase() === STATIC_FORBIDDEN_IV ||
      item.hmacDigest.toLowerCase() === EMPTY_SHA256_HMAC
    ) {
      results.push({
        recordId: item.recordId,
        status: "REJECTED",
        reason: "Ditolak: IV statis atau HMAC kosong tidak diperbolehkan.",
      });
      continue;
    }

    // 2. Idempotensi: jika recordId sudah ada di PostgreSQL, anggap sudah tersinkron
    const existing = await prisma.medicalRecord.findUnique({
      where: { id: item.recordId },
      select: { id: true },
    });
    if (existing) {
      results.push({
        recordId: item.recordId,
        status: "ALREADY_EXISTS",
        reason: "Berkas sudah tercatat di PostgreSQL sebelumnya.",
      });
      continue;
    }

    // 3. Cek eksistensi pasien
    const patient = await prisma.patient.findUnique({
      where: { id: item.patientId },
      select: { id: true, name: true, encryptionKeyHex: true },
    });
    if (!patient) {
      results.push({
        recordId: item.recordId,
        status: "REJECTED",
        reason: `Pasien ${item.patientId} tidak ditemukan di basis data.`,
      });
      continue;
    }

    // 4. Verifikasi kriptografi nyata: HKDF + constant-time HMAC + AES-256-GCM + AAD
    const verified = await decryptMedicalRecordPayload(
      {
        encryptedPayload: item.encryptedPayload,
        ivHex: item.ivHex,
        hmacDigest: item.hmacDigest,
      },
      patient.encryptionKeyHex,
      {
        patientId: patient.id,
        recordId: item.recordId,
        version: item.version,
      }
    );

    if (!verified.ok) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.HMAC_MISMATCH,
        targetResource: `/api/sync/outbox/${item.recordId}`,
        severity: AuditSeverity.CRITICAL,
        detail: `Sinkronisasi offline ditolak (${verified.errorCode}): ${verified.message}`,
      });
      results.push({
        recordId: item.recordId,
        status: "REJECTED",
        reason: `Gagal verifikasi integritas HMAC/AEAD (${verified.errorCode}).`,
      });
      continue;
    }

    // 5. Simpan permanen ke PostgreSQL (beserta update status antrean jika encounterId valid)
    const doctorId = auth.role === "nakes" ? auth.session.id : "DOC-01";
    const targetFaskesId = item.faskesId || activeFaskesId;
    const validAppointment = item.encounterId
      ? await prisma.appointment.findUnique({
          where: { id: item.encounterId },
          select: { id: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.medicalRecord.create({
        data: {
          id: item.recordId,
          patientId: patient.id,
          doctorId,
          faskesId: targetFaskesId,
          appointmentId: validAppointment?.id || null,
          primaryIcd10: item.primaryIcd10,
          diagnosisShort: item.diagnosisShort,
          encryptedPayload: item.encryptedPayload,
          ivHex: item.ivHex,
          hmacDigest: item.hmacDigest,
          version: item.version,
          vitalSignsTrend: verified.data.vitalSigns
            ? {
                ...verified.data.vitalSigns,
                recordedAt: new Date().toISOString(),
              }
            : undefined,
          claimStatus: "DRAFT",
        },
      });

      if (validAppointment) {
        await tx.appointment.update({
          where: { id: validAppointment.id },
          data: { status: AppointmentStatus.COMPLETED },
        });
      }
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.WRITE_RME,
      targetResource: `/api/sync/outbox/${item.recordId}`,
      severity: AuditSeverity.INFO,
      detail: `PWA Background Sync: Berkas offline ${item.recordId} untuk pasien ${patient.id} lolos verifikasi AEAD+HMAC dan tersimpan ke PostgreSQL.`,
    });

    results.push({
      recordId: item.recordId,
      status: "SYNCED",
    });
  }

  safeRevalidate(["/nakes", "/nakes/offline-sync", "/pasien/rekam-medis"]);

  const syncedCount = results.filter(
    (r) => r.status === "SYNCED" || r.status === "ALREADY_EXISTS"
  ).length;

  return NextResponse.json(
    {
      success: syncedCount > 0,
      syncedCount,
      rejectedCount: results.length - syncedCount,
      results,
    },
    { status: syncedCount > 0 ? 201 : 422 }
  );
}
