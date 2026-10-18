import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";


export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-6 max-w-7xl mx-auto font-sans">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Main Body Skeleton */}
      <div className="py-12 space-y-8 max-w-3xl mx-auto w-full text-center">
        <Skeleton className="h-4 w-48 mx-auto rounded-full" />
        <Skeleton className="h-10 w-full max-w-xl mx-auto" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />

        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="py-4 border-t border-slate-200 text-center">
        <Skeleton className="h-3 w-48 mx-auto" />
      </div>
    </div>
  );
}
