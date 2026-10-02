"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { SheetsError, syncSheets, takePendingSync } from "@/lib/sheets";
import { supabase } from "@/lib/supabase";

// Back from Google after Sinkron: write the spreadsheet with the fresh Drive token, say how it
// went, and return to Laporan.
export function SheetsSync() {
  const { state } = useSession();
  const toast = useToast();
  const router = useRouter();
  const started = useRef(false);
  const workspace = state.status === "signed_in" ? state.workspace : null;

  useEffect(() => {
    if (!workspace || started.current) return;
    started.current = true;
    const pending = takePendingSync();
    if (pending !== workspace.id) return;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.provider_token;
      router.replace("/laporan");
      try {
        if (!token) throw new SheetsError("No Google token", 401);
        await syncSheets(token, workspace.id, workspace.name);
        toast({ title: t("sheets.done"), text: t("sheets.doneText") });
      } catch (err) {
        const status = err instanceof SheetsError ? err.status : 0;
        toast({
          tone: "danger",
          title: t("toast.failed"),
          text: t(status === 401 || status === 403 ? "sheets.noAccess" : "sheets.failed"),
          contact: status >= 500 || status === 0,
          detail: (err as Error).message,
        });
      }
    })();
  }, [workspace, toast, router]);

  return null;
}
