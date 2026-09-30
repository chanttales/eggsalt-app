"use client";

import { LogOut } from "lucide-react";
import { useConfirm } from "@/components/sheet";
import { usePendingOps } from "@/lib/data";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export function SignOutButton() {
  const { state, signOut } = useSession();
  const email = state.status === "signed_in" ? state.session.user.email : undefined;
  const pending = usePendingOps().length;
  const { ask, dialog } = useConfirm();

  async function confirmSignOut() {
    // Signing out drops changes that haven't reached the server yet, so ask first.
    if (
      pending > 0 &&
      !(await ask({
        title: t("auth.signOut"),
        message: `${pending} ${t("auth.signOutPending")}`,
        confirmLabel: t("auth.signOut"),
      }))
    ) {
      return;
    }
    void signOut();
  }

  return (
    <div className="flex flex-col gap-2">
      {email && (
        <p className="text-label text-muted-foreground">
          {t("auth.signedInAs")} <span className="font-medium text-foreground">{email}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => void confirmSignOut()}
        className="flex min-h-touch items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 font-semibold text-danger"
      >
        <LogOut aria-hidden size={20} strokeWidth={1.75} />
        {t("auth.signOut")}
      </button>
      {dialog}
    </div>
  );
}
