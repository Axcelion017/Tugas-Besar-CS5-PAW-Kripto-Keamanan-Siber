import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";

export const PROBLEM_CONTENT_TYPE = "application/problem+json; charset=utf-8";
const PROBLEM_BASE_URI = "https://jagamedis.id/problems";

export interface ProblemFieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ProblemFieldError[];
}

export interface ProblemOptions {
  slug:
    | "bad-request"
    | "invalid-json"
    | "invalid-path-param"
    | "unauthorized"
    | "forbidden"
    | "not-found"
    | "conflict"
    | "validation-error"
    | "rate-limited"
    | "internal-error";
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ProblemFieldError[];
  headers?: HeadersInit;
}

/**
 * Menghasilkan respons galat standar RFC 9457 (Problem Details for HTTP APIs)
 * dengan header wajib `Content-Type: application/problem+json; charset=utf-8`.
 */
export function problemResponse(options: ProblemOptions): NextResponse<ProblemDetails> {
  const payload: ProblemDetails = {
    type: `${PROBLEM_BASE_URI}/${options.slug}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance: options.instance,
    ...(options.errors && options.errors.length > 0 ? { errors: options.errors } : {}),
  };

  const headers = new Headers(options.headers);
  headers.set("Content-Type", PROBLEM_CONTENT_TYPE);

  return new NextResponse(JSON.stringify(payload), {
    status: options.status,
    headers,
  }) as NextResponse<ProblemDetails>;
}

/**
 * Mem-parse body JSON dari request secara aman.
 * Menolak body bukan JSON valid (syntax error atau bukan object/array JSON) dengan HTTP 400 RFC 9457.
 */
export async function parseJsonObject(
  request: NextRequest
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse<ProblemDetails> }
> {
  const instance = request.nextUrl.pathname;
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return {
      ok: false,
      response: problemResponse({
        slug: "invalid-json",
        title: "Invalid JSON Body",
        status: 400,
        detail: "Body permintaan harus berupa objek JSON yang valid (RFC 8259).",
        instance,
      }),
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      response: problemResponse({
        slug: "invalid-json",
        title: "Invalid JSON Body",
        status: 400,
        detail: "Body permintaan harus berupa objek JSON (key-value), bukan primitif atau array.",
        instance,
      }),
    };
  }

  return { ok: true, data: parsed as Record<string, unknown> };
}

/**
 * Mengonversi ZodError menjadi respons RFC 9457 (default HTTP 422 Unprocessable Entity).
 */
export function zodProblemResponse(
  error: ZodError,
  instance: string,
  status: 400 | 422 = 422
): NextResponse<ProblemDetails> {
  const errors: ProblemFieldError[] = error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "_root",
    message: issue.message,
    code: issue.code,
  }));

  return problemResponse({
    slug: status === 400 ? "bad-request" : "validation-error",
    title: status === 400 ? "Bad Request" : "Unprocessable Entity",
    status,
    detail: errors[0]?.message || "Data yang dikirim tidak memenuhi skema validasi.",
    instance,
    errors,
  });
}

export const PathIdSchema = z
  .string({ message: "Parameter ID pada path wajib diisi." })
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,36}$/, {
    message:
      "Format parameter ID tidak valid (wajib 3-36 karakter alfanumerik, tanda hubung, atau garis bawah).",
  });

/**
 * Memvalidasi parameter dinamis `[id]` hasil `await context.params` sebelum diteruskan ke kueri Prisma.
 */
export function validatePathId(
  rawId: string | undefined,
  resourceLabel: string,
  instance: string
): { ok: true; id: string } | { ok: false; response: NextResponse<ProblemDetails> } {
  const parsed = PathIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return {
      ok: false,
      response: problemResponse({
        slug: "invalid-path-param",
        title: "Invalid Resource Identifier",
        status: 400,
        detail: `Parameter ID untuk ${resourceLabel} tidak valid: ${parsed.error.issues[0]?.message}`,
        instance,
        errors: [
          {
            field: "id",
            message: parsed.error.issues[0]?.message || "ID tidak valid.",
            code: "invalid_format",
          },
        ],
      }),
    };
  }
  return { ok: true, id: parsed.data };
}

/**
 * Memetakan error Prisma umum (P2025, P2002, P2003) ke status HTTP & RFC 9457 yang tepat.
 */
export function prismaErrorToProblem(
  error: unknown,
  instance: string,
  resourceLabel: string
): NextResponse<ProblemDetails> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return problemResponse({
        slug: "not-found",
        title: "Resource Not Found",
        status: 404,
        detail: `${resourceLabel} tidak ditemukan di basis data.`,
        instance,
      });
    }
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "atribut unik";
      return problemResponse({
        slug: "conflict",
        title: "Conflict",
        status: 409,
        detail: `Data ${resourceLabel} dengan ${target} tersebut sudah terdaftar di sistem.`,
        instance,
      });
    }
    if (error.code === "P2003") {
      return problemResponse({
        slug: "conflict",
        title: "Relational Conflict",
        status: 409,
        detail: `Operasi pada ${resourceLabel} ditolak karena konflik integritas relasi (data masih direferensikan atau referensi induk tidak ditemukan).`,
        instance,
      });
    }
  }

  console.error(`[API v1 Error] ${instance}:`, error);
  return problemResponse({
    slug: "internal-error",
    title: "Internal Server Error",
    status: 500,
    detail: `Terjadi kesalahan internal saat memproses ${resourceLabel}.`,
    instance,
  });
}

export function jsonOk<T>(data: T, status: 200 | 201 = 200, headers?: HeadersInit) {
  return NextResponse.json({ data }, { status, headers });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
