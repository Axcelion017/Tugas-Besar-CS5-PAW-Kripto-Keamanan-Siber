import React from "react";

export const NetworkBadge = ({ status, queueCount, onToggle }: { status: "online" | "offline"; queueCount: number; onToggle: () => void }) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs">
      <span className={`w-2.5 h-2.5 rounded-full ${status === "online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      <span className="font-bold text-neutral-700 hidden sm:inline">{status === "online" ? "Online (Server Pusat)" : "Offline (IndexedDB)"}</span>
      <button onClick={onToggle} className="ml-1 sm:ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-white hover:bg-neutral-50 border border-neutral-300">
        {status === "online" ? "Putus" : "Pulih"}
      </button>
    </div>
    {queueCount > 0 && <span className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold">Antrean: {queueCount}</span>}
  </div>
);
