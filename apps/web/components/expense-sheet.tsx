"use client";

import { useState } from "react";
import { PAY_METHODS, type PayMethod } from "@/components/payment";
import { Sheet } from "@/components/sheet";
import { Choice, Money } from "@/components/stock-sheets";
import { inputClass, primaryButton } from "@/components/ui";
import { useEnqueue } from "@/lib/data";
import { t, tOr } from "@/lib/i18n";
import { useExpenseCategories, useOpenCards } from "@/lib/queries";

// F8 Record an expense: category, amount, method, and optionally the order or batch it was for,
// so its cost lands on that card's profit. Unlinked expenses are operating costs.
export function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const enqueue = useEnqueue();
  const categories = useExpenseCategories();
  const cards = useOpenCards();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [cardId, setCardId] = useState("");
  const [note, setNote] = useState("");
  const list = categories.data ?? [];
  const category = list.find((c) => c.id === categoryId) ?? list[0];

  return (
    <Sheet title={t("expense.title")} onClose={onClose}>
      {category && (
        <Choice
          label={t("expense.category")}
          options={list.map((c) => c.id)}
          value={category.id}
          onChange={setCategoryId}
          name={(id) => {
            const c = list.find((x) => x.id === id);
            return c ? tOr(`expense.cat.${c.key}`, c.name) : id;
          }}
        />
      )}
      <Money label={t("expense.amount")} value={amount} onChange={setAmount} />
      <Choice
        label={t("money.method")}
        options={PAY_METHODS}
        value={method}
        onChange={setMethod}
        name={(m) => tOr(`method.${m}`, m)}
      />
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("expense.for")}
        <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
          <option value="">{t("expense.general")}</option>
          {(cards.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} #{c.number}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("expense.note")}
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </label>
      <button
        disabled={amount <= 0}
        onClick={() => {
          void enqueue("record-money", {
            kind: "expense",
            amount,
            method,
            ...(category ? { categoryId: category.id } : {}),
            ...(cardId ? { cardId, allocations: [{ cardId, amount }] } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          onClose();
        }}
        className={primaryButton}
      >
        {t("expense.save")}
      </button>
    </Sheet>
  );
}
