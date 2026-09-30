"use client";

import { useState } from "react";
import { FieldInput } from "@/components/field-input";
import { QtyStepper, Sheet } from "@/components/sheet";
import { inputClass, primaryButton } from "@/components/ui";
import { useEnqueue } from "@/lib/data";
import { count, dayKey, rupiah, startOfDay } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  sellPriceFor,
  useFieldDefs,
  useParties,
  useProducts,
  type Board,
  type FieldDef,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

// S06 New card. On an order board: customer, product, quantity and the date; on other boards: a
// title and the fields the first stage needs. The engine prices the lines (segment prices first).
export function NewCardSheet({ board, onClose }: { board: Board; onClose: () => void }) {
  const enqueue = useEnqueue();
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const workspaceId = state.status === "signed_in" ? state.workspace?.id : undefined;
  const isOrder = board.kind === "order";
  const customers = useParties("customer");
  const products = useProducts();
  const fieldDefs = useFieldDefs(board.cardTypeId);

  const [partyId, setPartyId] = useState("");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(0);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const today = dayKey();
  const [orderedOn, setOrderedOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellable = products.data ?? [];
  const product = sellable.find((p) => p.id === productId) ?? sellable[0];
  const unitPrice = product ? sellPriceFor(product, qty) : null;
  const entry = board.graph.stages.find((s) => s.key === board.graph.entry);
  const needed = new Set([...(entry?.require ?? [])]);
  // One date per order: the one this board's first stage needs (pre-order: tanggal acara),
  // else the first date field (warung: tanggal kirim). It also sets the due date.
  const allDefs = fieldDefs.data ?? [];
  const dateDef =
    allDefs.find((f) => f.type === "date" && (needed.has(f.key) || f.required)) ??
    allDefs.find((f) => f.type === "date");
  const defs = allDefs.filter((f) => f.required || needed.has(f.key) || f === dateDef);
  const party = (customers.data ?? []).find((p) => p.id === partyId);
  const name = isOrder ? (party?.name ?? newName.trim()) : title.trim();
  const missing = defs.filter(
    (f) =>
      (f.required || needed.has(f.key)) && (fields[f.key] === undefined || fields[f.key] === ""),
  );
  const ready = name.length > 0 && missing.length === 0 && (!isOrder || (product && qty > 0));

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    let id = party?.id;
    // A new customer is added to the list first (owners only: lists are theirs to edit).
    if (isOrder && !id && workspaceId) {
      const { data, error } = await supabase()
        .from("party")
        .insert({ workspace_id: workspaceId, kind: "customer", name })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(t("order.customerFailed"));
        return;
      }
      id = data.id;
    }
    const day = dateDef ? (fields[dateDef.key] as string | undefined) : undefined;
    await enqueue("create-card", {
      boardId: board.id,
      title: name,
      ...(id ? { partyId: id } : {}),
      ...(day ? { dueAt: startOfDay(day) } : {}),
      ...(isOrder && orderedOn !== today ? { orderedOn } : {}),
      fields,
      ...(isOrder && product ? { lines: [{ productId: product.id, qty }] } : {}),
    });
    setBusy(false);
    onClose();
  }

  const setField = (def: FieldDef, v: unknown) => setFields((s) => ({ ...s, [def.key]: v }));

  return (
    <Sheet
      title={isOrder ? t("order.new") : `${t("board.newCard")} · ${board.name}`}
      onClose={onClose}
    >
      {isOrder ? (
        <>
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("order.customer")}
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className={inputClass}
            >
              <option value="">{isOwner ? t("order.newCustomer") : t("field.choose")}</option>
              {(customers.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.segment ? ` · ${p.segment}` : ""}
                </option>
              ))}
            </select>
          </label>
          {!partyId && isOwner && (
            <input
              aria-label={t("order.customerName")}
              placeholder={t("order.customerName")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
          )}
          <div role="radiogroup" aria-label={t("order.product")} className="flex gap-2">
            {sellable.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === product?.id}
                onClick={() => setProductId(p.id)}
                className={`min-h-touch flex-1 rounded-md border px-3 font-medium ${
                  p.id === product?.id
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <QtyStepper value={qty} onChange={setQty} />
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("order.date")}
            <input
              type="date"
              value={orderedOn}
              max={today}
              onChange={(e) =>
                setOrderedOn(e.target.value && e.target.value <= today ? e.target.value : today)
              }
              className={inputClass}
            />
            {orderedOn !== today && (
              <span className="font-normal text-muted-foreground">{t("order.pastHint")}</span>
            )}
          </label>
          {unitPrice != null && qty > 0 && (
            <p className="text-right text-label text-muted-foreground">
              {count(qty)} × {rupiah(unitPrice)} ={" "}
              <span className="font-semibold text-foreground">{rupiah(qty * unitPrice)}</span>
            </p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1 text-label font-medium">
          {t("order.title")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
      )}

      {defs.map((f) => (
        <FieldInput
          key={f.key}
          def={{ ...f, required: f.required || needed.has(f.key) }}
          value={fields[f.key]}
          onChange={(v) => setField(f, v)}
        />
      ))}
      {dateDef && fields[dateDef.key] === undefined && !needed.has(dateDef.key) && (
        <button
          type="button"
          onClick={() => setField(dateDef, dayKey())}
          className="self-start text-label font-semibold text-primary"
        >
          {dateDef.label}: {t("order.today")}
        </button>
      )}

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
      <button onClick={() => void save()} disabled={!ready || busy} className={primaryButton}>
        {t("order.save")}
      </button>
    </Sheet>
  );
}
