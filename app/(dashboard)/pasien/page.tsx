import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { getPasienDashboardServerData } from "@/features/medical-records/queries";
import { PasienDashboardClient } from "@/features/medical-records/PasienDashboardClient";

async function PasienDashboardContent() {
  const data = await getPasienDashboardServerData();
  if (!data) {
    redirect("/login");
  }
  return <PasienDashboardClient data={data} />;
}

export default function PasienDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton noticeText="Memuat profil pasien & rekam medis dari PostgreSQL..." />}>
      <PasienDashboardContent />
    </Suspense>
  );
}
