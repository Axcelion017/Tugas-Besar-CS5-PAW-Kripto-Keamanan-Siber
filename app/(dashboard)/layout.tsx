"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserSession, UserSession, normalizeRole } from "@/lib/auth/auth";
import RoleNav from "@/components/shared/RoleNav";
import NetworkStatusBanner from "@/components/shared/NetworkStatusBanner";
import { IconShield } from "@/components/ui/Icons";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const cur = getUserSession();
    if (!cur) {
      router.replace("/login");
      return;
    }
    setSession(cur);
    setIsChecking(false);
  }, [router]);

  if (isChecking || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-semibold text-sm tracking-wide">
          Memverifikasi Otorisasi Sesi & Zero-Trust Gate...
        </p>
      </div>
    );
  }

  const role = normalizeRole(session.role);

  // Pengecekan Zero-Trust / BOLA Defense pada sisi rute
  const isUnauthorizedAccess =
    (pathname.startsWith("/pasien") && role !== "pasien") ||
    (pathname.startsWith("/nakes") && role !== "nakes") ||
    (pathname.startsWith("/admin") && role !== "admin");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col lg:flex-row">
      {/* Sidebar Navigasi Berdasarkan Role */}
      <RoleNav session={session} />

      {/* Konten Utama */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              {pathname.startsWith("/pasien")
                ? "Portal Pasien Mandiri"
                : pathname.startsWith("/nakes")
                ? "Stasiun Kerja Tenaga Kesehatan"
                : "Konsol Pengawas & Regulasi (SIEM)"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <NetworkStatusBanner />
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto">
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
