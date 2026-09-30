"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { callEngine } from "@/lib/engine";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const input =
  "min-h-touch w-full rounded-md border border-border bg-surface px-3 text-body outline-none focus:border-primary";
const primary =
  "min-h-touch w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60";
const secondary = "min-h-touch w-full rounded-md px-4 font-semibold text-primary";

const TEMPLATE = "telur-asin";
const BOARDS = [
  "setup.board.orders",
  "setup.board.preorder",
  "setup.board.boil",
  "setup.board.purchase",
] as const;
const STATES = ["setup.state.raw", "setup.state.boiled", "setup.state.broken"] as const;

// Prices per egg from the template; the owner can change them here or later in settings.
const DEFAULT_PRICES = {
  telur_asin_mentah: { sell: 3500, buy: 2300 },
  telur_asin_matang: { sell: 3500, buy: 2500 },
};

type Step = "name" | "template" | "start";
type Prices = typeof DEFAULT_PRICES;

function toInt(value: string): number {
  const n = Number(value.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-label font-medium">
      {label}
      <span className="flex items-center gap-2">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("id-ID") : ""}
          onChange={(e) => onChange(toInt(e.target.value))}
          className={input}
        />
      </span>
    </label>
  );
}

// First run (design flow F1): business name, template, then optional starting numbers. Every
// starting number can be skipped and changed later.
export default function StartPage() {
  const router = useRouter();
  const { refreshWorkspaces, selectWorkspace } = useSession();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [openingRaw, setOpeningRaw] = useState(0);
  const [lpg, setLpg] = useState(1000);
  const [loss, setLoss] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPrice(key: keyof Prices, kind: "sell" | "buy", n: number) {
    setPrices((p) => ({ ...p, [key]: { ...p[key], [kind]: n } }));
  }

  async function create(useStartNumbers: boolean) {
    setBusy(true);
    setError(null);
    const options = useStartNumbers
      ? { prices, settings: { lpg_per_batch: lpg, expected_loss_per_batch: loss } }
      : {};
    const { data: workspaceId, error } = await supabase().rpc("create_workspace_from_template", {
      p_name: name.trim(),
      p_template: TEMPLATE,
      p_options: options,
    });
    if (error || typeof workspaceId !== "string") {
      setBusy(false);
      setError(t("setup.createFailed"));
      return;
    }
    if (useStartNumbers && openingRaw > 0) {
      try {
        const { data } = await supabase()
          .from("item_state")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("key", "mentah")
          .single();
        if (data) {
          await callEngine("opening-stock", workspaceId, {
            idempotencyKey: crypto.randomUUID(),
            stateId: data.id,
            qty: openingRaw,
          });
        }
      } catch {
        // The business exists; opening stock can be entered later from the Stok screen.
      }
    }
    selectWorkspace(workspaceId);
    await refreshWorkspaces();
    router.replace("/");
  }

  function next(event: FormEvent) {
    event.preventDefault();
    setStep(step === "name" ? "template" : "start");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-label text-muted-foreground">
          {t("setup.step")} {step === "name" ? 1 : step === "template" ? 2 : 3}/3
        </p>
        <h1 className="text-title-lg font-bold">
          {step === "name"
            ? t("setup.title")
            : step === "template"
              ? t("setup.templateTitle")
              : t("setup.startTitle")}
        </h1>
        <p className="text-muted-foreground">
          {step === "name"
            ? t("setup.nameIntro")
            : step === "template"
              ? t("setup.templateIntro")
              : t("setup.startIntro")}
        </p>
      </header>

      {step === "name" && (
        <form onSubmit={next} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("setup.name")}
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("setup.namePlaceholder")}
              className={input}
            />
          </label>
          <button type="submit" disabled={!name.trim()} className={primary}>
            {t("setup.next")}
          </button>
        </form>
      )}

      {step === "template" && (
        <form onSubmit={next} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-md border-2 border-primary bg-surface p-4">
            <p className="text-title font-bold">{t("setup.templateName")}</p>
            <div className="flex flex-col gap-1">
              <p className="text-label font-medium">{t("setup.boards")}</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {BOARDS.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-label font-medium">{t("setup.stockStates")}</p>
              <p className="text-muted-foreground">{STATES.map((k) => t(k)).join(" · ")}</p>
            </div>
          </div>
          <button type="submit" className={primary}>
            {t("setup.useTemplate")}
          </button>
          <button type="button" onClick={() => setStep("name")} className={secondary}>
            {t("setup.back")}
          </button>
        </form>
      )}

      {step === "start" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create(true);
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{t("setup.prices")}</legend>
            <NumberField
              label={t("setup.priceRawSell")}
              prefix="Rp"
              value={prices.telur_asin_mentah.sell}
              onChange={(n) => setPrice("telur_asin_mentah", "sell", n)}
            />
            <NumberField
              label={t("setup.priceRawBuy")}
              prefix="Rp"
              value={prices.telur_asin_mentah.buy}
              onChange={(n) => setPrice("telur_asin_mentah", "buy", n)}
            />
            <NumberField
              label={t("setup.priceBoiledSell")}
              prefix="Rp"
              value={prices.telur_asin_matang.sell}
              onChange={(n) => setPrice("telur_asin_matang", "sell", n)}
            />
          </fieldset>
          <NumberField label={t("setup.openingRaw")} value={openingRaw} onChange={setOpeningRaw} />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{t("setup.boil")}</legend>
            <NumberField label={t("setup.lpg")} prefix="Rp" value={lpg} onChange={setLpg} />
            <NumberField label={t("setup.loss")} value={loss} onChange={setLoss} />
          </fieldset>
          {error && (
            <p role="alert" className="text-label text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={primary}>
            {busy ? t("setup.creating") : t("setup.create")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create(false)}
            className={secondary}
          >
            {t("setup.skip")}
          </button>
        </form>
      )}

      {step === "name" && <SignOutButton />}
    </main>
  );
}
