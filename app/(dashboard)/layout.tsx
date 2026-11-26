"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getUserSession,
  syncSessionFromServer,
  logoutUser,
  UserSession,
  normalizeRole,
} from "@/lib/auth/auth";
import { createAuditLogServerAction } from "@/lib/actions/audit";
import RoleNav from "@/components/shared/RoleNav";
import NetworkStatusBanner from "@/components/shared/NetworkStatusBanner";
import { IconShield } from "@/components/ui/Icons";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const loggedPathRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const serverResult = await syncSessionFromServer();
      if (!active) return;

      if (serverResult.status === "ok") {
        setSession(serverResult.session);
        setIsChecking(false);
        return;
      }

      if (serverResult.status === "unauthenticated") {
        logoutUser();
        router.replace("/login");
        return;
      }

      // Offline-first fallback: gunakan sesi lokal hanya ketika server tidak dapat dijangkau
      const offlineSession = getUserSession();
      if (!offlineSession) {
        router.replace("/login");
        return;
      }
      setSession(offlineSession);
      setIsChecking(false);
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [router]);

  const role = session ? normalizeRole(session.role) : null;

  // Pengecekan Zero-Trust / BOLA Defense pada sisi rute
  const isUnauthorizedAccess =
    role !== null &&
    ((pathname.startsWith("/pasien") && role !== "pasien") ||
      (pathname.startsWith("/nakes") && role !== "nakes") ||
      (pathname.startsWith("/staf") && role !== "staf") ||
      (pathname.startsWith("/admin") && role !== "admin"));

  useEffect(() => {
    if (!isUnauthorizedAccess || !session || !role) return;
    if (loggedPathRef.current === pathname) return;
    loggedPathRef.current = pathname;

    createAuditLogServerAction({
      actorId: session.id,
      actorName: session.name,
      actorRole: role,
      action: "IDOR_BLOCKED",
      targetResource: pathname,
      severity: "CRITICAL",
      detail: `Zero-Trust Route Guard: Pengguna ${session.name} (${role}) ditolak mengakses rute terlarang ${pathname}.`,
    }).catch(() => {
      // Abaikan jika sedang offline
    });
  }, [isUnauthorizedAccess, pathname, role, session]);

  if (isChecking || !session || !role) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-12 max-w-7xl mx-auto font-sans">
        <DashboardSkeleton noticeText="Memverifikasi Kredensial & Kunci Sesi Kriptografi Zero-Trust..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-xl focus:text-xs focus:font-bold"
      >
        Lewati ke Konten Utama
      </a>
      {/* Sidebar Navigasi Berdasarkan Role */}
      <RoleNav session={session} />

      {/* Konten Utama */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0">
        {/* Top Navbar: sticky hanya pada desktop (lg+) agar tidak tumpang tindih dengan mobile bar RoleNav */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 lg:sticky lg:top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider truncate">
              {pathname === "/beranda"
                ? "Beranda Terpadu JagaMedis"
                : pathname.startsWith("/pasien")
                ? "Portal Pasien Mandiri"
                : pathname.startsWith("/nakes")
                ? "Stasiun Kerja Dokter (DPJP)"
                : pathname.startsWith("/staf")
                ? "Meja Staf Nakes (Triase & Admisi)"
                : "Konsol Pengawas & Regulasi (SIEM)"}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NetworkStatusBanner />
          </div>
        </header>

        {/* Konten Halaman */}
        <main id="main-content" className="p-4 sm:p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto min-w-0">
          {isUnauthorizedAccess ? (
            <div className="p-8 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <IconShield size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                Akses Ditolak oleh Zero-Trust Gateway
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Prinsip <strong>Separation of Duties</strong> dan{" "}
                <strong>Least Privilege</strong> membatasi akun Anda ({session.role.toUpperCase()}) untuk mengakses rute ini.
              </p>
              <div className="p-4 bg-slate-50 rounded-2xl text-xs font-mono text-slate-700 text-left">
                <p>• Percobaan Rute: {pathname}</p>
                <p>• Akun Pengguna: {session.name} ({session.id})</p>
                <p>• Status: 403 Forbidden (Log dicatat ke SIEM)</p>
              </div>
              <button
                onClick={() => router.replace(`/${role}`)}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
              >
                Kembali ke Dashboard Resmi ({role.toUpperCase()})
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
