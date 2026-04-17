"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Listen for updates to prompt page reload
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // A new SW is waiting. Skip waiting prompt handled elsewhere.
            }
          });
        });
      } catch (err) {
        console.warn("SW registration failed", err);
      }
    };

    register();
  }, []);

  return null;
}
