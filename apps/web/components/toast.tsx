"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// One short message at a time above the bottom navigation, with an optional action such as
// Batalkan. A new message replaces the old one; it hides itself after a few seconds.

export interface Toast {
  text: string;
  tone?: "neutral" | "danger";
  action?: { label: string; run: () => void };
}

const SHOW_FOR = 6000;
const Context = createContext<((toast: Toast) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number }) | null>(null);
  const show = useCallback((next: Toast) => setToast({ ...next, key: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOW_FOR);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <Context.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6 lg:left-56"
      >
        {toast && (
          <div
            key={toast.key}
            role={toast.tone === "danger" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg px-4 py-2 text-body shadow-lg ${
              toast.tone === "danger" ? "bg-danger text-white" : "bg-foreground text-background"
            }`}
          >
            <span className="flex-1">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
                className="min-h-touch shrink-0 px-2 font-semibold underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}

export function useToast(): (toast: Toast) => void {
  const show = useContext(Context);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}
