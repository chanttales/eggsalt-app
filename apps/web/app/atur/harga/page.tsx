"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Money } from "@/components/stock-sheets";
import { EmptyState, inputClass, Page, primaryButton, Section } from "@/components/ui";
import { dayKey } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useProducts, type Product } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = "sell" | "buy";
type Edits = Record<string, Partial<Record<Kind, number>>>;

// Harga: a new dated price per product. Orders already made keep the price they were made with.
export default function PricesPage() {
  const { state } = useSession();
  const workspace = state.status === "signed_in" ? state.workspace : undefined;
  const products = useProducts();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(dayKey());
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const current = (p: Product, kind: Kind) => (kind === "sell" ? p.sellPrice : p.buyPrice);
  const value = (p: Product, kind: Kind) => edits[p.id]?.[kind] ?? current(p, kind) ?? 0;
  const changes = (products.data ?? []).flatMap((p) =>
    (["sell", "buy"] as const)
      .filter((kind) => edits[p.id]?.[kind] != null && edits[p.id]?.[kind] !== current(p, kind))
      .map((kind) => ({ product: p, kind, price: value(p, kind) })),
  );

  async function save() {
    if (!workspace) return;
    setSaving(true);
    setMessage(null);
    const db = supabase();
    try {
      for (const c of changes) {
        // One general price per product, kind and day: saving twice on a day replaces the first.
        const cleared = await db
          .from("price")
          .delete()
          .eq("product_id", c.product.id)
          .eq("kind", c.kind)
          .is("segment", null)
          .eq("valid_from", from);
        if (cleared.error) throw cleared.error;
        const added = await db.from("price").insert({
          workspace_id: workspace.id,
          product_id: c.product.id,
          kind: c.kind,
          unit_price: c.price,
          valid_from: from,
        });
        if (added.error) throw added.error;
      }
      setEdits({});
      setMessage(t("price.saved"));
      await queryClient.invalidateQueries();
    } catch {
      setMessage(t("price.failed"));
    } finally {
      setSaving(false);
    }
  }

  if (workspace?.role !== "owner") {
    return (
      <Page title={t("price.title")}>
        <EmptyState>{t("price.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  return (
    <Page title={t("price.title")} subtitle={t("price.intro")}>
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("price.from")}
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value || dayKey())}
          className={inputClass}
        />
      </label>
      {(products.data ?? []).map((p) => (
        <Section key={p.id} title={p.name}>
          <div className="grid grid-cols-2 gap-3">
            {(["sell", "buy"] as const).map((kind) => (
              <Money
                key={kind}
                label={t(kind === "sell" ? "price.sell" : "price.buy")}
                value={value(p, kind)}
                onChange={(n) => setEdits((e) => ({ ...e, [p.id]: { ...e[p.id], [kind]: n } }))}
              />
            ))}
          </div>
        </Section>
      ))}
      {message && (
        <p role="status" className="text-label">
          {message}
        </p>
      )}
      <button
        disabled={saving || changes.length === 0}
        onClick={() => void save()}
        className={primaryButton}
      >
        {t("price.save")}
      </button>
    </Page>
  );
}
