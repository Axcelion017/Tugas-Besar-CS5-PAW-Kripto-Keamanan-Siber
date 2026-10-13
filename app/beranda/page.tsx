"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserSession, logoutUser, UserSession } from "@/lib/auth/auth";
import LogoutModal from "@/components/ui/LogoutModal";

import DokterView from "@/components/dashboard/DokterView";
import PasienView from "@/components/dashboard/PasienView";
import AdminView from "@/components/dashboard/AdminView";

export default function BerandaPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const curSession = getUserSession();
    if (!curSession) {
      router.replace("/");
      return;
    }
    setSession(curSession);
    setIsLoading(false);
  }, [router]);

  const handleConfirmLogout = () => {
    logoutUser();
    router.replace("/");
  };

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-semibold text-sm tracking-wide">
          Memuat Hak Akses Sesi Pengguna...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 md:pb-0">
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* RENDER KOMPONEN SESUAI PERAN */}
      {session.role === "doctor" && (
        <DokterView
          session={session}
          onLogoutClick={() => setShowLogoutModal(true)}
        />
      )}

      {session.role === "patient" && (
        <PasienView
          session={session}
          onLogoutClick={() => setShowLogoutModal(true)}
        />
      )}

      {session.role === "admin" && (
        <AdminView
          session={session}
          onLogoutClick={() => setShowLogoutModal(true)}
        />
      )}
    </div>
  );
}