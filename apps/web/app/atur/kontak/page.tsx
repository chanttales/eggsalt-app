"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Sheet, useConfirm } from "@/components/sheet";
import { saveFailed, useToast } from "@/components/toast";
import {
  EmptyState,
  ghostButton,
  inputClass,
  Page,
  primaryButton,
  ListSkeleton,
} from "@/components/ui";
import { t } from "@/lib/i18n";
import { useParties, type Party } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = Party["kind"];
type Draft = {
  name: string;
  segment: string;
  phone: string;
  returnDays: number | null;
  bonusPerPurchase: number | null;
  minPurchaseQty: number | null;
};

const empty: Draft = {
  name: "",
  segment: "",
  phone: "",
  returnDays: null,
  bonusPerPurchase: null,
  minPurchaseQty: null,
};

function Count({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-label font-medium">
      {label}
      <input
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? Number(digits) : null);
        }}
        className={inputClass}
      />
    </label>
  );
}

function PartySheet({
  kind,
  party,
  workspaceId,
  onClose,
}: {
  kind: Kind;
  party: Party | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(
    party
      ? {
          name: party.name,
          segment: party.segment ?? "",
          phone: party.phone ?? "",
          returnDays: party.returnDays,
          bonusPerPurchase: party.bonusPerPurchase,
          minPurchaseQty: party.minPurchaseQty,
        }
      : empty,
  );
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();
  const toast = useToast();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function write(change: Record<string, unknown>, attempt = 1) {
    setBusy(true);
    const db = supabase().from("party");
    const { error, status } = party
      ? await db.update(change).eq("id", party.id)
      : await db.insert({ ...change, workspace_id: workspaceId, kind } as never);
    setBusy(false);
    if (error) {
      toast(
        saveFailed(t("contact.failed"), {
          attempt,
          status,
          retry: () => void write(change, attempt + 1),
        }),
      );
      return;
    }
    await queryClient.invalidateQueries();
    onClose();
    toast({ title: t("toast.saved"), text: t("contact.saved") });
  }

  const save = () =>
    write({
      name: draft.name.trim(),
      segment: kind === "customer" ? draft.segment.trim() || null : null,
      phone: draft.phone.trim() || null,
      ...(kind === "supplier" && {
        return_days: draft.returnDays,
        bonus_per_purchase: draft.bonusPerPurchase,
        min_purchase_qty: draft.minPurchaseQty,
      }),
    });

  return (
    <Sheet title={party ? party.name : t(`contact.new.${kind}`)} onClose={onClose}>
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("contact.name")}
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={80}
          className={inputClass}
        />
      </label>
      {kind === "customer" && (
        <label className="flex flex-col gap-1 text-label font-medium">
          {t("contact.segment")}
          <input
            value={draft.segment}
            onChange={(e) => set({ segment: e.target.value })}
            placeholder={t("contact.segmentHint")}
            maxLength={40}
            className={inputClass}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("contact.phone")}
        <input
          type="tel"
          value={draft.phone}
          onChange={(e) => set({ phone: e.target.value })}
          maxLength={30}
          className={inputClass}
        />
      </label>
      {kind === "supplier" && (
        <>
          <Count
            label={t("contact.returnDays")}
            value={draft.returnDays}
            onChange={(n) => set({ returnDays: n })}
          />
          <Count
            label={t("contact.bonus")}
            value={draft.bonusPerPurchase}
            onChange={(n) => set({ bonusPerPurchase: n })}
          />
          <Count
            label={t("contact.minQty")}
            value={draft.minPurchaseQty}
            onChange={(n) => set({ minPurchaseQty: n })}
          />
        </>
      )}
      <button
        disabled={busy || !draft.name.trim()}
        onClick={() => void save()}
        className={primaryButton}
      >
        {t("contact.save")}
      </button>
      {party && (
        <button
          disabled={busy}
          onClick={async () => {
            const ok = await ask({
              title: t("contact.archive"),
              message: t("contact.archiveConfirm"),
              confirmLabel: t("contact.archive"),
            });
            if (ok) void write({ archived_at: new Date().toISOString() });
          }}
          className={`${ghostButton} text-danger`}
        >
          {t("contact.archive")}
        </button>
      )}
      {dialog}
    </Sheet>
  );
}

// Pelanggan & pemasok: names, customer type, phone and supplier terms (return days, bonus eggs).
function ContactsPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const kind: Kind = params.get("jenis") === "pemasok" ? "supplier" : "customer";
  const { state } = useSession();
  const workspace = state.status === "signed_in" ? state.workspace : undefined;
  const parties = useParties(kind);
  const [editing, setEditing] = useState<Party | "new" | null>(null);

  if (workspace?.role !== "owner") {
    return (
      <Page back title={t("contact.title")}>
        <EmptyState>{t("contact.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  return (
    <Page
      back
      title={t("contact.title")}
      actions={
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-touch items-center gap-1 rounded-md bg-primary px-3 font-semibold text-primary-foreground"
        >
          <Plus aria-hidden size={20} />
          {t("contact.add")}
        </button>
      }
    >
      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(["customer", "supplier"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === kind}
            onClick={() =>
              router.replace(`/atur/kontak?jenis=${k === "supplier" ? "pemasok" : "pelanggan"}`)
            }
            className={`min-h-touch rounded-md border px-3 font-medium ${
              k === kind ? "border-primary bg-primary-soft text-primary" : "border-border"
            }`}
          >
            {t(`contact.tab.${k}`)}
          </button>
        ))}
      </div>
      {(parties.data ?? []).length === 0 ? (
        parties.isPending ? (
          <ListSkeleton />
        ) : (
          <EmptyState>{t("contact.none")}</EmptyState>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {(parties.data ?? []).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border bg-surface p-3 text-left"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-label text-muted-foreground">
                  {[
                    p.segment,
                    p.phone,
                    p.returnDays != null &&
                      t("contact.returnSummary").replace("{n}", String(p.returnDays)),
                    p.bonusPerPurchase != null &&
                      t("contact.bonusSummary").replace("{n}", String(p.bonusPerPurchase)),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && workspace && (
        <PartySheet
          key={editing === "new" ? "new" : editing.id}
          kind={kind}
          party={editing === "new" ? null : editing}
          workspaceId={workspace.id}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsPageContent />
    </Suspense>
  );
}
