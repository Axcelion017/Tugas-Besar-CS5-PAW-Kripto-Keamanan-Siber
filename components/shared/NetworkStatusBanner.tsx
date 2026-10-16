"use client";

import React, { useState, useEffect } from "react";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    // Muat state offline dari localStorage
    const saved = localStorage.getItem("resilio_network_mode");
    if (saved === "offline") {
      setIsOnline(false);
    }

    const checkQueue = () => {
      try {
        const queued = localStorage.getItem("resilio_offline_queue");
        if (queued) {
          const arr = JSON.parse(queued);
          setQueueCount(arr.length);
        } else {
          setQueueCount(0);
        }
      } catch {
        setQueueCount(0);
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleNetwork = () => {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("resilio_network_mode", next ? "online" : "offline");
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
          isOnline
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-300 text-amber-900 shadow-sm"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
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
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-bold animate-pulse">
          <span>Antrean Sinkron:</span>
          <span>{queueCount}</span>
        </span>
      )}
    </div>
  );
}

export default NetworkStatusBanner;
