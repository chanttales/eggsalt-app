"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { t } from "@/lib/i18n";

// Bottom sheet on phone, side panel on desktop (design system 3.1). Escape or the backdrop closes it.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end">
      <button
        aria-label={t("sheet.close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-xl bg-background pb-[env(safe-area-inset-bottom)] lg:max-h-none lg:w-[28rem] lg:rounded-none"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-title font-bold">{title}</h2>
          <button aria-label={t("sheet.close")} onClick={onClose} className="min-h-touch px-2">
            <X aria-hidden size={24} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
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
