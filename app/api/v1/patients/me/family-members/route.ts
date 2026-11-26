import { NextRequest } from "next/server";
import { FamilyRelation } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateFamilyMemberApiSchema } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

/**
 * GET /api/v1/patients/me/family-members
 * Mengambil daftar anggota keluarga/tanggungan milik akun pasien aktif (UR-P11).
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien"], "GET /api/v1/patients/me/family-members");
  if (!auth.ok) return auth.response;

  try {
    const members = await prisma.familyMember.findMany({
      where: { patientId: auth.session.id },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk(
      members.map((m) => ({
        id: m.id,
        patientId: m.patientId,
        name: m.name,
        nik: m.nik,
        relation: m.relation,
        birthDate: m.birthDate.toISOString().split("T")[0],
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Anggota Keluarga");
  }
}

/**
 * POST /api/v1/patients/me/family-members
 * Menambahkan profil tanggungan keluarga baru (Family Proxy — UR-P11).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["pasien"], "POST /api/v1/patients/me/family-members");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateFamilyMemberApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const birthDate = new Date(parsed.data.birthDate);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    return problemResponse({
      slug: "validation-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Tanggal lahir anggota keluarga tidak valid atau melebihi hari ini.",
      instance,
      errors: [{ field: "birthDate", message: "Tanggal lahir tidak valid.", code: "invalid_date" }],
    });
  }

  try {
    const newId = `FAM-${Date.now().toString().slice(-6)}`;
    const created = await prisma.familyMember.create({
      data: {
        id: newId,
        patientId: auth.session.id,
        name: parsed.data.name,
        nik: parsed.data.nik,
        relation: parsed.data.relation as FamilyRelation,
        birthDate,
      },
    });

    safeRevalidate(["/pasien", "/pasien/profil"]);

    return jsonOk(
      {
        id: created.id,
        patientId: created.patientId,
        name: created.name,
        nik: created.nik,
        relation: created.relation,
        birthDate: created.birthDate.toISOString().split("T")[0],
        createdAt: created.createdAt.toISOString(),
      },
      201,
      { Location: `/api/v1/patients/me/family-members/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Anggota Keluarga");
  }
}
