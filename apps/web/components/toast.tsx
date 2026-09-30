"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";

// The result of a save as a small dialog. Success: a blue check that closes itself. Failure: a
// red warning with Coba lagi on the first try; after a second failure, or when the server itself
// is down, the button offers to contact the developer with the error details instead.

export type Toast =
  | { tone?: "success"; title: string; text: string }
  | {
      tone: "danger";
      title: string;
      text: string;
      /** Tries once more; offered on the first failure only. */
      retry?: () => void;
      /** Server trouble, or the retry failed too: offer to contact the developer. */
      contact?: boolean;
      /** What went wrong, for the message to the developer. */
      detail?: string;
    };

const SUCCESS_FOR = 1500;
/** A WhatsApp (https://wa.me/…) or mailto: link, set at build time; see deploy-web.yml. */
const DEVELOPER_CONTACT = process.env.NEXT_PUBLIC_DEVELOPER_CONTACT ?? "";

const Context = createContext<((toast: Toast) => void) | null>(null);

function contactDeveloper(detail: string): boolean {
  const message = `${t("result.contactMessage")}\n${detail}\n${new Date().toISOString()}`;
  if (DEVELOPER_CONTACT.startsWith("mailto:")) {
    window.open(
      `${DEVELOPER_CONTACT}?subject=${encodeURIComponent("EggSalt")}&body=${encodeURIComponent(message)}`,
      "_self",
    );
    return true;
  }
  if (DEVELOPER_CONTACT) {
    window.open(`${DEVELOPER_CONTACT}?text=${encodeURIComponent(message)}`, "_blank");
    return true;
  }
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  return false;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number }) | null>(null);
  const show = useCallback((next: Toast) => setToast({ ...next, key: Date.now() }), []);
  const close = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const timer = toast.tone === "danger" ? undefined : setTimeout(close, SUCCESS_FOR);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [toast, close]);

  let button: { label: string; run: () => void } | null = null;
  if (toast?.tone === "danger") {
    const { retry, contact, detail = "" } = toast;
    if (contact) {
      button = {
        label: t("result.contact"),
        run: () => {
          if (!contactDeveloper(`${toast.text} ${detail}`.trim())) {
            show({ tone: "success", title: t("result.copied"), text: t("result.copiedBody") });
          }
        },
      };
    } else if (retry) {
      button = { label: t("result.retry"), run: retry };
    } else {
      button = { label: t("result.close"), run: () => undefined };
    }
  }

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
            role={danger ? "alertdialog" : "status"}
            aria-modal={danger ? "true" : undefined}
            aria-labelledby="result-title"
            aria-describedby="result-text"
            className={`relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface px-6 pt-10 text-center shadow-xl ${
              danger ? "pb-6" : "pb-8"
            }`}
          >
            {danger && (
              <button
                type="button"
                aria-label={t("sheet.close")}
                onClick={close}
                className="absolute top-2 right-2 flex min-h-touch min-w-touch items-center justify-center text-muted-foreground"
              >
                <X aria-hidden size={22} />
              </button>
            )}
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
            {button && (
              <button
                type="button"
                autoFocus
                onClick={() => {
                  close();
                  button.run();
                }}
                className="mt-2 min-h-touch w-full rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-md"
              >
                {button.label}
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

/** The failure dialog for a save on the page itself: Coba lagi first, then the developer. */
export function saveFailed(
  text: string,
  {
    attempt,
    retry,
    status = 0,
    detail,
  }: { attempt: number; retry: () => void; status?: number; detail?: string },
): Toast {
  return {
    tone: "danger",
    title: t("toast.failed"),
    text,
    retry,
    contact: attempt > 1 || status >= 500,
    detail: detail ?? (status ? `HTTP ${status}` : undefined),
  };
}
