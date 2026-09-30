"use client";

import { Flame, PackagePlus, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BoilSheet } from "@/components/boil-sheet";
import { ReceiveSheet, ReturnSheet } from "@/components/stock-sheets";
import { EmptyState, Page, Section, StagePill, ListSkeleton } from "@/components/ui";
import { count, daysUntil, rupiah, shortDate } from "@/lib/format";
import { t, tOr } from "@/lib/i18n";
import { useOpenLots, useStockLevels, type Lot, type StockLevel } from "@/lib/queries";
import { useSession } from "@/lib/session";

// S08 Stok: per state how much is on hand, how much is promised to orders and what's free; then
// the lots still holding stock, with the day-5 return countdown for supplier eggs.
function StockScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const action = params.get("aksi");
  const close = () => router.replace("/stok");
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const levels = useStockLevels();
  const lots = useOpenLots();

  const stateOf = new Map((levels.data ?? []).map((l) => [l.stateId, l]));

  return (
    <Page guide="stok" title={t("nav.stock")}>
      <div className="grid grid-cols-3 gap-2">
        {isOwner && (
          <ActionLink href="/stok?aksi=terima" icon={<PackagePlus aria-hidden size={20} />}>
            {t("stock.receive")}
          </ActionLink>
        )}
        <ActionLink href="/stok?aksi=rebus" icon={<Flame aria-hidden size={20} />}>
          {t("stock.boil")}
        </ActionLink>
        {isOwner && (
          <ActionLink href="/stok?aksi=retur" icon={<Undo2 aria-hidden size={20} />}>
            {t("stock.return")}
          </ActionLink>
        )}
      </div>

      {levels.isPending ? (
        <ListSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {(levels.data ?? []).map((l) => (
            <StockMeter key={l.stateId} level={l} />
          ))}
        </div>
      )}

      <Section title={t("stock.lots")}>
        {(lots.data ?? []).length === 0 ? (
          <EmptyState>{t("stock.noLots")}</EmptyState>
        ) : (
          (lots.data ?? []).map((lot) => (
            <LotRow key={lot.id} lot={lot} state={stateOf.get(lot.stateId)} showCost={isOwner} />
          ))
        )}
      </Section>

      {action === "rebus" && <BoilSheet onClose={close} />}
      {isOwner && action === "terima" && <ReceiveSheet onClose={close} />}
      {isOwner && action === "retur" && <ReturnSheet lotId={params.get("lot")} onClose={close} />}
    </Page>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-touch flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface p-2 text-label font-semibold text-primary"
    >
      {icon}
      {children}
    </Link>
  );
}

// StockMeter: count, tray equivalent, and the reserved part shown as a striped share.
function StockMeter({ level }: { level: StockLevel }) {
  const packs =
    level.packSize && level.onHand >= level.packSize
      ? `≈ ${Math.floor(level.onHand / level.packSize)} ${level.packName ?? ""}`
      : null;
  const reservedShare = level.onHand > 0 ? Math.min(1, level.reserved / level.onHand) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <StagePill name={level.stateName} color={level.color ?? "gray"} />
      <p className="text-title-lg font-bold tabular-nums">
        {count(level.onHand)} <span className="text-label font-normal">{t("unit.egg")}</span>
      </p>
      {packs && <p className="text-caption text-muted-foreground">{packs}</p>}
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
        <div
          className="h-full bg-[repeating-linear-gradient(45deg,var(--warning)_0_4px,transparent_4px_8px)]"
          style={{ width: `${reservedShare * 100}%` }}
        />
      </div>
      <p className="text-caption text-muted-foreground">
        {t("stock.reserved")} {count(level.reserved)} · {t("stock.available")}{" "}
        {count(level.available)}
      </p>
    </div>
  );
}

// LotRow: when it came in, what's left, what each egg cost, and the return countdown badge.
function LotRow({
  lot,
  state,
  showCost,
}: {
  lot: Lot;
  state: StockLevel | undefined;
  showCost: boolean;
}) {
  const days = lot.returnBy && state?.returnable ? daysUntil(lot.returnBy) : null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">
          {state?.stateName ?? "–"} · {shortDate(lot.receivedAt)}
        </p>
        <p className="text-label text-muted-foreground">
          {tOr(`stock.source.${lot.source}`, lot.source)}
          {lot.supplierName ? ` · ${lot.supplierName}` : ""}
          {showCost ? ` · ${rupiah(lot.unitCost)}/${t("unit.egg")}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold tabular-nums">
          {count(lot.qtyRemaining)}/{count(lot.qtyIn)}
        </span>
        {days !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-caption font-medium ${
              days <= 1 ? "bg-warning/15 text-warning" : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {days <= 0 ? t("stock.returnToday") : t("stock.returnIn").replace("{n}", count(days))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockScreen />
    </Suspense>
  );
}
