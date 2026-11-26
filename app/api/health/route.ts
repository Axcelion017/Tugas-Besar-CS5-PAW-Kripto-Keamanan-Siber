import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/health
 * Endpoint healthcheck standar untuk Docker, Kubernetes, dan pemantauan observabilitas.
 * Memverifikasi konektivitas basis data PostgreSQL 17 secara langsung.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        service: "jagamedis-his",
        version: "0.3.2-fase3",
        database: "connected",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Database unreachable";
    return NextResponse.json(
      {
        status: "degraded",
        service: "jagamedis-his",
        database: "disconnected",
        error: detail,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
