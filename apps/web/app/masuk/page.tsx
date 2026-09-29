"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const input =
  "min-h-touch w-full rounded-md border border-border bg-surface px-3 text-body outline-none focus:border-primary";
const primary =
  "min-h-touch w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60";

// Sign in with a 6-digit code sent by email. It works the same on the web and inside the Android
// app, where a magic link would need deep links. New emails get an account on first sign-in.
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(t(error.status === 429 ? "auth.tooManyRequests" : "auth.sendFailed"));
      return;
    }
    setStep("code");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    // On success the session provider sees the sign-in and the guard opens the app.
    if (error) setError(t("auth.codeInvalid"));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-title font-bold text-primary">Papan</p>
        <h1 className="text-title-lg font-bold">{t("auth.title")}</h1>
        <p className="text-muted-foreground">
          {step === "email" ? t("auth.intro") : `${t("auth.codeSentTo")} ${email.trim()}`}
        </p>
      </header>

      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("auth.email")}
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </label>
          <button type="submit" disabled={busy} className={primary}>
            {busy ? t("auth.sending") : t("auth.sendCode")}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("auth.code")}
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${input} text-center text-title-lg tracking-[0.4em]`}
            />
          </label>
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>
            {busy ? t("auth.checking") : t("auth.signIn")}
          </button>
          <div className="flex justify-between text-label">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="min-h-touch font-medium text-primary"
            >
              {t("auth.changeEmail")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendCode()}
              className="min-h-touch font-medium text-primary"
            >
              {t("auth.resend")}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
    </main>
  );
}
