import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import {
  AppointmentStatus,
  FaskesStatus,
  GrantEntityType,
  Prisma,
  TriaseLevel,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/api/auth";
import {
  jsonOk,
  parseJsonObject,
  prismaErrorToProblem,
  problemResponse,
  zodProblemResponse,
} from "@/lib/api/problem";
import { CreateAppointmentApiSchema } from "@/lib/validations/api-v1";
import { safeRevalidate } from "@/lib/utils/revalidate";

const VALID_APPOINTMENT_STATUSES = new Set<string>(Object.values(AppointmentStatus));
const VALID_TRIASE_LEVELS = new Set<string>(Object.values(TriaseLevel));

/**
 * GET /api/v1/appointments
 * Mengambil daftar antrean kunjungan sesuai scope RBAC (Anti-BOLA).
 * Mendukung filter `?status=&faskesId=&priority=`.
 */
export async function GET(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "nakes", "admin"],
    "GET /api/v1/appointments"
  );
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const statusParam = searchParams.get("status")?.trim();
  const priorityParam = searchParams.get("priority")?.trim();
  const faskesIdParam = searchParams.get("faskesId")?.trim();

  if (statusParam && !VALID_APPOINTMENT_STATUSES.has(statusParam)) {
    return problemResponse({
      slug: "validation-error",
      title: "Invalid Query Parameter",
      status: 422,
      detail: `Status antrean '${statusParam}' tidak dikenal.`,
      instance,
      errors: [{ field: "status", message: "Nilai status antrean tidak valid.", code: "invalid_value" }],
    });
  }

  if (priorityParam && !VALID_TRIASE_LEVELS.has(priorityParam)) {
    return problemResponse({
      slug: "validation-error",
      title: "Invalid Query Parameter",
      status: 422,
      detail: `Skala prioritas triase '${priorityParam}' tidak dikenal (wajib HIJAU, KUNING, atau MERAH).`,
      instance,
      errors: [{ field: "priority", message: "Prioritas triase tidak valid.", code: "invalid_value" }],
    });
  }

  const where: Prisma.AppointmentWhereInput = {};
  if (auth.role === "pasien") {
    where.patientId = auth.session.id;
  } else if (auth.role === "nakes") {
    where.OR = [{ doctorId: auth.session.id }, { dpjpId: auth.session.id }];
  } else if (auth.role === "staf") {
    where.faskesId = auth.session.faskesId || faskesIdParam || undefined;
  } else if (faskesIdParam) {
    where.faskesId = faskesIdParam;
  }

  if (statusParam) {
    where.status = statusParam as AppointmentStatus;
  }
  if (priorityParam) {
    where.triageAssessment = { triaseLevel: priorityParam as TriaseLevel };
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, mrn: true, bloodType: true } },
        faskes: { select: { id: true, nama: true, status: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
        dpjp: { select: { id: true, name: true, specialty: true } },
        triageAssessment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      appointments.map((apt) => ({
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
      }))
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Daftar Antrean Kunjungan");
  }
}

/**
 * POST /api/v1/appointments
 * Membuat jadwal kunjungan (booking + Auto-Consent + PIN 6-digit — UR-P04 / UR-S01).
 */
export async function POST(request: NextRequest) {
  const instance = request.nextUrl.pathname;
  const auth = await requireApiSession(
    request,
    ["pasien", "staf", "admin"],
    "POST /api/v1/appointments"
  );
  if (!auth.ok) return auth.response;

  const jsonBody = await parseJsonObject(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = CreateAppointmentApiSchema.safeParse(jsonBody.data);
  if (!parsed.success) {
    return zodProblemResponse(parsed.error, instance, 422);
  }

  const data = parsed.data;
  const patientId = auth.role === "pasien" ? auth.session.id : data.patientId;
  if (!patientId) {
    return problemResponse({
      slug: "validation-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Field patientId wajib diisi untuk pendaftaran oleh Staf/Admin.",
      instance,
      errors: [{ field: "patientId", message: "patientId wajib diisi.", code: "required" }],
    });
  }

  try {
    const [faskes, doctor, patient] = await Promise.all([
      prisma.faskes.findUnique({
        where: { id: data.faskesId },
        select: { id: true, nama: true, status: true },
      }),
      prisma.doctor.findUnique({
        where: { id: data.doctorId },
        select: { id: true, name: true, specialty: true, faskesId: true },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true },
      }),
    ]);

    if (!faskes) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Faskes '${data.faskesId}' tidak ditemukan.`,
        instance,
      });
    }

    if (faskes.status === FaskesStatus.QUARANTINED) {
      return problemResponse({
        slug: "forbidden",
        title: "Facility Quarantined",
        status: 403,
        detail: `Pendaftaran ditolak: ${faskes.nama} sedang berstatus KARANTINA (Kill-Switch Siber).`,
        instance,
      });
    }

    if (!doctor) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Dokter '${data.doctorId}' tidak ditemukan.`,
        instance,
      });
    }

    if (!patient) {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `Pasien '${patientId}' tidak ditemukan.`,
        instance,
      });
    }

    const aptId = `APT-2026-${Date.now().toString().slice(-6)}`;
    const consentPin = randomInt(100000, 1000000).toString();
    const visitDate = new Date(data.tanggal);

    const created = await prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.create({
        data: {
          id: aptId,
          patientId,
          faskesId: faskes.id,
          doctorId: doctor.id,
          tanggal: visitDate,
          jam: data.jam,
          poli: data.poli || doctor.specialty,
          keluhanAwal: data.keluhanAwal,
          consentActive: data.autoConsent,
          consentPin,
          status: AppointmentStatus.PENDING_ARRIVAL,
        },
        include: {
          faskes: { select: { id: true, nama: true } },
          doctor: { select: { id: true, name: true, specialty: true } },
        },
      });

      if (data.autoConsent) {
        const validUntil = new Date(
          Math.max(visitDate.getTime(), Date.now()) + 48 * 60 * 60 * 1000
        );
        await tx.accessGrant.create({
          data: {
            id: `AG-${Date.now().toString().slice(-6)}`,
            patientId,
            entityId: doctor.id,
            entityName: doctor.name,
            entityType: GrantEntityType.DOKTER,
            scope: `Auto-Consent Konsultasi (${aptId})`,
            validUntil,
            isRevoked: false,
          },
        });
      }

      return apt;
    });

    safeRevalidate(["/pasien", "/pasien/booking", "/pasien/consent", "/staf", "/nakes"]);

    return jsonOk(
      {
        ...created,
        consentPin: auth.role === "pasien" ? created.consentPin : null,
        tanggal: created.tanggal.toISOString(),
        createdAt: created.createdAt.toISOString(),
        checkInTime: created.checkInTime ? created.checkInTime.toISOString() : null,
      },
      201,
      { Location: `/api/v1/appointments/${created.id}` }
    );
  } catch (error) {
    return prismaErrorToProblem(error, instance, "Antrean Kunjungan");
  }
}
