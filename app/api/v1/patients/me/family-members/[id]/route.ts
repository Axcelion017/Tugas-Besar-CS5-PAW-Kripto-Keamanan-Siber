import { NextRequest } from "next/server";
import { AuditAction, AuditSeverity, FamilyRelation } from "@prisma/client";
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
import { UpdateFamilyMemberApiSchema } from "@/lib/validations/api-v1";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/patients/me/family-members/[id]
 * Memperbarui profil tanggungan keluarga milik pasien aktif dengan guard Anti-BOLA (UR-P11).
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien"], `PATCH ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Anggota Keluarga", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = UpdateFamilyMemberApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  let parsedBirthDate: Date | undefined;
  if (parsed.data.birthDate) {
    parsedBirthDate = new Date(parsed.data.birthDate);
    if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate > new Date()) {
      return problemResponse({
        slug: "validation-error",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Tanggal lahir tidak valid atau melebihi hari ini.",
        instance,
        errors: [{ field: "birthDate", message: "Tanggal lahir tidak valid.", code: "invalid_date" }],
      });
    }
  }

  try {
    const existing = await prisma.familyMember.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Anggota keluarga '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (existing.patientId !== auth.session.id) {
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
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengubah anggota keluarga ${validId.id} milik pasien ${existing.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda hanya dapat mengubah anggota keluarga pada akun Anda sendiri.",
        instance,
      });
    }

    const updated = await prisma.familyMember.update({
      where: { id: validId.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.nik !== undefined ? { nik: parsed.data.nik } : {}),
        ...(parsed.data.relation !== undefined
          ? { relation: parsed.data.relation as FamilyRelation }
          : {}),
        ...(parsedBirthDate !== undefined ? { birthDate: parsedBirthDate } : {}),
      },
    });

    safeRevalidate(["/pasien", "/pasien/profil"]);

    return jsonOk({
      id: updated.id,
      patientId: updated.patientId,
      name: updated.name,
      nik: updated.nik,
      relation: updated.relation,
      birthDate: updated.birthDate.toISOString().split("T")[0],
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Anggota Keluarga");
  }
}

/**
 * DELETE /api/v1/patients/me/family-members/[id]
 * Menghapus profil tanggungan keluarga milik pasien aktif (Anti-BOLA — UR-P11).
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien"], `DELETE ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Anggota Keluarga", instance);
  if (!validId.ok) return validId.response;

  try {
    const existing = await prisma.familyMember.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Anggota keluarga '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (existing.patientId !== auth.session.id) {
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
        detail: `BOLA Guard: Pasien ${auth.session.id} mencoba menghapus anggota keluarga ${validId.id} milik pasien ${existing.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang menghapus anggota keluarga milik akun lain.",
        instance,
      });
    }

    await prisma.familyMember.delete({ where: { id: validId.id } });
    safeRevalidate(["/pasien", "/pasien/profil"]);

    return noContentResponse();
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Anggota Keluarga");
  }
}
