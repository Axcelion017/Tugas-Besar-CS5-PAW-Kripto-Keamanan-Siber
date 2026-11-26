"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getOutboxItems, OUTBOX_UPDATED_EVENT } from "@/lib/storage/indexedDb";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  const refreshOutboxCount = useCallback(async () => {
    const items = await getOutboxItems();
    setQueueCount(items.length);
  }, []);

  useEffect(() => {
    const syncNetworkState = () => {
      const simulatedOffline = localStorage.getItem("resilio_network_mode") === "offline";
      const browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      setIsOnline(browserOnline && !simulatedOffline);
    };

    const timer = setTimeout(() => {
      syncNetworkState();
      void refreshOutboxCount();
    }, 0);

    const handleOnline = () => {
      localStorage.setItem("resilio_network_mode", "online");
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent("jagamedis-sync-requested"));
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleOutboxUpdated = () => {
      void refreshOutboxCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", syncNetworkState);
    window.addEventListener(OUTBOX_UPDATED_EVENT, handleOutboxUpdated);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", syncNetworkState);
      window.removeEventListener(OUTBOX_UPDATED_EVENT, handleOutboxUpdated);
    };
  }, [refreshOutboxCount]);

  const toggleNetwork = () => {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("resilio_network_mode", next ? "online" : "offline");
    window.dispatchEvent(new Event("storage"));
    if (next) {
      window.dispatchEvent(new CustomEvent("jagamedis-sync-requested"));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div
        role="status"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
          isOnline
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-300 text-amber-900 shadow-sm"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline ? "bg-emerald-500 motion-reduce:animate-none animate-pulse" : "bg-amber-500"
          }`}
        />
        <span className="hidden sm:inline">
          {isOnline ? "Terhubung ke Server Pusat" : "Mode Offline (IndexedDB Aktif)"}
        </span>
        <button
          onClick={toggleNetwork}
          type="button"
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-xs cursor-pointer"
        >
          {isOnline ? "Simulasi Putus" : "Pulihkan"}
        </button>
      </div>

      {queueCount > 0 && (
        <Link
          href="/nakes/offline-sync"
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-bold hover:bg-red-200 transition"
        >
          <span>Antrean IndexedDB:</span>
          <span>{queueCount}</span>
        </Link>
      )}
    </div>
  );
}

export default NetworkStatusBanner;
