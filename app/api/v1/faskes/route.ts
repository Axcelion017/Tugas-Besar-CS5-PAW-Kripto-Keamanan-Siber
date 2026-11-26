import { NextRequest } from "next/server";
import { FaskesStatus, FaskesType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateFaskesApiSchema, FaskesStatusEnum } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

/**
 * GET /api/v1/faskes
 * Daftar fasilitas kesehatan dengan dukungan filter `?kota=&poli=&gejala=&status=`.
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;
  const kota = searchParams.get("kota")?.trim();
  const poli = searchParams.get("poli")?.trim();
  const gejala = searchParams.get("gejala")?.trim();
  const statusParam = searchParams.get("status")?.trim();

  const where: Prisma.FaskesWhereInput = {};
  if (kota) {
    where.kota = { contains: kota, mode: "insensitive" };
  }
  if (poli) {
    where.spesialisasiList = { has: poli };
  }
  if (gejala) {
    where.kategoriPenyakit = { has: gejala };
  }
  if (statusParam) {
    const parsedStatus = FaskesStatusEnum.safeParse(statusParam);
    if (!parsedStatus.success) {
      return problemResponse({
        slug: "validation-error",
        title: "Invalid Query Parameter",
        status: 422,
        detail: parsedStatus.error.issues[0]?.message || "Parameter status faskes tidak dikenal.",
        instance,
        errors: [
          {
            field: "status",
            message: parsedStatus.error.issues[0]?.message || "Status tidak dikenal.",
            code: "invalid_value",
          },
        ],
      });
    }
    where.status = parsedStatus.data as FaskesStatus;
  }

  try {
    const faskesList = await prisma.faskes.findMany({
      where,
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
      orderBy: { nama: "asc" },
    });

    return jsonOk(
      faskesList.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Daftar Faskes");
  }
}

/**
 * POST /api/v1/faskes
 * Menambahkan fasilitas kesehatan baru (khusus peran Admin Regulator — UR-A03).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["admin"], "POST /api/v1/faskes");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateFaskesApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;
  const id = data.id || `FAS-${Date.now().toString().slice(-6)}`;

  try {
    const created = await prisma.faskes.create({
      data: {
        id,
        kodeFaskes: data.kodeFaskes,
        nama: data.nama,
        tipe: data.tipe as FaskesType,
        alamat: data.alamat,
        kota: data.kota,
        kontak: data.kontak,
        spesialisasiList: data.spesialisasiList,
        kategoriPenyakit: data.kategoriPenyakit,
        status: FaskesStatus.ACTIVE,
      },
    });

    safeRevalidate(["/admin/faskes", "/pasien/faskes"]);

    return jsonOk(
      {
        ...created,
        createdAt: created.createdAt.toISOString(),
      },
      201,
      { Location: `/api/v1/faskes/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Faskes");
  }
}
