import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditSeverity, FaskesStatus, ImageType } from "@prisma/client";
import { requireSession, recordSecurityAuditBestEffort } from "@/features/auth/guard";
import { EMPTY_SHA256_HMAC, STATIC_FORBIDDEN_IV } from "@/features/medical-records/crypto-service";

const AttachmentUploadSchema = z.object({
  medicalRecordId: z.string({ message: "medicalRecordId wajib diisi." }).min(3),
  title: z.string({ message: "Judul lampiran wajib diisi." }).min(2).max(160),
  type: z.enum(["RONTGEN", "USG", "LAB", "EKG", "FOTO_KLINIS"], {
    message: "Tipe citra medis harus salah satu dari RONTGEN, USG, LAB, EKG, atau FOTO_KLINIS.",
  }),
  encryptedBlobHex: z
    .string({ message: "encryptedBlobHex wajib berupa hex valid." })
    .regex(/^[0-9a-fA-F]+$/, { message: "Blob terenkripsi wajib berformat hex." }),
  ivHex: z
    .string({ message: "ivHex wajib 24 karakter hex." })
    .regex(/^[0-9a-fA-F]{24}$/, { message: "IV wajib 96-bit (24 karakter hex)." }),
  hmacDigest: z
    .string({ message: "hmacDigest wajib 64 karakter hex." })
    .regex(/^[0-9a-fA-F]{64}$/, { message: "HMAC wajib 64 karakter hex." }),
  mimeType: z.string({ message: "mimeType wajib diisi." }).min(3),
  binaryHmac: z.string({ message: "binaryHmac harus string." }).optional(),
  fileSizeBytes: z.number({ message: "fileSizeBytes harus angka." }).int().positive().optional(),
  notes: z.string({ message: "notes harus string." }).optional(),
});

/**
 * GET /api/attachments?id=<imageId>
 * Mengambil lampiran citra medis terenkripsi dari PostgreSQL dengan cek kepemilikan Anti-BOLA.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(["pasien", "nakes", "staf", "admin"], "api:attachments:get");
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { success: false, message: "Parameter query `id` lampiran wajib disertakan." },
      { status: 400 }
    );
  }

  const image = await prisma.medicalImage.findUnique({
    where: { id },
    include: {
      medicalRecord: {
        select: {
          id: true,
          patientId: true,
          doctorId: true,
        },
      },
    },
  });

  if (!image) {
    return NextResponse.json(
      { success: false, message: "Lampiran medis tidak ditemukan." },
      { status: 404 }
    );
  }

  // Penegakan Anti-BOLA: Pasien hanya boleh mengakses lampiran pada berkas miliknya sendiri
  if (auth.role === "pasien" && image.medicalRecord.patientId !== auth.session.id) {
    await recordSecurityAuditBestEffort({
      actorId: auth.session.id,
      actorName: auth.session.name,
      actorRole: auth.role,
      action: AuditAction.IDOR_BLOCKED,
      targetResource: `/api/attachments?id=${id}`,
      severity: AuditSeverity.CRITICAL,
      detail: `BOLA Guard: Pasien ${auth.session.id} mencoba mengunduh lampiran medis ${id} milik pasien ${image.medicalRecord.patientId}.`,
    });
    return NextResponse.json(
      { success: false, message: "403 Forbidden: Anda tidak berwenang mengakses lampiran ini." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: image.id,
        medicalRecordId: image.medicalRecordId,
        title: image.title,
        type: image.type,
        mimeType: image.mimeType,
        encryptedBlobHex: image.encryptedBlobHex,
        ivHex: image.ivHex,
        hmacDigest: image.hmacDigest,
        binaryHmac: image.binaryHmac,
        fileSizeBytes: image.fileSizeBytes ? Number(image.fileSizeBytes) : null,
        notes: image.notes,
        createdAt: image.createdAt.toISOString(),
      },
    },
    { status: 200 }
  );
}

/**
 * POST /api/attachments
 * Menyimpan lampiran biner terenkripsi (AES-256-GCM + HKDF HMAC) ke tabel `medical_images` PostgreSQL.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(["nakes", "staf", "admin"], "api:attachments:post");
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = AttachmentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message || "Format unggahan lampiran tidak valid.",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (
    data.ivHex.toLowerCase() === STATIC_FORBIDDEN_IV ||
    data.hmacDigest.toLowerCase() === EMPTY_SHA256_HMAC
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Ditolak: Lampiran wajib dienkripsi dengan IV 96-bit acak dan HMAC valid.",
      },
      { status: 400 }
    );
  }

  const faskesId = auth.session.faskesId || "FAS-01";
  const faskes = await prisma.faskes.findUnique({
    where: { id: faskesId },
    select: { nama: true, status: true },
  });
  if (faskes?.status === FaskesStatus.QUARANTINED) {
    return NextResponse.json(
      {
        success: false,
        message: `403 Forbidden (Kill-Switch Siber): ${faskes.nama} sedang berstatus KARANTINA.`,
      },
      { status: 403 }
    );
  }

  const record = await prisma.medicalRecord.findUnique({
    where: { id: data.medicalRecordId },
    select: { id: true },
  });
  if (!record) {
    return NextResponse.json(
      { success: false, message: "Berkas rekam medis induk tidak ditemukan." },
      { status: 404 }
    );
  }

  const imgId = `IMG-${Date.now().toString().slice(-6)}`;
  const created = await prisma.medicalImage.create({
    data: {
      id: imgId,
      medicalRecordId: data.medicalRecordId,
      title: data.title,
      type: data.type as ImageType,
      encryptedBlobHex: data.encryptedBlobHex,
      ivHex: data.ivHex,
      hmacDigest: data.hmacDigest,
      mimeType: data.mimeType,
      binaryHmac: data.binaryHmac || null,
      fileSizeBytes: data.fileSizeBytes ? BigInt(data.fileSizeBytes) : null,
      notes: data.notes || "Lampiran biner terenkripsi AES-256-GCM + HKDF HMAC",
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id: created.id,
        medicalRecordId: created.medicalRecordId,
        title: created.title,
        type: created.type,
        mimeType: created.mimeType,
        fileSizeBytes: created.fileSizeBytes ? Number(created.fileSizeBytes) : null,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
