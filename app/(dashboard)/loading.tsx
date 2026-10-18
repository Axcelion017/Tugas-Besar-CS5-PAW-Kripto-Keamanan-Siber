import React from "react";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="w-full py-2">
      <DashboardSkeleton
        showNotice={true}
        noticeText="Memuat modul klinis & memverifikasi integritas enkripsi Zero-Trust..."
      />
    </div>
  );
}
