"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dayKey } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cardQty, useOpenCards, useReturnLots } from "@/lib/queries";

// Phone-only glue for the Android app: the hardware back button, the offline banner, and the
// reminders scheduled on the phone (H-1 for orders, the day before a supplier return is due).
// On the web these are no-ops except the banner, which uses the browser's online state.

const native = () => Capacitor.isNativePlatform();

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (native()) {
      void Network.getStatus().then((s) => setOnline(s.connected));
      const handle = Network.addListener("networkStatusChange", (s) => setOnline(s.connected));
      return () => void handle.then((h) => h.remove());
    }
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function useBackButton() {
  useEffect(() => {
    if (!native()) return;
    const handle = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
    return () => void handle.then((h) => h.remove());
  }, []);
}

/** 08:00 in Jakarta, `before` days ahead of a YYYY-MM-DD day. */
function morningBefore(day: string, before: number): Date {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - before);
  return new Date(`${d.toISOString().slice(0, 10)}T08:00:00+07:00`);
}

/** Stable 31-bit notification id from a string, so rescheduling replaces rather than duplicates. */
function notificationId(key: string): number {
  let h = 0;
  for (const ch of key) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
}

interface Reminder {
  key: string;
  at: Date;
  title: string;
  body: string;
  url: string;
}

function useReminders() {
  const router = useRouter();
  const cards = useOpenCards();
  const lots = useReturnLots();

  // A tapped reminder opens the step it is about.
  useEffect(() => {
    if (!native()) return;
    const handle = LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
      const url = (e.notification.extra as { url?: string } | undefined)?.url;
      if (url) router.push(url);
    });
    return () => void handle.then((h) => h.remove());
  }, [router]);

  useEffect(() => {
    if (!native() || !cards.data || !lots.data) return;
    const now = Date.now();
    const reminders: Reminder[] = [
      ...cards.data
        .filter((c) => c.dueAt && c.lines.length > 0)
        .map((c) => ({
          key: `card:${c.id}`,
          at: morningBefore(dayKey(c.dueAt as string), 1),
          title: t("notify.dueTomorrow"),
          body: `${c.title} #${c.number} · ${cardQty(c)} ${t("unit.egg")}`,
          url: `/kartu?id=${c.id}`,
        })),
      ...lots.data
        .filter((l) => l.returnBy && l.qtyRemaining > 0)
        .map((l) => ({
          key: `lot:${l.id}`,
          at: morningBefore(l.returnBy as string, 1),
          title: t("notify.returnTomorrow"),
          body: `${l.qtyRemaining} ${t("unit.egg")}`,
          url: `/stok?aksi=retur&lot=${l.id}`,
        })),
    ].filter((r) => r.at.getTime() > now);

    void (async () => {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") {
        const asked = await LocalNotifications.requestPermissions();
        if (asked.display !== "granted") return;
      }
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
      if (reminders.length) {
        await LocalNotifications.schedule({
          notifications: reminders.map((r) => ({
            id: notificationId(r.key),
            title: r.title,
            body: r.body,
            schedule: { at: r.at, allowWhileIdle: true },
            extra: { url: r.url },
          })),
        });
      }
    })();
  }, [cards.data, lots.data]);
}

/** Mounted once inside the signed-in app. */
export function NativeBridge() {
  const online = useOnline();
  useBackButton();
  useReminders();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-warning px-4 py-2 text-center text-label font-medium text-white"
    >
      {t("net.offline")}
    </div>
  );
}
