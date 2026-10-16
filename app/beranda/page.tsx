"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserSession, normalizeRole } from "@/lib/auth/auth";

export default function BerandaPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getUserSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const target = normalizeRole(session.role);
    router.replace(`/${target}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-600 font-semibold text-sm tracking-wide">
        Mengarahkan ke Antarmuka Peran Terverifikasi...
      </p>
    </div>
  );
}
