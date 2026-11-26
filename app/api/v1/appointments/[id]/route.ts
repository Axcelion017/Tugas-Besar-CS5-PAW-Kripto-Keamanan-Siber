import { NextRequest } from "next/server";
import { AppointmentStatus, AuditAction, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  noContentResponse,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { UpdateAppointmentApiSchema } from "@/lib/validations/api-v1";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/appointments/[id]
 * Mengambil detail antrean kunjungan dengan penegakan Anti-BOLA.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    `GET ${instance}`
  );
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: validId.id },
      include: {
        patient: { select: { id: true, name: true, mrn: true, bloodType: true } },
        faskes: { select: { id: true, nama: true, status: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
        dpjp: { select: { id: true, name: true, specialty: true } },
        triageAssessment: true,
      },
    });

    if (!apt) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    const isPasienUnauthorized = auth.role === "pasien" && apt.patientId !== auth.session.id;
    const isNakesUnauthorized =
      auth.role === "nakes" && apt.doctorId !== auth.session.id && apt.dpjpId !== auth.session.id;

    if (isPasienUnauthorized || isNakesUnauthorized) {
      const meta = extractRequestMeta(request);
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: ${auth.role} ${auth.session.id} mencoba membaca antrean ${validId.id} milik pasien ${apt.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak memiliki wewenang untuk melihat antrean kunjungan ini.",
        instance,
      });
    }

    return jsonOk({
      ...apt,
      consentPin: auth.role === "pasien" ? apt.consentPin : null,
      tanggal: apt.tanggal.toISOString(),
      createdAt: apt.createdAt.toISOString(),
      checkInTime: apt.checkInTime ? apt.checkInTime.toISOString() : null,
      triageAssessment: apt.triageAssessment
        ? {
            ...apt.triageAssessment,
            temperature: Number(apt.triageAssessment.temperature),
            beratBadan: apt.triageAssessment.beratBadan
              ? Number(apt.triageAssessment.beratBadan)
              : null,
            tinggiBadan: apt.triageAssessment.tinggiBadan
              ? Number(apt.triageAssessment.tinggiBadan)
              : null,
            assessedAt: apt.triageAssessment.assessedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Antrean Kunjungan");
  }
}

/**
 * PATCH /api/v1/appointments/[id]
 * Mengubah jadwal (tanggal/jam/keluhan) antrean yang belum selesai diperiksa.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien", "staf", "admin"], `PATCH ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = UpdateAppointmentApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  try {
    const existing = await prisma.appointment.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role === "pasien" && existing.patientId !== auth.session.id) {
      const meta = extractRequestMeta(request);
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengubah antrean ${validId.id} milik pasien ${existing.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang mengubah antrean kunjungan milik pasien lain.",
        instance,
      });
    }

    if (
      existing.status === AppointmentStatus.COMPLETED ||
      existing.status === AppointmentStatus.CANCELLED
    ) {
      return problemResponse({
        slug: "conflict",
        title: "Conflict",
        status: 409,
        detail: `Antrean berstatus ${existing.status} tidak dapat diubah jadwalnya.`,
        instance,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: validId.id },
      data: {
        ...(parsed.data.tanggal ? { tanggal: new Date(parsed.data.tanggal) } : {}),
        ...(parsed.data.jam ? { jam: parsed.data.jam } : {}),
        ...(parsed.data.keluhanAwal ? { keluhanAwal: parsed.data.keluhanAwal } : {}),
      },
    });

    safeRevalidate(["/pasien", "/pasien/booking", "/staf", "/nakes"]);

    return jsonOk({
      ...updated,
      consentPin: auth.role === "pasien" ? updated.consentPin : null,
      tanggal: updated.tanggal.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      checkInTime: updated.checkInTime ? updated.checkInTime.toISOString() : null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Antrean Kunjungan");
  }
}

/**
 * DELETE /api/v1/appointments/[id]
 * Menghapus/membatalkan antrean. Mengembalikan HTTP 409 jika sudah selesai atau memiliki RME terkait.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien", "staf", "admin"], `DELETE ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Antrean Kunjungan", instance);
  if (!validId.ok) return validId.response;

  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: validId.id },
      include: {
        _count: { select: { medicalRecords: true } },
      },
    });

    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Antrean kunjungan '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role === "pasien" && existing.patientId !== auth.session.id) {
      const meta = extractRequestMeta(request);
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba menghapus antrean ${validId.id} milik pasien ${existing.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang menghapus antrean milik pasien lain.",
        instance,
      });
    }

    if (existing.status === AppointmentStatus.COMPLETED || existing._count.medicalRecords > 0) {
      return problemResponse({
        slug: "conflict",
        title: "Relational Conflict",
        status: 409,
        detail:
          "Antrean yang telah selesai atau memiliki berkas rekam medis tidak dapat dihapus demi integritas rekam medis (Permenkes 24/2022).",
        instance,
      });
    }

    await prisma.appointment.delete({ where: { id: validId.id } });
    safeRevalidate(["/pasien", "/pasien/booking", "/staf", "/nakes"]);

    return noContentResponse();
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Antrean Kunjungan");
  }
}
