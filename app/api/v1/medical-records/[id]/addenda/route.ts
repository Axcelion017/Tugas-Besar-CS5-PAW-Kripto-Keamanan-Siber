import { NextRequest } from "next/server";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateAddendumApiSchema } from "@/lib/validations/api-v1";
import {
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
  decryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import {
  assertFaskesNotQuarantined,
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/medical-records/[id]/addenda
 * Koreksi rekam medis immutable (Permenkes No. 24/2022 — UR-T09).
 * Membuat versi turunan baru (`version = parent.version + 1`, `parentRecordId = id`) tanpa menghapus atau menimpa berkas asal.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["nakes"], `POST ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Rekam Medis Induk", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateAddendumApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;
  if (
    data.ivHex.toLowerCase() === STATIC_FORBIDDEN_IV ||
    data.hmacDigest.toLowerCase() === EMPTY_SHA256_HMAC
  ) {
    return problemResponse({
      slug: "validation-error",
      title: "Cryptographic Policy Violation",
      status: 422,
      detail: "IV statis atau digest HMAC kosong ditolak pada pembuatan addendum rekam medis.",
      instance,
    });
  }

  const doctorId = auth.session.id;
  const faskesId = auth.session.faskesId || "FAS-01";
  const meta = extractRequestMeta(request);

  try {
    const killSwitch = await assertFaskesNotQuarantined(faskesId, "Pembuatan addendum RME");
    if (!killSwitch.ok) {
      return problemResponse({
        slug: "forbidden",
        title: "Facility Quarantined",
        status: 403,
        detail: killSwitch.message,
        instance,
      });
    }

    const parent = await prisma.medicalRecord.findUnique({
      where: { id: validId.id },
      include: {
        patient: {
          include: { accessGrants: true, appointments: true },
        },
      },
    });

    if (!parent) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Rekam medis induk '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    const authorized =
      parent.doctorId === doctorId ||
      hasValidGrantForDoctor(parent.patient.accessGrants, doctorId, faskesId) ||
      hasActiveEncounterForDoctor(parent.patient.appointments, doctorId);

    if (!authorized) {
      await recordSecurityAuditBestEffort({
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Dokter ${doctorId} mencoba membuat addendum atas RME ${validId.id} tanpa consent atau encounter aktif.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak memiliki izin consent atau encounter aktif untuk membuat addendum pada berkas ini.",
        instance,
      });
    }

    const nextVersion = parent.version + 1;
    const addendumId = data.recordId || `REC-${Date.now().toString().slice(-6)}`;

    const verified = await decryptMedicalRecordPayload(
      {
        encryptedPayload: data.encryptedPayload,
        ivHex: data.ivHex,
        hmacDigest: data.hmacDigest,
      },
      parent.patient.encryptionKeyHex,
      { patientId: parent.patientId, recordId: addendumId, version: nextVersion }
    );

    if (!verified.ok) {
      await recordSecurityAuditBestEffort({
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.HMAC_MISMATCH,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `Gagal verifikasi integritas AEAD/HMAC addendum ${addendumId} (${verified.errorCode}).`,
      });
      return problemResponse({
        slug: "validation-error",
        title: "Cryptographic Verification Failed",
        status: 422,
        detail: `Verifikasi kriptografi addendum gagal (${verified.errorCode}): ${verified.message}`,
        instance,
      });
    }

    const created = await prisma.medicalRecord.create({
      data: {
        id: addendumId,
        patientId: parent.patientId,
        doctorId,
        faskesId: parent.faskesId,
        appointmentId: parent.appointmentId,
        parentRecordId: parent.id,
        primaryIcd10: data.primaryIcd10 || parent.primaryIcd10,
        diagnosisShort: data.diagnosisShort || parent.diagnosisShort,
        encryptedPayload: data.encryptedPayload,
        ivHex: data.ivHex,
        hmacDigest: data.hmacDigest,
        version: nextVersion,
        addendumReason: data.addendumReason,
        vitalSignsTrend: verified.data.vitalSigns
          ? { ...verified.data.vitalSigns, recordedAt: new Date().toISOString() }
          : undefined,
        claimStatus: parent.claimStatus,
      },
    });

    await recordSecurityAuditBestEffort({
      actorId: doctorId,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.WRITE_RME,
      targetResource: instance,
      severity: AuditSeverity.INFO,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Dokter ${auth.session.name} menerbitkan addendum ${created.id} (v${created.version}) atas RME ${parent.id}. Alasan: ${data.addendumReason}.`,
    });

    safeRevalidate(["/nakes", "/pasien/rekam-medis"]);

    return jsonOk(
      {
        id: created.id,
        parentRecordId: created.parentRecordId,
        patientId: created.patientId,
        version: created.version,
        addendumReason: created.addendumReason,
        primaryIcd10: created.primaryIcd10,
        diagnosisShort: created.diagnosisShort,
        createdAt: created.createdAt.toISOString(),
      },
      201,
      { Location: `/api/v1/medical-records/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Addendum Rekam Medis");
  }
}
