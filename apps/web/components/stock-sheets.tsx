"use client";

import { useState } from "react";
import { QtyStepper, Sheet } from "@/components/sheet";
import { EmptyState, inputClass, primaryButton } from "@/components/ui";
import { useEnqueue } from "@/lib/data";
import { count, dayKey, rupiah, shortDate } from "@/lib/format";
import { t, tOr } from "@/lib/i18n";
import {
  useOpenLots,
  useParties,
  useProducts,
  useStockLevels,
  type StockLevel,
} from "@/lib/queries";

const METHODS = ["cash", "transfer", "qris"] as const;

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <span className="text-label font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={`min-h-touch rounded-full border px-4 font-medium ${
              o === value ? "border-primary bg-primary-soft text-primary" : "border-border"
            }`}
          >
            {name(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-label font-medium">
      {label}
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">Rp</span>
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("id-ID") : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={inputClass}
        />
      </span>
    </label>
  );
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// F5 Receive eggs from a supplier: stock in, money out, return date set by the supplier's terms.
export function ReceiveSheet({ onClose }: { onClose: () => void }) {
  const enqueue = useEnqueue();
  const suppliers = useParties("supplier");
  const levels = useStockLevels();
  const products = useProducts();
  const [supplierId, setSupplierId] = useState("");
  const [stateId, setStateId] = useState("");
  const [qty, setQty] = useState(0);
  const [bonus, setBonus] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");

  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId) ?? suppliers.data?.[0];
  const states = (levels.data ?? []).filter((l) => l.sellable);
  const state: StockLevel | undefined = states.find((s) => s.stateId === stateId) ?? states[0];
  const buy = (products.data ?? []).find((p) => p.stateId === state?.stateId)?.buyPrice ?? 0;
  const free = bonus ?? supplier?.bonusPerPurchase ?? 0;
  const unit = price ?? buy;
  const cost = qty * unit;
  const total = qty + free;
  const returnBy =
    state?.returnable && supplier?.returnDays != null
      ? addDays(dayKey(), supplier.returnDays)
      : null;

  if (suppliers.isSuccess && !supplier) {
    return (
      <Sheet title={t("stock.receive")} onClose={onClose}>
        <EmptyState>{t("receive.noSupplier")}</EmptyState>
      </Sheet>
    );
  }

  return (
    <Sheet title={t("stock.receive")} onClose={onClose}>
      {(suppliers.data ?? []).length > 1 && (
        <label className="flex flex-col gap-1 text-label font-medium">
          {t("receive.supplier")}
          <select
            value={supplier?.id ?? ""}
            onChange={(e) => setSupplierId(e.target.value)}
            className={inputClass}
          >
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {state && (
        <Choice
          label={t("receive.variant")}
          options={states.map((s) => s.stateId)}
          value={state.stateId}
          onChange={setStateId}
          name={(id) => states.find((s) => s.stateId === id)?.stateName ?? id}
        />
      )}
      <div className="flex flex-col gap-1">
        <span className="text-label font-medium">{t("receive.qtyPaid")}</span>
        <QtyStepper value={qty} onChange={setQty} chips={[100, 150, 200, 300]} />
        {supplier?.minPurchaseQty != null && qty > 0 && qty < supplier.minPurchaseQty && (
          <p className="text-label text-warning">
            {t("receive.belowMin").replace("{n}", count(supplier.minPurchaseQty))}
          </p>
        )}
      </div>
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("receive.bonus")}
        <input
          inputMode="numeric"
          value={free || ""}
          onChange={(e) => setBonus(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={inputClass}
        />
      </label>
      <Money label={t("receive.price")} value={unit} onChange={setPrice} />
      <Choice
        label={t("money.method")}
        options={METHODS}
        value={method}
        onChange={setMethod}
        name={(m) => tOr(`method.${m}`, m)}
      />
      {qty > 0 && state && (
        <p className="rounded-md bg-surface-muted p-3 text-label">
          {t("receive.effect")
            .replace("{state}", state.stateName)
            .replace("{from}", count(state.onHand))
            .replace("{to}", count(state.onHand + total))
            .replace("{cost}", rupiah(cost))
            .replace("{hpp}", rupiah(total ? cost / total : 0))}
          {returnBy && ` · ${t("receive.returnBy")} ${shortDate(returnBy)}`}
        </p>
      )}
      <button
        disabled={!supplier || !state || qty <= 0}
        onClick={() => {
          if (!supplier || !state) return;
          void enqueue("receive-stock", {
            supplierId: supplier.id,
            stateId: state.stateId,
            qtyPaid: qty,
            bonus: free,
            unitPrice: unit,
            method,
          });
          onClose();
        }}
        className={primaryButton}
      >
        {t("receive.save")}
      </button>
    </Sheet>
  );
}

// F6 Return unused raw eggs to the supplier: stock out of that lot, refund or credit in.
export function ReturnSheet({ lotId, onClose }: { lotId: string | null; onClose: () => void }) {
  const enqueue = useEnqueue();
  const lots = useOpenLots();
  const levels = useStockLevels();
  const returnable = new Set((levels.data ?? []).filter((l) => l.returnable).map((l) => l.stateId));
  const candidates = (lots.data ?? []).filter((l) => l.supplierId && returnable.has(l.stateId));
  const [chosen, setChosen] = useState(lotId ?? "");
  const lot = candidates.find((l) => l.id === chosen) ?? candidates[0];
  const [qty, setQty] = useState<number | null>(null);
  const [refund, setRefund] = useState<number | null>(null);
  const [method, setMethod] = useState<"cash" | "transfer" | "credit_note">("cash");
  const n = qty ?? lot?.qtyRemaining ?? 0;
  const amount = refund ?? n * (lot?.purchasePrice ?? 0);

  return (
    <Sheet title={t("return.title")} onClose={onClose}>
      {!lot ? (
        <EmptyState>{t("return.none")}</EmptyState>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("return.lot")}
            <select
              value={lot.id}
              onChange={(e) => {
                setChosen(e.target.value);
                setQty(null);
                setRefund(null);
              }}
              className={inputClass}
            >
              {candidates.map((l) => (
                <option key={l.id} value={l.id}>
                  {shortDate(l.receivedAt)} · {l.supplierName} · {count(l.qtyRemaining)}{" "}
                  {t("unit.egg")}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-label font-medium">{t("return.qty")}</span>
            <QtyStepper
              value={n}
              onChange={setQty}
              max={lot.qtyRemaining}
              chips={[lot.qtyRemaining]}
            />
          </div>
          <Choice
            label={t("return.refundAs")}
            options={["cash", "transfer", "credit_note"] as const}
            value={method}
            onChange={setMethod}
            name={(m) => tOr(`method.${m}`, m)}
          />
          <Money label={t("return.refund")} value={amount} onChange={setRefund} />
          <button
            disabled={n <= 0}
            onClick={() => {
              void enqueue("return-lot", { lotId: lot.id, qty: n, refund: amount, method });
              onClose();
            }}
            className={primaryButton}
          >
            {t("return.save")}
          </button>
        </>
      )}
    </Sheet>
  );
}
