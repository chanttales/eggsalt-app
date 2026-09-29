"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Choice, Money } from "@/components/stock-sheets";
import { primaryButton } from "@/components/ui";
import { useEnqueue } from "@/lib/data";
import { rupiah } from "@/lib/format";
import { t, tOr } from "@/lib/i18n";
import type { Card } from "@/lib/queries";

export const PAY_METHODS = ["cash", "transfer", "qris"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

/** Chips for the delivery cost at Dikirim. */
export const DELIVERY_CHIPS = [0, 5000, 10000];

export function MoneyChips({
  chips,
  value,
  onChange,
}: {
  chips: { label: string; amount: number }[];
  value: unknown;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          aria-pressed={value === c.amount}
          onClick={() => onChange(c.amount)}
          className={`min-h-touch rounded-full border px-4 font-medium ${
            value === c.amount ? "border-primary bg-primary-soft text-primary" : "border-border"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// Lunas / Sebagian and the method, shared by the Dibayar step and a payment at any stage.
export function PaymentFields({
  due,
  amount,
  method,
  onAmount,
  onMethod,
}: {
  due: number;
  amount: number;
  method: PayMethod;
  onAmount: (n: number) => void;
  onMethod: (m: PayMethod) => void;
}) {
  return (
    <>
      <Money label={t("pay.amount")} value={amount} onChange={onAmount} />
      {due > 0 && (
        <MoneyChips
          chips={[{ label: `${t("pay.full")} ${rupiah(due)}`, amount: due }]}
          value={amount}
          onChange={onAmount}
        />
      )}
      {amount > 0 && amount < due && (
        <p className="text-label text-warning">
          {t("pay.partial").replace("{n}", rupiah(due - amount))}
        </p>
      )}
      <Choice
        label={t("money.method")}
        options={PAY_METHODS}
        value={method}
        onChange={onMethod}
        name={(m) => tOr(`method.${m}`, m)}
      />
    </>
  );
}

// A payment recorded at any stage: a down payment, pay on delivery, or pay later.
export function PaymentSheet({
  card,
  due,
  onClose,
}: {
  card: Card;
  due: number;
  onClose: () => void;
}) {
  const enqueue = useEnqueue();
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<PayMethod>("cash");
  return (
    <Sheet title={t("pay.title")} onClose={onClose}>
      <p className="text-muted-foreground">
        {card.title} #{card.number} · {t("profit.remaining")} {rupiah(due)}
      </p>
      <PaymentFields
        due={due}
        amount={amount}
        method={method}
        onAmount={setAmount}
        onMethod={setMethod}
      />
      <button
        disabled={amount <= 0}
        onClick={() => {
          void enqueue("record-money", {
            kind: "customer_payment",
            amount,
            method,
            cardId: card.id,
            ...(card.partyId ? { partyId: card.partyId } : {}),
          });
          onClose();
        }}
        className={primaryButton}
      >
        {t("pay.save")}
      </button>
    </Sheet>
  );
}
