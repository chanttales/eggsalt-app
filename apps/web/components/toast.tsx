"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";

// The result of a save as a small dialog: a blue check when it worked, a red warning when it
// didn't. The main button closes it (or retries, for a failure worth retrying); an optional quiet
// link such as Batalkan takes the change back. A new result replaces the one on screen.

export interface Toast {
  title: string;
  text: string;
  tone?: "success" | "danger";
  /** The main button; without it the button just closes the dialog. */
  primary?: { label: string; run: () => void };
  /** A quiet link under the main button, such as Batalkan. */
  action?: { label: string; run: () => void };
}

const Context = createContext<((toast: Toast) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number }) | null>(null);
  const show = useCallback((next: Toast) => setToast({ ...next, key: Date.now() }), []);
  const close = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, close]);

  const danger = toast?.tone === "danger";
  const Icon = danger ? TriangleAlert : Check;

  return (
    <Context.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <button
            aria-label={t("sheet.close")}
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div
            key={toast.key}
            role={danger ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="result-title"
            aria-describedby="result-text"
            className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface px-6 pt-10 pb-6 text-center shadow-xl"
          >
            <button
              type="button"
              aria-label={t("sheet.close")}
              onClick={close}
              className="absolute top-2 right-2 flex min-h-touch min-w-touch items-center justify-center text-muted-foreground"
            >
              <X aria-hidden size={22} />
            </button>
            <div
              className={`mb-2 flex size-24 items-center justify-center rounded-full ${
                danger ? "bg-danger/10" : "bg-primary-soft"
              }`}
            >
              <span
                className={`flex size-16 items-center justify-center rounded-full text-white ${
                  danger ? "bg-danger" : "bg-primary"
                }`}
              >
                <Icon aria-hidden size={34} strokeWidth={3} />
              </span>
            </div>
            <h2 id="result-title" className="text-title font-bold">
              {toast.title}
            </h2>
            <p id="result-text" className="text-muted-foreground">
              {toast.text}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => {
                close();
                toast.primary?.run();
              }}
              className="mt-2 min-h-touch w-full rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-md"
            >
              {toast.primary?.label ?? t(danger ? "result.close" : "result.continue")}
            </button>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  close();
                  toast.action?.run();
                }}
                className={`min-h-touch px-3 font-semibold ${danger ? "text-muted-foreground" : "text-danger"}`}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </Context.Provider>
  );
}

export function useToast(): (toast: Toast) => void {
  const show = useContext(Context);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}
