"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const KEY = "baw_admin_nav_hidden";
const EVENT = "baw-admin-nav";

// Remembered per browser; read through useSyncExternalStore so SSR and hydration agree.
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readHidden() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function setHidden(hidden: boolean) {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {
    /* storage unavailable: toggle still works for this page view via the event */
  }
  window.dispatchEvent(new Event(EVENT));
}

const NavContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });
export const useAdminNav = () => useContext(NavContext);

/** Admin frame with a side menu that can be hidden on large screens. */
export function AdminShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const toggle = () => setHidden(!hidden);

  return (
    <NavContext.Provider value={{ hidden, toggle }}>
      <div className={cn("min-h-dvh bg-umber-950 lg:grid", hidden ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[260px_minmax(0,1fr)]")} lang="fr" dir="ltr">
        <div className={cn(hidden && "lg:hidden")}>{nav}</div>
        <main id="main" className="relative min-w-0 px-4 pt-6 pb-24 sm:px-8 lg:px-10 lg:pt-10">
          <button
            type="button"
            onClick={toggle}
            className="mb-4 hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-sand transition hover:border-ivory/40 hover:text-ivory lg:inline-flex"
            aria-pressed={hidden}
          >
            {hidden ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            {hidden ? "Afficher le menu" : "Masquer le menu"}
          </button>
          {children}
        </main>
      </div>
    </NavContext.Provider>
  );
}
