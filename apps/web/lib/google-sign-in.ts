"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

// Google sign-in through Supabase (PKCE). On the web the page goes to Google and comes back to
// /masuk with ?code=, which the Supabase client exchanges on load. Google blocks sign-in inside an
// app's WebView, so the Android app opens the system browser and comes back through a deep link.

/** Must also be listed under Supabase → Authentication → URL Configuration → Redirect URLs. */
export const APP_CALLBACK = "id.papan.app://login-callback";

function webCallback(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}/masuk/`;
}

export async function signInWithGoogle(): Promise<void> {
  const native = Capacitor.isNativePlatform();
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: native ? APP_CALLBACK : webCallback(),
      skipBrowserRedirect: native,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (native && data.url) await Browser.open({ url: data.url });
}

/**
 * Signs in again with Google asking for access to files EggSalt creates in Drive (drive.file).
 * The Google access token then sits on the session as provider_token for about an hour.
 */
export async function signInWithDriveAccess(): Promise<void> {
  const native = Capacitor.isNativePlatform();
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: native ? APP_CALLBACK : webCallback(),
      skipBrowserRedirect: native,
      scopes: "https://www.googleapis.com/auth/drive.file",
      queryParams: { include_granted_scopes: "true" },
    },
  });
  if (error) throw error;
  if (native && data.url) await Browser.open({ url: data.url });
}

/** Android: finish the sign-in when the browser hands the deep link back to the app. */
export function listenForAppCallback(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = App.addListener("appUrlOpen", ({ url }) => {
    if (!url.startsWith(APP_CALLBACK)) return;
    const code = new URL(url).searchParams.get("code");
    void Browser.close().catch(() => {});
    if (code) void supabase().auth.exchangeCodeForSession(code);
  });
  return () => void handle.then((h) => h.remove());
}
