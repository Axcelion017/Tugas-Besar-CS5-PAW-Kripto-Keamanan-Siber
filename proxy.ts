import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Network Boundary Guard (konvensi resmi `proxy.ts`, pengganti `middleware.ts`).
 * Memastikan setiap permintaan ke rute dashboard terproteksi memiliki cookie HTTP-Only
 * `resilio_session_token` sebelum masuk ke render pohon komponen.
 * Validasi penuh token & peran (RBAC) ditegakkan di sisi server via `requireSession()`
 * dan `/api/auth/session` terhadap tabel `sessions` PostgreSQL.
 */
export function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get("resilio_session_token")?.value;

  if (!sessionToken || sessionToken.trim().length < 16) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/beranda/:path*",
    "/pasien/:path*",
    "/staf/:path*",
    "/nakes/:path*",
    "/admin/:path*",
  ],
};
