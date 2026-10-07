"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * In-page confirmation dialog. Replaces window.confirm(), which embedded/in-app browsers
 * may block silently (returning "cancel" without showing anything).
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onClose={() => close(false)} title={options?.title ?? ""}>
        <div className="flex flex-col gap-5 p-6 text-sm">
          {options?.message && <div className="whitespace-pre-line text-sand">{options.message}</div>}
          <div className="flex justify-end gap-2">
            {/* Destructive dialogs focus "Annuler" so a stray Enter can't confirm a deletion. */}
            <Button variant="ghost" onClick={() => close(false)} autoFocus={!!options?.danger}>
              {options?.cancelLabel ?? "Annuler"}
            </Button>
            <Button variant={options?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus={!options?.danger}>
              {options?.confirmLabel ?? "Confirmer"}
            </Button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
