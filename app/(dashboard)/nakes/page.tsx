import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { getNakesDashboardServerData } from "@/features/appointments/queries";
import { NakesDashboardClient } from "@/features/appointments/NakesDashboardClient";

async function NakesDashboardContent() {
  const data = await getNakesDashboardServerData();
  if (!data) {
    redirect("/login");
  }
  return <NakesDashboardClient data={data} />;
}

export default function NakesDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton noticeText="Memuat profil dokter dan jadwal dari PostgreSQL..." />}>
      <NakesDashboardContent />
    </Suspense>
  );
}
