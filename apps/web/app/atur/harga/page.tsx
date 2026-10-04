"use client";

import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Money } from "@/components/stock-sheets";
import {
  EmptyState,
  inputClass,
  Page,
  primaryButton,
  secondaryButton,
  Section,
} from "@/components/ui";
import { dayKey } from "@/lib/format";
import { saveFailed, useToast } from "@/components/toast";
import { t } from "@/lib/i18n";
import { useProducts, type Product } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = "sell" | "buy";
type Field = Kind | "tierMin" | "tierPrice";
type Edits = Record<string, Partial<Record<Field, number>>>;
type Change = { product: Product; kind: Kind; minQty: number; price: number } | { drop: Product };

// Harga: a new dated price per product. Orders already made keep the price they were made with.
export default function PricesPage() {
  const { state } = useSession();
  const workspace = state.status === "signed_in" ? state.workspace : undefined;
  const products = useProducts();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(dayKey());
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const current = (p: Product, field: Field) =>
    field === "sell"
      ? p.sellPrice
      : field === "buy"
        ? p.buyPrice
        : field === "tierMin"
          ? (p.sellTiers[0]?.minQty ?? null)
          : (p.sellTiers[0]?.price ?? null);
  const value = (p: Product, field: Field) => edits[p.id]?.[field] ?? current(p, field) ?? 0;
  const edited = (p: Product, field: Field) =>
    edits[p.id]?.[field] != null && edits[p.id]?.[field] !== current(p, field);
  const changes: Change[] = (products.data ?? []).flatMap((p): Change[] => {
    const out: Change[] = (["sell", "buy"] as const)
      .filter((kind) => edited(p, kind))
      .map((kind) => ({ product: p, kind, minQty: 0, price: value(p, kind) }));
    if (edited(p, "tierMin") || edited(p, "tierPrice")) {
      const minQty = value(p, "tierMin");
      const price = value(p, "tierPrice");
      // A quantity price needs both numbers; clearing the minimum removes it.
      if (minQty > 1 && price > 0) out.push({ product: p, kind: "sell", minQty, price });
      else if (!minQty && p.sellTiers.length > 0) out.push({ drop: p });
    }
    return out;
  });

  const set = (p: Product, field: Field, n: number) =>
    setEdits((e) => ({ ...e, [p.id]: { ...e[p.id], [field]: n } }));

  async function save(attempt = 1) {
    if (!workspace) return;
    setSaving(true);
    const db = supabase();
    let status = 0;
    const check = (r: { error: unknown; status: number }) => {
      status = r.status;
      if (r.error) throw r.error;
    };
    try {
      for (const c of changes) {
        if ("drop" in c) {
          // Order lines keep the price they were made with, so old quantity prices can go.
          const dropped = await db
            .from("price")
            .delete()
            .eq("product_id", c.drop.id)
            .eq("kind", "sell")
            .is("segment", null)
            .gt("min_qty", 0);
          check(dropped);
          continue;
        }
        // One general price per product, kind, quantity and day: saving twice replaces the first.
        const cleared = await db
          .from("price")
          .delete()
          .eq("product_id", c.product.id)
          .eq("kind", c.kind)
          .is("segment", null)
          .eq("min_qty", c.minQty)
          .eq("valid_from", from);
        check(cleared);
        const added = await db.from("price").insert({
          workspace_id: workspace.id,
          product_id: c.product.id,
          kind: c.kind,
          unit_price: c.price,
          min_qty: c.minQty,
          valid_from: from,
        });
        check(added);
      }
      setEdits({});
      toast({ title: t("toast.saved"), text: t("price.saved") });
      await queryClient.invalidateQueries();
    } catch {
      toast(
        saveFailed(t("price.failed"), { attempt, status, retry: () => void save(attempt + 1) }),
      );
    } finally {
      setSaving(false);
    }
  }

  if (workspace?.role !== "owner") {
    return (
      <Page back="/profil" title={t("price.title")}>
        <EmptyState>{t("price.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  return (
    <Page back="/profil" guide="harga" title={t("price.title")}>
      <Link href="/atur/harga/riwayat" className={secondaryButton}>
        <History className="size-5" aria-hidden />
        {t("price.historyOpen")}
      </Link>
      <div className="flex flex-col gap-1 text-label font-medium">
        {t("price.from")}
        <DatePicker value={from} onChange={setFrom} />
      </div>
      {(products.data ?? []).map((p) => (
        <Section key={p.id} title={p.name}>
          <div className="grid grid-cols-2 gap-3">
            {(["sell", "buy"] as const).map((kind) => (
              <Money
                key={kind}
                label={t(kind === "sell" ? "price.sell" : "price.buy")}
                value={value(p, kind)}
                onChange={(n) => set(p, kind, n)}
              />
            ))}
          </div>
          <p className="text-label font-medium">{t("price.tier")}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-label font-medium">
              {t("price.tierMin")}
              <input
                inputMode="numeric"
                value={value(p, "tierMin") || ""}
                onChange={(e) => set(p, "tierMin", Number(e.target.value.replace(/\D/g, "")) || 0)}
                className={inputClass}
              />
            </label>
            <Money
              label={t("price.tierPrice")}
              value={value(p, "tierPrice")}
              onChange={(n) => set(p, "tierPrice", n)}
            />
          </div>
          <p className="text-label text-muted-foreground">{t("price.tierHint")}</p>
        </Section>
      ))}
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
