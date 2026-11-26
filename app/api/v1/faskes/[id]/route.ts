import { NextRequest } from "next/server";
import { FaskesType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  noContentResponse,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  validatePathId,
  zodProblemResponse,
} from "@/lib/api/problem";
import { UpdateFaskesApiSchema } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/faskes/[id]
 * Mengambil detail faskes beserta daftar dokter praktik dan kuota harian (UR-P03).
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Faskes", instance);
  if (!validId.ok) return validId.response;

  try {
    const faskes = await prisma.faskes.findUnique({
      where: { id: validId.id },
      include: {
        doctors: {
          select: {
            id: true,
            name: true,
            specialty: true,
            kuotaHarian: true,
            strNumber: true,
            sipNumber: true,
            isActive: true,
          },
        },
      },
    });

    if (!faskes) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Faskes dengan ID '${validId.id}' tidak ditemukan di direktori nasional JagaMedis.`,
        instance,
      });
    }

    return jsonOk({
      ...faskes,
      createdAt: faskes.createdAt.toISOString(),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Faskes");
  }
}

/**
 * PATCH /api/v1/faskes/[id]
 * Pembaruan sebagian data profil faskes (khusus Admin Regulator).
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

  const parsed = UpdateFaskesApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;

  try {
    const updated = await prisma.faskes.update({
      where: { id: validId.id },
      data: {
        ...(data.nama !== undefined ? { nama: data.nama } : {}),
        ...(data.tipe !== undefined ? { tipe: data.tipe as FaskesType } : {}),
        ...(data.alamat !== undefined ? { alamat: data.alamat } : {}),
        ...(data.kota !== undefined ? { kota: data.kota } : {}),
        ...(data.kontak !== undefined ? { kontak: data.kontak } : {}),
        ...(data.spesialisasiList !== undefined
          ? { spesialisasiList: data.spesialisasiList }
          : {}),
        ...(data.kategoriPenyakit !== undefined
          ? { kategoriPenyakit: data.kategoriPenyakit }
          : {}),
      },
    });

    safeRevalidate(["/admin/faskes", "/pasien/faskes"]);

    return jsonOk({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Faskes");
  }
}

/**
 * DELETE /api/v1/faskes/[id]
 * Menghapus faskes (khusus Admin Regulator).
 * Mengembalikan HTTP 409 Conflict jika faskes masih memiliki relasi dokter, staf, antrean, atau RME (`onDelete: Restrict`).
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["admin"], `DELETE ${instance}`);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const validId = validatePathId(rawId, "Faskes", instance);
  if (!validId.ok) return validId.response;

  try {
    const existing = await prisma.faskes.findUnique({
      where: { id: validId.id },
      include: {
        _count: {
          select: {
            doctors: true,
            staffMembers: true,
            appointments: true,
            medicalRecords: true,
          },
        },
      },
    });

    if (!existing) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Faskes dengan ID '${validId.id}' tidak ditemukan di basis data.`,
        instance,
      });
    }

    const totalRelations =
      existing._count.doctors +
      existing._count.staffMembers +
      existing._count.appointments +
      existing._count.medicalRecords;

    if (totalRelations > 0) {
      return problemResponse({
        slug: "conflict",
        title: "Relational Conflict",
        status: 409,
        detail: `Faskes '${existing.nama}' tidak dapat dihapus karena masih memiliki data relasi aktif (${existing._count.doctors} dokter, ${existing._count.staffMembers} staf, ${existing._count.appointments} antrean, ${existing._count.medicalRecords} rekam medis). Gunakan PATCH /api/v1/faskes/${validId.id}/quarantine untuk isolasi.`,
        instance,
      });
    }

    await prisma.faskes.delete({ where: { id: validId.id } });
    safeRevalidate(["/admin/faskes", "/pasien/faskes"]);

    return noContentResponse();
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Faskes");
  }
}
