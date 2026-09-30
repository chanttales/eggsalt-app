import Link from "next/link";
import type { ReactNode } from "react";
import { GuideButton, type GuidePage } from "@/components/guide";
import { t } from "@/lib/i18n";

// Small shared building blocks from the design system (section 3).

export const inputClass =
  "min-h-touch w-full rounded-md border border-border bg-surface px-3 text-body outline-none focus:border-primary";
export const primaryButton =
  "flex min-h-touch w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60";
export const secondaryButton =
  "flex min-h-touch w-full items-center justify-center gap-2 rounded-md bg-primary-soft px-4 font-semibold text-primary disabled:opacity-60";
/** The one main action beside a page title: stays on one line. */
export const headerButton =
  "flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-label font-semibold whitespace-nowrap text-primary-foreground";
/** Pill tabs (period, order list): the same look on every page. */
export const segmented = "flex gap-1 rounded-full bg-surface-muted p-1";
export const segment = (active: boolean) =>
  `min-h-touch flex-1 truncate rounded-full px-3 font-medium ${
    active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"
  }`;
export const ghostButton =
  "min-h-touch rounded-md px-3 font-semibold text-primary disabled:opacity-60";

export function stageStyle(color: string = "gray") {
  return {
    backgroundColor: `var(--stage-${color}-bg)`,
    color: `var(--stage-${color}-fg)`,
  };
}

/** Dot + text, never color alone. */
export function StagePill({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium"
      style={stageStyle(color)}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {name}
    </span>
  );
}

export function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: "warning";
}) {
  const body = (
    <>
      <span
        className={`text-title-lg font-bold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </span>
      <span className="text-label text-muted-foreground">{label}</span>
    </>
  );
  const cls = "flex flex-col gap-1 rounded-lg border border-border bg-surface p-3 text-left";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-label font-semibold text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Grey placeholder rows shown where a list is still loading, instead of a "Memuat" line. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label={t("auth.loading")} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="flex animate-pulse flex-col gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <div className="h-4 w-2/5 rounded bg-surface-muted" />
          <div className="h-3 w-3/5 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground">
      {children}
    </p>
  );
}

export function Banner({
  tone,
  title,
  children,
  action,
}: {
  tone: "warning" | "suggest";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        tone === "warning" ? "border-warning bg-warning/10" : "border-primary bg-primary-soft"
      }`}
    >
      <p className="font-semibold">{title}</p>
      {children && <p className="text-label text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export function Page({
  title,
  subtitle,
  actions,
  guide,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  guide?: GuidePage;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {subtitle && <p className="text-label text-muted-foreground">{subtitle}</p>}
          <h1 className="truncate text-title-lg font-bold">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {guide && <GuideButton page={guide} />}
        </div>
      </header>
      {children}
    </main>
  );
}
