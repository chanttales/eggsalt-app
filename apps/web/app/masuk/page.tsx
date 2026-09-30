"use client";

import { useEffect, useState } from "react";
import { listenForAppCallback, signInWithGoogle } from "@/lib/google-sign-in";
import { t } from "@/lib/i18n";

const primary =
  "flex min-h-touch w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 font-semibold disabled:opacity-60";

// Sign in (or sign up) with Google. The first sign-in creates the account.
export default function SignInPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => listenForAppCallback(), []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError(t("auth.googleFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-title font-bold text-primary">Papan</p>
        <h1 className="text-title-lg font-bold">{t("auth.title")}</h1>
        <p className="text-muted-foreground">{t("auth.intro")}</p>
      </header>

      <button type="button" disabled={busy} onClick={() => void start()} className={primary}>
        <svg aria-hidden viewBox="0 0 48 48" className="size-5">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
          />
        </svg>
        {busy ? t("auth.googleOpening") : t("auth.google")}
      </button>

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
    </main>
  );
}
