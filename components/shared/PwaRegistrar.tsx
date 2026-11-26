"use client";

import { useEffect } from "react";

/**
 * Komponen ringan untuk mendaftarkan Service Worker PWA (`/sw.js`)
 * serta meneruskan event `online`/`offline` browser dan pesan Background Sync.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("PWA ServiceWorker registration skipped:", err);
        });

      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === "RESILIO_TRIGGER_OFFLINE_SYNC") {
          window.dispatchEvent(new CustomEvent("jagamedis-sync-requested"));
        }
      };

      navigator.serviceWorker.addEventListener("message", handleSwMessage);

      return () => {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      };
    }
  }, []);

  return null;
}

export default PwaRegistrar;
