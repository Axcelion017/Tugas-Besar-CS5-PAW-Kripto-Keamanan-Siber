"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserSession, logoutUser, normalizeRole } from "@/lib/auth/auth";
import { logoutServerAction } from "@/lib/actions/auth";
import { LogoutModal } from "@/components/ui/LogoutModal";
import {
  IconActivity,
  IconSearch,
  IconCalendar,
  IconFileText,
  IconShield,
  IconEye,
  IconMessageSquare,
  IconStethoscope,
  IconSend,
  IconRefreshCw,
  IconBarChart,
  IconBuilding,
  IconAlertTriangle,
  IconTool,
  IconLogOut,
  IconUsers,
} from "@/components/ui/Icons";

interface RoleNavProps {
  session: UserSession;
}

export function RoleNav({ session }: RoleNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = normalizeRole(session.role);

  const handleConfirmLogout = async () => {
    try {
      await logoutServerAction();
    } catch {
      // Abaikan jika network offline
    }
    logoutUser();
    router.replace("/login");
  };

  // 1. Navigasi Pasien
  const pasienLinks = [
    { href: "/pasien", label: "Ringkasan Kesehatan", icon: IconActivity },
    { href: "/pasien/faskes", label: "Pencarian Faskes", icon: IconSearch },
    { href: "/pasien/booking", label: "Booking Pemeriksaan", icon: IconCalendar },
    { href: "/pasien/rekam-medis", label: "Rekam Medis (RME)", icon: IconFileText },
    { href: "/pasien/consent", label: "Izin Akses (Consent)", icon: IconShield },
    { href: "/pasien/audit-log", label: "Audit Log Akses", icon: IconEye },
    { href: "/pasien/tiket-kendala", label: "Laporan Kendala", icon: IconMessageSquare },
  ];

  // 2. Navigasi Tenaga Medis (Dokter DPJP)
  const nakesLinks = [
    { href: "/nakes", label: "Antrean & Jadwal Hari Ini", icon: IconStethoscope },
    { href: "/nakes/pasien-lookup", label: "Pencarian Pasien (NIK & Break-Glass)", icon: IconSearch },
    { href: "/nakes/rujukan", label: "Surat Rujukan Digital", icon: IconSend },
    { href: "/nakes/offline-sync", label: "Status Sinkronisasi Offline", icon: IconRefreshCw },
  ];

  // 3. Navigasi Staf Nakes Faskes (Perawat Triase & Admisi) - ROLE BARU
  const stafLinks = [
    { href: "/staf", label: "Admisi & Check-in Antrean", icon: IconCalendar },
    { href: "/staf/triase", label: "Triase & Tanda Vital Awal", icon: IconActivity },
    { href: "/staf/assign-dpjp", label: "Pengarahan Dokter (DPJP)", icon: IconUsers },
    { href: "/staf/rujukan", label: "Administrasi Rujukan Faskes", icon: IconSend },
  ];

  // 4. Navigasi Admin Regulator (Kemenkes)
  const adminLinks = [
    { href: "/admin", label: "Ringkasan Eksekutif", icon: IconBarChart },
    { href: "/admin/verifikasi-kyc", label: "Verifikasi Visual e-KYC", icon: IconShield },
    { href: "/admin/verifikasi-kyd", label: "Verifikasi Dokumen e-KYD", icon: IconFileText },
    { href: "/admin/faskes", label: "Master Faskes & Kill-Switch", icon: IconBuilding },
    { href: "/admin/siem-monitor", label: "SIEM Live Security Feed", icon: IconAlertTriangle },
    { href: "/admin/incident-center", label: "Pusat Kendala & Trouble", icon: IconTool },
  ];

  const currentLinks =
    role === "pasien"
      ? pasienLinks
      : role === "nakes"
      ? nakesLinks
      : role === "staf"
      ? stafLinks
      : adminLinks;

  const roleBadgeColor =
    role === "pasien"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : role === "nakes"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : role === "staf"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-purple-100 text-purple-800 border-purple-200";

  const roleLabel =
    role === "pasien"
      ? "Pasien Terdaftar"
      : role === "nakes"
      ? "Dokter Penanggung Jawab (DPJP)"
      : role === "staf"
      ? "Staf Nakes (Triase & Admisi)"
      : "Admin Regulator (Kemenkes)";

  return (
    <>
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Mobile Top Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
            R
          </div>
          <span className="font-black text-slate-900 tracking-tight text-sm">
            RESILIO-HEALTH
          </span>
        </div>

        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleBadgeColor}`}>
          {role.toUpperCase()}
        </span>
      </div>

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo Brand */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-red-200">
                R
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                  RESILIO-HEALTH
                </h1>
                <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">
                  HIS Zero-Trust & Cryptographic
                </p>
              </div>
            </div>

            {/* Profil Sesi Pengguna */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {session.name}
                </span>
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${roleBadgeColor}`}>
                  {session.role.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                {session.nik ? `NIK: ${session.nik}` : session.username}
              </p>
              {session.posisiStaf && (
                <p className="text-[10px] text-amber-700 font-bold truncate mt-0.5">
                  {session.posisiStaf}
                </p>
              )}
              {session.specialization && (
                <p className="text-[10px] text-emerald-700 font-medium truncate mt-0.5">
                  {session.specialization}
                </p>
              )}
              {session.faskesName && (
                <p className="text-[10px] text-slate-600 truncate mt-0.5">
                  {session.faskesName}
                </p>
              )}
            </div>
          </div>

          {/* Navigasi Links */}
          <nav className="p-4 space-y-1">
            <p className="px-3 text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
              Menu {roleLabel}
            </p>
            {currentLinks.map((item) => {
              const IconComp = item.icon;
              const isActive =
                item.href === `/pasien` || item.href === `/nakes` || item.href === `/admin` || item.href === `/staf`
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-red-600 text-white shadow-sm shadow-red-600/30"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <IconComp className={isActive ? "text-white" : "text-slate-400"} size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <IconLogOut className="text-slate-500" size={16} />
            <span>Keluar Sesi</span>
          </button>
          <p className="text-[9px] text-slate-400 text-center">
            Resilio-Health v0.2-alpha • 2026
          </p>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
        />
      )}
    </>
  );
}

export default RoleNav;
