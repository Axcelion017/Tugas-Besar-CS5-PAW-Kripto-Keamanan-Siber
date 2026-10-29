import { NextRequest, NextResponse } from "next/server";
import { DEMO_USERS, normalizeRole, UserSession } from "@/lib/auth/auth";
import { registerSession, isSessionValid, revokeSession, getSessionFromStore } from "@/lib/auth/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    const user = DEMO_USERS.find(
      (u) =>
        (u.username.toLowerCase() === identifier ||
          u.email.toLowerCase() === identifier ||
          (u.nik && u.nik === identifier)) &&
        u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Kredensial atau NIK tidak valid." },
        { status: 401 }
      );
    }

    const sessionToken = crypto.randomUUID();
    const maxAge = 14400; // 4 Jam

    const session: UserSession = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      nik: user.nik,
      strNumber: user.strNumber,
      sipNumber: user.sipNumber,
      specialization: user.specialization,
      faskesId: user.faskesId,
      faskesName: user.faskesName,
      status: user.status,
      allergies: user.allergies,
      bloodType: user.bloodType,
      phone: user.phone,
      encryptionKeyHex: user.encryptionKeyHex,
      posisiStaf: user.posisiStaf,
    };

    // Daftarkan ke Stateful Session Store di Server
    registerSession(sessionToken, session, maxAge);

    const response = NextResponse.json({
      success: true,
      message: "Sesi berhasil diterbitkan.",
      session,
      targetRole: normalizeRole(user.role),
    });

    // Terbitkan Cookie Sesi Resmi HTTP-Only
    response.cookies.set({
      name: "resilio_session_token",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    // Terbitkan Cookie Peran Pengguna
    response.cookies.set({
      name: "resilio_user_role",
      value: normalizeRole(user.role),
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("resilio_session_token")?.value;
  const role = request.cookies.get("resilio_user_role")?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, message: "Tidak ada cookie sesi aktif." },
      { status: 401 }
    );
  }

  // Verifikasi keabsahan token ke Stateful Session Store di Server
  if (!isSessionValid(token)) {
    return NextResponse.json(
      { authenticated: false, message: "Token sesi tidak valid atau telah kedaluwarsa (Cookie Palsu / Stale Session)." },
      { status: 401 }
    );
  }

  const session = getSessionFromStore(token);

  return NextResponse.json({
    authenticated: true,
    sessionTokenPreview: `${token.slice(0, 8)}...`,
    role: role || session?.role || "unknown",
    name: session?.name,
  });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("resilio_session_token")?.value;

  if (token) {
    // Hanguskan sesi di Stateful Session Store di Server
    revokeSession(token);
  }

  const response = NextResponse.json({
    success: true,
    message: "Sesi berhasil dihapus.",
  });

  response.cookies.delete("resilio_session_token");
  response.cookies.delete("resilio_user_role");

  return response;
}
