"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "vaul";
import { t } from "@/lib/i18n";

const desktop = "(min-width: 64rem)";

/** True from Tailwind's `lg` breakpoint up, where the sidebar replaces the bottom bar. */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(desktop);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(desktop).matches,
    () => false,
  );
}

// Drawer in the style of shadcn/ui (vaul): slides up from the bottom on phones and in from the
// right on desktop, and closes with a swipe, the close button, the backdrop or Escape. Callers
// mount it while open.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  return (
    <Drawer.Root
      open
      direction={isDesktop ? "right" : "bottom"}
      onOpenChange={(open) => !open && onClose()}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={`fixed z-50 flex flex-col bg-background outline-none ${
            isDesktop
              ? "inset-y-0 right-0 w-full max-w-md rounded-l-xl shadow-xl"
              : "inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-lg rounded-t-xl pb-[env(safe-area-inset-bottom)]"
          }`}
        >
          {!isDesktop && (
            <div aria-hidden className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border" />
          )}
          <div
            className={`flex items-center justify-between border-b border-border px-4 pb-3 ${isDesktop ? "pt-4" : "pt-1"}`}
          >
            <Drawer.Title className="text-title font-bold">{title}</Drawer.Title>
            <Drawer.Close aria-label={t("sheet.close")} className="min-h-touch px-2">
              <X aria-hidden size={24} />
            </Drawer.Close>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto p-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Big number with − / + and quick chips (design system: QtyStepper). */
export function QtyStepper({
  value,
  onChange,
  chips = [10, 15, 20, 25, 40, 100],
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  chips?: number[];
  max?: number;
}) {
  const clamp = (n: number) => Math.max(0, max === undefined ? n : Math.min(max, n));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="−"
          onClick={() => onChange(clamp(value - 1))}
          className="min-h-touch min-w-touch rounded-md bg-surface-muted text-title font-bold"
        >
          −
        </button>
        <input
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, "")) || 0))}
          className="min-h-touch w-full rounded-md border border-border bg-surface text-center text-title-lg font-bold tabular-nums"
        />
        <button
          type="button"
          aria-label="+"
          onClick={() => onChange(clamp(value + 1))}
          className="min-h-touch min-w-touch rounded-md bg-surface-muted text-title font-bold"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips
          .filter((c) => max === undefined || c <= max)
          .map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`min-h-touch rounded-full border px-3 text-label font-medium ${
                value === c ? "border-primary bg-primary-soft text-primary" : "border-border"
              }`}
            >
              {c}
            </button>
          ))}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

/**
 * A dialog (shadcn AlertDialog style) that asks before something hard to take back.
 * `ask` resolves true when the user confirms; render `dialog` somewhere in the component.
 */
export function useConfirm(): {
  ask: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(
    null,
  );
  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setOpen({ ...options, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    open?.resolve(ok);
    setOpen(null);
  };
  const dialog = (
    <AlertDialog.Root open={!!open} onOpenChange={(o) => !o && close(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-surface p-5 shadow-lg">
          <AlertDialog.Title className="text-title font-bold">{open?.title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body text-muted-foreground">
            {open?.message}
          </AlertDialog.Description>
          <div className="mt-2 flex flex-col gap-2">
            <AlertDialog.Action
              onClick={() => close(true)}
              className="min-h-touch w-full rounded-md bg-danger px-4 font-semibold text-white"
            >
              {open?.confirmLabel}
            </AlertDialog.Action>
            <AlertDialog.Cancel className="min-h-touch w-full rounded-md border border-border px-4 font-semibold">
              {t("confirm.back")}
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
  return { ask, dialog };
}
