import { NextRequest } from "next/server";
import { AppointmentStatus, AuditAction, AuditSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateMedicalRecordApiSchema } from "@/lib/validations/api-v1";
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

/**
 * GET /api/v1/medical-records
 * Daftar rekam medis Zero-Knowledge sesuai scope peran (UR-P06, UR-T03, UR-T04).
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "nakes", "admin"],
    "GET /api/v1/medical-records"
  );
  if (!auth.ok) return auth.response;

  const patientIdFilter = request.nextUrl.searchParams.get("patientId")?.trim();
  const where: Prisma.MedicalRecordWhereInput = {};

  if (auth.role === "pasien") {
    where.patientId = auth.session.id;
  } else if (auth.role === "nakes") {
    if (patientIdFilter) where.patientId = patientIdFilter;
    where.OR = [
      { doctorId: auth.session.id },
      {
        patient: {
          accessGrants: {
            some: {
              entityId: auth.session.id,
              isRevoked: false,
              validUntil: { gt: new Date() },
            },
          },
        },
      },
      {
        patient: {
          appointments: {
            some: {
              OR: [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }],
              consentActive: true,
              status: { not: AppointmentStatus.CANCELLED },
            },
          },
        },
      },
    ];
  } else if (patientIdFilter) {
    where.patientId = patientIdFilter;
  }

  try {
    const records = await prisma.medicalRecord.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, mrn: true, bloodType: true } },
        doctor: { select: { id: true, name: true, specialty: true, strNumber: true } },
        faskes: { select: { id: true, nama: true, kota: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      records.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        doctorId: r.doctorId,
        faskesId: r.faskesId,
        appointmentId: r.appointmentId,
        parentRecordId: r.parentRecordId,
        primaryIcd10: r.primaryIcd10,
        diagnosisShort: r.diagnosisShort,
        // Admin hanya menerima metadata non-klinis (Zero-Knowledge Separation of Concerns)
        encryptedPayload: auth.role === "admin" ? null : r.encryptedPayload,
        ivHex: auth.role === "admin" ? null : r.ivHex,
        hmacDigest: r.hmacDigest,
        version: r.version,
        addendumReason: r.addendumReason,
        claimStatus: r.claimStatus,
        isBreakGlass: r.isBreakGlass,
        createdAt: r.createdAt.toISOString(),
        patient: r.patient,
        doctor: r.doctor,
        faskes: r.faskes,
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Rekam Medis");
  }
}

/**
 * POST /api/v1/medical-records
 * Menyimpan berkas RME baru terenkripsi AEAD (AES-256-GCM + HKDF HMAC-SHA256) oleh Dokter DPJP (UR-T04).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["nakes"], "POST /api/v1/medical-records");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateMedicalRecordApiSchema.safeParse(jsonBody.data);
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
      detail: "IV statis atau digest HMAC kosong ditolak oleh kebijakan kriptografi AEAD JagaMedis.",
      instance,
    });
  }

  const doctorId = auth.session.id;
  const faskesId = auth.session.faskesId || "FAS-01";
  const meta = extractRequestMeta(request);

  try {
    const killSwitch = await assertFaskesNotQuarantined(faskesId, "Penulisan rekam medis");
    if (!killSwitch.ok) {
      return problemResponse({
        slug: "forbidden",
        title: "Facility Quarantined",
        status: 403,
        detail: killSwitch.message,
        instance,
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: { accessGrants: true, appointments: true },
    });

    if (!patient) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Pasien '${data.patientId}' tidak ditemukan di basis data.`,
        instance,
      });
    }

    const authorized =
      hasValidGrantForDoctor(patient.accessGrants, doctorId, faskesId) ||
      hasActiveEncounterForDoctor(patient.appointments, doctorId);

    if (!authorized) {
      await recordSecurityAuditBestEffort({
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: `${instance}/${data.patientId}`,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Dokter ${doctorId} mencoba menulis RME untuk pasien ${data.patientId} tanpa consent atau encounter aktif.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Dokter tidak memiliki izin consent aktif atau tiket pemeriksaan untuk pasien ini.",
        instance,
      });
    }

    const recordId = data.recordId || `REC-${Date.now().toString().slice(-6)}`;
    const verified = await decryptMedicalRecordPayload(
      {
        encryptedPayload: data.encryptedPayload,
        ivHex: data.ivHex,
        hmacDigest: data.hmacDigest,
      },
      patient.encryptionKeyHex,
      { patientId: patient.id, recordId, version: 1 }
    );

    if (!verified.ok) {
      await recordSecurityAuditBestEffort({
        actorId: doctorId,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.HMAC_MISMATCH,
        targetResource: `${instance}/${recordId}`,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `Gagal verifikasi integritas AEAD/HMAC saat penulisan RME ${recordId} (${verified.errorCode}).`,
      });
      return problemResponse({
        slug: "validation-error",
        title: "Cryptographic Verification Failed",
        status: 422,
        detail: `Verifikasi kriptografi AEAD/HMAC gagal (${verified.errorCode}): ${verified.message}`,
        instance,
      });
    }

    const created = await prisma.medicalRecord.create({
      data: {
        id: recordId,
        patientId: patient.id,
        doctorId,
        faskesId,
        appointmentId: data.appointmentId || null,
        primaryIcd10: data.primaryIcd10,
        diagnosisShort: data.diagnosisShort,
        encryptedPayload: data.encryptedPayload,
        ivHex: data.ivHex,
        hmacDigest: data.hmacDigest,
        version: 1,
        vitalSignsTrend: verified.data.vitalSigns
          ? { ...verified.data.vitalSigns, recordedAt: new Date().toISOString() }
          : undefined,
        claimStatus: "DRAFT",
      },
    });

    await recordSecurityAuditBestEffort({
      actorId: doctorId,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.WRITE_RME,
      targetResource: `${instance}/${created.id}`,
      severity: AuditSeverity.INFO,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Dokter ${auth.session.name} menyimpan RME ${created.id} (v1, ICD-10 ${created.primaryIcd10}) untuk pasien ${patient.id}.`,
    });

    safeRevalidate(["/nakes", "/pasien/rekam-medis"]);

    return jsonOk(
      {
        id: created.id,
        patientId: created.patientId,
        doctorId: created.doctorId,
        faskesId: created.faskesId,
        primaryIcd10: created.primaryIcd10,
        diagnosisShort: created.diagnosisShort,
        version: created.version,
        hmacDigest: created.hmacDigest,
        createdAt: created.createdAt.toISOString(),
      },
      201,
      { Location: `/api/v1/medical-records/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Rekam Medis");
  }
}
