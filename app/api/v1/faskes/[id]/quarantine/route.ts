import { NextRequest } from "next/server";
import { AuditAction, AuditSeverity, FaskesStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractRequestMeta, requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { QuarantineFaskesApiSchema } from "@/lib/validations/api-v1";
import { recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/faskes/[id]/quarantine
 * Ransomware Kill-Switch: isolasi/pemulihan status faskes (ACTIVE <-> QUARANTINED) khusus Admin Regulator (UR-A03).
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["admin"], `PATCH ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Faskes", instance);
  if (!validId.ok) return validId.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = QuarantineFaskesApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const nextStatus = parsed.data.status as FaskesStatus;
  const meta = extractRequestMeta(request);

  try {
    const updated = await prisma.faskes.update({
      where: { id: validId.id },
      data: { status: nextStatus },
    });

    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.QUARANTINE_FASKES,
      targetResource: instance,
      severity: nextStatus === FaskesStatus.QUARANTINED ? AuditSeverity.CRITICAL : AuditSeverity.WARN,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Admin ${auth.session.name} mengubah status isolasi faskes ${updated.nama} (${validId.id}) menjadi ${nextStatus}.${parsed.data.reason ? ` Alasan: ${parsed.data.reason}` : ""}`,
    });

    safeRevalidate(["/admin/faskes", "/admin", "/pasien/faskes"]);

    return jsonOk({
      id: updated.id,
      nama: updated.nama,
      status: updated.status,
      reason: parsed.data.reason || null,
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Faskes");
  }
}
