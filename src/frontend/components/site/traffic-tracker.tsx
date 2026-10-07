"use client";

import { useEffect } from "react";

const KEY = "baw_tracked";

/** Records where the visitor came from, once per browsing session (Admin → Réseaux sociaux). */
export function TrafficTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Storage blocked: still count this page view.
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: location.href, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
