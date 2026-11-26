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
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/access-grants/[id]/revoke
 * 1-Click Revoke izin akses RME (UU PDP Pasal 20 — UR-P07) dengan Anti-BOLA guard.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien", "admin"], `POST ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Izin Akses", instance);
  if (!validId.ok) return validId.response;

  const meta = extractRequestMeta(request);

  try {
    const existing = await prisma.accessGrant.findUnique({ where: { id: validId.id } });
    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Izin akses '${validId.id}' tidak ditemukan.`,
        instance,
      });
    }

    if (auth.role !== "admin" && existing.patientId !== auth.session.id) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.IDOR_BLOCKED,
        targetResource: instance,
        severity: AuditSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `BOLA Guard: Pengguna ${auth.session.id} mencoba mencabut izin akses ${validId.id} milik pasien ${existing.patientId}.`,
      });
      return problemResponse({
        slug: "forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Anda tidak berwenang mencabut izin akses milik pasien lain.",
        instance,
      });
    }

    const updated = existing.isRevoked
      ? existing
      : await prisma.accessGrant.update({
          where: { id: validId.id },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });

    if (!existing.isRevoked) {
      await recordSecurityAuditBestEffort({
        actorId: auth.session.id,
        actorName: auth.session.name,
        actorRole: auth.role,
        action: AuditAction.REVOKE_CONSENT,
        targetResource: instance,
        severity: AuditSeverity.INFO,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detail: `Pasien ${auth.session.name} mencabut izin akses ${validId.id} untuk ${existing.entityName} (1-Click Revoke UU PDP).`,
      });
      safeRevalidate(["/pasien/consent", "/pasien", "/pasien/audit-log"]);
    }

    return jsonOk({
      ...updated,
      validUntil: updated.validUntil.toISOString(),
      revokedAt: updated.revokedAt ? updated.revokedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Izin Akses");
  }
}
