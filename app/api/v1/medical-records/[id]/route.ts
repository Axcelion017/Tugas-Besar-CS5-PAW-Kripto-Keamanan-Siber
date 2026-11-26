import { NextRequest } from "next/server";
import { AuditAction, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
} from "@/lib/api/problem";
import {
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/medical-records/[id]
 * Membaca detail rekam medis dengan penegakan Anti-BOLA ketat & pencatatan SIEM (UR-P06, UR-T03).
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien", "nakes", "admin"], `GET ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Rekam Medis", instance);
  if (!validId.ok) return validId.response;

  const meta = extractRequestMeta(request);

  try {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: validId.id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mrn: true,
            bloodType: true,
            accessGrants: true,
            appointments: true,
          },
        },
        doctor: { select: { id: true, name: true, specialty: true, strNumber: true } },
        faskes: { select: { id: true, nama: true, kota: true } },
        childAddenda: {
          select: {
            id: true,
            version: true,
            addendumReason: true,
            createdAt: true,
          },
          orderBy: { version: "asc" },
        },
      },
    });

    if (!record) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Berkas rekam medis dengan ID '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role === "pasien" && record.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba membaca berkas RME ${validId.id} milik pasien ${record.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang mengakses rekam medis milik pasien lain.",
        instance,
      });
    }

    if (auth.role === "nakes") {
      const allowed =
        record.doctorId === auth.session.id ||
        hasValidGrantForDoctor(record.patient.accessGrants, auth.session.id, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(record.patient.appointments, auth.session.id);

      if (!allowed) {
        await recordSecurityAuditBestEffort({
          actorId: auth.session.id,
          actorName: auth.session.name,
          actorRole: auth.role,
          action: AuditAction.IDOR_BLOCKED,
          targetResource: instance,
          severity: AuditSeverity.CRITICAL,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          detail: `BOLA Guard: Dokter ${auth.session.id} mencoba membaca berkas RME ${validId.id} tanpa consent atau encounter aktif.`,
        });
        return problemResponse({
          slug: "forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Akses ditolak: Tidak ada izin consent aktif atau tiket pemeriksaan untuk berkas ini.",
          instance,
        });
      }
    }

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.VIEW_RME,
      targetResource: instance,
      severity: AuditSeverity.INFO,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `${auth.role} ${auth.session.name} mengakses berkas RME ${validId.id}.`,
    });

    return jsonOk({
      id: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      faskesId: record.faskesId,
      appointmentId: record.appointmentId,
      parentRecordId: record.parentRecordId,
      primaryIcd10: record.primaryIcd10,
      diagnosisShort: record.diagnosisShort,
      encryptedPayload: auth.role === "admin" ? null : record.encryptedPayload,
      ivHex: auth.role === "admin" ? null : record.ivHex,
      hmacDigest: record.hmacDigest,
      version: record.version,
      addendumReason: record.addendumReason,
      claimStatus: record.claimStatus,
      isBreakGlass: record.isBreakGlass,
      createdAt: record.createdAt.toISOString(),
      patient: {
        id: record.patient.id,
        name: record.patient.name,
        mrn: record.patient.mrn,
        bloodType: record.patient.bloodType,
      },
      doctor: record.doctor,
      faskes: record.faskes,
      childAddenda: record.childAddenda.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Rekam Medis");
  }
}
