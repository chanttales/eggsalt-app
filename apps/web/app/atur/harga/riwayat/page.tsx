"use client";

import { useState } from "react";
import { ProductPriceTimelines } from "@/components/price-timeline";
import { EmptyState, ListSkeleton, Page, Section, segment, segmented } from "@/components/ui";
import { t } from "@/lib/i18n";
import { usePriceHistory, useProducts } from "@/lib/queries";
import { useSession } from "@/lib/session";

const KINDS = ["sell", "buy"] as const;

// Riwayat harga: sell and buy price periods per product, each on a coloured month calendar.
export default function PriceHistoryPage() {
  const { state } = useSession();
  const workspace = state.status === "signed_in" ? state.workspace : undefined;
  const [kind, setKind] = useState<(typeof KINDS)[number]>("sell");
  const products = useProducts();
  const history = usePriceHistory(kind);

  if (workspace?.role !== "owner") {
    return (
      <Page back="/atur/harga" title={t("price.historyTitle")}>
        <EmptyState>{t("price.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  return (
    <Page back="/atur/harga" title={t("price.historyTitle")} subtitle={t("price.historyIntro")}>
      <div role="tablist" aria-label={t("price.historyTitle")} className={segmented}>
        {KINDS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === kind}
            onClick={() => setKind(k)}
            className={segment(k === kind)}
          >
            {t(k === "sell" ? "price.historySell" : "price.historyBuy")}
          </button>
        ))}
      </div>
      {products.isPending || history.isPending ? (
        <ListSkeleton />
      ) : (
        (products.data ?? []).map((p) => (
          <Section key={p.id} title={p.name}>
            <ProductPriceTimelines
              kind={kind}
              rows={(history.data ?? []).filter((r) => r.productId === p.id)}
            />
          </Section>
        ))
      )}
    </Page>
  );
}
