import { NextRequest } from "next/server";
import { FaskesStatus, FaskesType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  jsonPaginatedOk,
  parseJsonBody,
  parseQueryParams,
  prismaErrorToProblem,
} from "@/lib/api/problem";
import { CreateFaskesApiSchema, FaskesQuerySchema } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

/**
 * GET /api/v1/faskes
 * Daftar fasilitas kesehatan dengan validasi query Zod, filter sesuai model `Faskes`
 * (`?kota=&poli=&gejala=&tipe=&status=&q=`), serta pagination (`?page=&limit=`) dan meta total via transaksi.
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const parsedQuery = parseQueryParams(request, FaskesQuerySchema, 400);
  if (!parsedQuery.ok) return parsedQuery.response;

  const { page, limit, kota, poli, gejala, tipe, status, q } = parsedQuery.data;

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
  if (tipe) {
    where.tipe = tipe as FaskesType;
  }
  if (status) {
    where.status = status as FaskesStatus;
  }
  if (q) {
    where.OR = [
      { nama: { contains: q, mode: "insensitive" } },
      { kodeFaskes: { contains: q, mode: "insensitive" } },
      { alamat: { contains: q, mode: "insensitive" } },
      { kota: { contains: q, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  try {
    const { faskesList, total } = await prisma.$transaction(async (tx) => {
      const items = await tx.faskes.findMany({
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
        skip,
        take: limit,
      });
      const count = await tx.faskes.count({ where });
      return { faskesList: items, total: count };
    });

    return jsonPaginatedOk(
      faskesList.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Daftar Faskes");
  }
}

/**
 * POST /api/v1/faskes
 * Menambahkan fasilitas kesehatan baru (khusus peran Admin Regulator — UR-A03).
 * JSON rusak -> 400, validasi isi Zod gagal -> 422, sukses -> 201 Created + header Location.
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(request, ["admin"], "POST /api/v1/faskes");
  if (!auth.ok) return auth.response;

  const parsedBody = await parseJsonBody(request, CreateFaskesApiSchema);
  if (!parsedBody.ok) return parsedBody.response;

  const data = parsedBody.data;
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
