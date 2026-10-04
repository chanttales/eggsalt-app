"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useConfirm } from "@/components/sheet";
import { saveFailed, useToast } from "@/components/toast";
import {
  EmptyState,
  ghostButton,
  inputClass,
  Page,
  primaryButton,
  Section,
  ListSkeleton,
} from "@/components/ui";
import { t } from "@/lib/i18n";
import { useTeam, type TeamEntry } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Undangan: invite people by Google email; they join with the same access when they sign in.
export default function InvitesPage() {
  const { state } = useSession();
  const workspace = state.status === "signed_in" ? state.workspace : undefined;
  const me = state.status === "signed_in" ? state.session.user.id : undefined;
  const team = useTeam();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const toast = useToast();

  if (workspace?.role !== "owner") {
    return (
      <Page back title={t("invite.title")}>
        <EmptyState>{t("contact.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  async function run(
    write: () => PromiseLike<{ error: { code?: string } | null; status: number }>,
    savedText: string,
    attempt = 1,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    const { error, status } = await write();
    setBusy(false);
    if (error?.code === "23505") {
      setError(t("invite.exists"));
      return false;
    }
    if (error) {
      toast(
        saveFailed(t("invite.failed"), {
          attempt,
          status,
          retry: () => void run(write, savedText, attempt + 1),
        }),
      );
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: [workspace?.id, "team"] });
    toast({ title: t("toast.saved"), text: savedText });
    return true;
  }

  async function invite() {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError(t("invite.invalid"));
      return;
    }
    const ok = await run(
      () =>
        supabase()
          .from("invite")
          .insert({ workspace_id: workspace?.id, email: address, invited_by: me } as never),
      t("invite.sent").replace("{email}", address),
    );
    if (ok) setEmail("");
  }

  async function drop(entry: TeamEntry) {
    const invited = entry.status === "invited";
    const label = t(invited ? "invite.cancel" : "invite.remove");
    const ok = await ask({
      title: label,
      message: invited
        ? t("invite.cancelConfirm").replace("{email}", entry.name)
        : t("invite.removeConfirm").replace("{name}", entry.name || t("invite.member")),
      confirmLabel: label,
    });
    if (!ok) return;
    void run(
      () =>
        entry.status === "invited"
          ? supabase().from("invite").delete().eq("id", entry.id)
          : supabase()
              .from("member")
              .delete()
              .eq("workspace_id", workspace?.id as string)
              .eq("user_id", entry.id),
      t("invite.updated"),
    );
  }

  return (
    <Page back title={t("invite.title")}>
      <p className="text-muted-foreground">{t("invite.intro")}</p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <label className="flex flex-col gap-1 text-label font-medium">
          {t("invite.email")}
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !email.trim()} className={primaryButton}>
          {t("invite.send")}
        </button>
      </form>
      <Section title={t("invite.list")}>
        {(team.data ?? []).length === 0 ? (
          team.isPending ? (
            <ListSkeleton />
          ) : (
            <EmptyState>{t("contact.none")}</EmptyState>
          )
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {(team.data ?? []).map((entry) => (
              <li key={entry.id} className="flex min-h-touch items-center gap-3 p-3">
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold break-all">
                    {entry.name || t("invite.member")}
                    {entry.isMe && ` (${t("invite.me")})`}
                  </span>
                  <span
                    className={`text-label ${
                      entry.status === "invited" ? "text-warning" : "text-muted-foreground"
                    }`}
                  >
                    {t(entry.status === "invited" ? "invite.pending" : "invite.member")}
                  </span>
                </span>
                {!entry.isMe && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void drop(entry)}
                    className={`${ghostButton} text-danger`}
                  >
                    {t(entry.status === "invited" ? "invite.cancel" : "invite.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {dialog}
    </Page>
  );
}
