import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { getBerandaServerData } from "@/features/dashboard/queries";
import { BerandaClient } from "@/features/dashboard/BerandaClient";

async function BerandaContent() {
  const data = await getBerandaServerData();
  if (!data) {
    redirect("/login");
  }
  return <BerandaClient data={data} />;
}

export default function BerandaPage() {
  return (
    <Suspense fallback={<DashboardSkeleton noticeText="Memuat ringkasan beranda dari PostgreSQL..." />}>
      <BerandaContent />
    </Suspense>
  );
}
