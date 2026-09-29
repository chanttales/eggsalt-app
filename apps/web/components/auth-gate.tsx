"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Pages anyone can open. */
const PUBLIC = ["/masuk"];
/** Pages for a signed-in user who has no workspace yet. */
const SETUP = ["/mulai"];

function matches(pathname: string, paths: string[]) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return paths.some((p) => path === p || path.startsWith(`${p}/`));
}

function where(status: string, hasWorkspace: boolean, pathname: string): string | null {
  const isPublic = matches(pathname, PUBLIC);
  const isSetup = matches(pathname, SETUP);
  if (status === "signed_out") return isPublic ? null : "/masuk";
  if (status !== "signed_in") return null;
  if (!hasWorkspace) return isSetup ? null : "/mulai";
  return isPublic || isSetup ? "/" : null;
}

function Notice({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-4 text-center">
      <p className="text-muted-foreground">{message}</p>
    </main>
  );
}

// Client-side guard (a static export has no middleware): signed-out users go to /masuk, users
// without a workspace to /mulai, and everyone else sees the app with its navigation.
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const hasWorkspace = state.status === "signed_in" && state.workspace !== null;
  const target = where(state.status, hasWorkspace, pathname);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (state.status === "unconfigured") return <Notice message={t("auth.unconfigured")} />;
  if (state.status === "error") return <Notice message={t("auth.loadFailed")} />;
  if (state.status === "loading" || target) return <Notice message={t("auth.loading")} />;
  if (!hasWorkspace) return <>{children}</>;
  return (
    <>
      <div className="pb-20 lg:pb-0 lg:pl-56">{children}</div>
      <AppNav />
    </>
  );
}
