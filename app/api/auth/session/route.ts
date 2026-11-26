import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { AccountStatus } from "@prisma/client";
import { normalizeRole, UserSession } from "@/lib/auth/auth";
import { LoginSchema } from "@/lib/validations/auth";
import { prisma } from "@/lib/db/prisma";
import {
  registerSessionAsync,
  revokeSessionAsync,
  getSessionFromStoreAsync,
} from "@/lib/auth/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = LoginSchema.safeParse({
      identifier: body?.identifier,
      password: body?.password,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message || "Format kredensial tidak valid.",
        },
        { status: 400 }
      );
    }

    const cleanId = validation.data.identifier.trim().toLowerCase();
    const password = validation.data.password;

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanId },
          { email: cleanId },
          { patient: { nik: cleanId } },
          { doctor: { strNumber: cleanId } },
        ],
      },
      include: {
        patient: true,
        doctor: { include: { faskes: { select: { nama: true } } } },
        staffMember: { include: { faskes: { select: { nama: true } } } },
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, message: "Kredensial atau NIK tidak valid." },
        { status: 401 }
      );
    }

    // Verifikasi 100% Bcrypt (tanpa cabang fallback plaintext)
    const isBcryptHash =
      dbUser.passwordHash.startsWith("$2a$") || dbUser.passwordHash.startsWith("$2b$");
    const isPasswordMatch = isBcryptHash
      ? await bcrypt.compare(password, dbUser.passwordHash)
      : false;

    if (!isPasswordMatch) {
      return NextResponse.json(
        { success: false, message: "Kredensial atau NIK tidak valid." },
        { status: 401 }
      );
    }

    if (dbUser.status === AccountStatus.SUSPENDED || dbUser.status === AccountStatus.REJECTED) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun Anda dinonaktifkan atau permohonan verifikasi ditolak oleh Admin Kemenkes.",
        },
        { status: 403 }
      );
    }

    const roleStr = dbUser.role.toString();
    const role: UserSession["role"] =
      roleStr === "nakes"
        ? "nakes"
        : roleStr === "pasien"
        ? "pasien"
        : (roleStr as "admin" | "staf");

    const displayName =
      dbUser.doctor?.name ||
      dbUser.patient?.name ||
      dbUser.staffMember?.name ||
      dbUser.username;

    const session: UserSession = {
      id: dbUser.id,
      name: displayName,
      username: dbUser.username,
      role,
      nik: dbUser.patient?.nik,
      strNumber: dbUser.doctor?.strNumber,
      sipNumber: dbUser.doctor?.sipNumber,
      specialization: dbUser.doctor?.specialty,
      faskesId: dbUser.doctor?.faskesId || dbUser.staffMember?.faskesId,
      faskesName: dbUser.doctor?.faskes?.nama || dbUser.staffMember?.faskes?.nama,
      status: dbUser.status === AccountStatus.VERIFIED ? "VERIFIED" : "PENDING",
      allergies: dbUser.patient?.allergies || [],
      bloodType: dbUser.patient?.bloodType || undefined,
      phone: dbUser.patient?.emergencyContactPhone || undefined,
      encryptionKeyHex: dbUser.patient?.encryptionKeyHex || undefined,
      posisiStaf: dbUser.staffMember?.posisi as UserSession["posisiStaf"],
    };

    const sessionToken = crypto.randomUUID();
    const maxAge = 14400; // 4 Jam

    await registerSessionAsync(sessionToken, session, maxAge);

    const response = NextResponse.json({
      success: true,
      message: "Sesi berhasil diterbitkan.",
      session,
      targetRole: normalizeRole(session.role),
    });

    response.cookies.set({
      name: "resilio_session_token",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[API /api/auth/session POST] Error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("resilio_session_token")?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, message: "Tidak ada cookie sesi aktif." },
      { status: 401 }
    );
  }

  const session = await getSessionFromStoreAsync(token);
  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        message: "Token sesi tidak valid atau telah kedaluwarsa (Cookie Palsu / Stale Session).",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    sessionTokenPreview: `${token.slice(0, 8)}...`,
    role: normalizeRole(session.role),
    name: session.name,
    session,
  });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("resilio_session_token")?.value;

  if (token) {
    await revokeSessionAsync(token);
  }

  const response = NextResponse.json({
    success: true,
    message: "Sesi berhasil dihapus.",
  });

  response.cookies.delete("resilio_session_token");
  response.cookies.delete("resilio_user_role");

  return response;
}
