"use client";

import { useEffect } from "react";

/**
 * iPhone / iPad Safari ignore `user-scalable=no` for two-finger pinch, so the page could still be
 * zoomed in and out. Safari's own gesture events are cancelled here; Android browsers already
 * honour the viewport setting, and double-tap zoom is disabled in CSS (touch-action).
 */
export function NoZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"];
    for (const name of events) document.addEventListener(name, stop, { passive: false });
    // A pinch that starts as two touches (older iOS versions without gesture events).
    const twoFingers = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", twoFingers, { passive: false });
    return () => {
      for (const name of events) document.removeEventListener(name, stop);
      document.removeEventListener("touchmove", twoFingers);
    };
  }, []);
  return null;
}
