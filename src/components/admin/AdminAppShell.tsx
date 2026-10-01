// What makes the admin panel behave like an app on the owners' phones, where
// most of the shop is run:
//
// - Installable on its own: while /admin is open the page points at
//   /admin.webmanifest (start_url /admin, a square icon, shortcuts to orders,
//   leads and a new phone order), so "add to home screen" gives the CRM its
//   own icon instead of a second copy of the storefront.
// - Fresh when reopened: the app-wide refetchOnWindowFocus is off
//   (src/router.tsx), and an installed app is mostly *resumed*, not loaded —
//   without this a phone left on the orders screen overnight shows yesterday.
// - Pull to refresh: an installed (standalone) app has no browser pull gesture,
//   so the panel supplies one.
// - The home-screen icon's badge carries the count of things waiting.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_MANIFEST = "/admin.webmanifest";

/** Swap the page's manifest (and the iOS home-screen hints) for the admin
 *  app's while the panel is mounted; restore the shop's on the way out. */
export function useAdminManifest() {
  useEffect(() => {
    const head = document.head;
    const manifest = head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const shopHref = manifest?.getAttribute("href") ?? null;
    if (manifest) manifest.setAttribute("href", ADMIN_MANIFEST);

    const added: Element[] = [];
    const add = (tag: "link" | "meta", attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      head.appendChild(el);
      added.push(el);
    };
    // iOS reads these rather than the manifest's icons/name.
    add("link", { rel: "apple-touch-icon", href: "/admin-apple-touch-icon.png" });
    add("meta", { name: "apple-mobile-web-app-title", content: "ניהול אור זרוע" });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "mobile-web-app-capable", content: "yes" });

    return () => {
      if (manifest && shopHref) manifest.setAttribute("href", shopHref);
      for (const el of added) el.remove();
    };
  }, []);
}

const isAdminQuery = (key: readonly unknown[]) =>
  typeof key[0] === "string" && (key[0].startsWith("admin-") || key[0].startsWith("order-"));

/** Refetch the panel's data when the app comes back after a while away. */
export function useRefreshOnReturn(minAwayMs = 30_000) {
  const qc = useQueryClient();
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= minAwayMs) {
        qc.invalidateQueries({ predicate: (q) => isAdminQuery(q.queryKey) });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [qc, minAwayMs]);
}

/** The installed app's icon badge (Android, iOS 16.4+ home-screen apps,
 *  desktop). A silent no-op where the Badging API is missing. */
export function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
  }, [count]);
}

const PULL_TRIGGER = 72; // px of finger travel that commits a refresh
const PULL_MAX = 110;

/**
 * Pull-to-refresh for the installed app only — in a browser tab the browser's
 * own gesture already does this, and two at once would fight. Starts only when
 * the page is scrolled to the very top and no sheet/dialog is open.
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const blocked = () => !!document.querySelector('[role="dialog"][data-state="open"]');
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      startY.current =
        window.scrollY <= 0 && e.touches.length === 1 && !blocked() ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      // Resistance: the indicator moves slower than the finger.
      set(Math.min(PULL_MAX, dy * 0.5));
    };
    const onEnd = async () => {
      const committed = pullRef.current >= PULL_TRIGGER;
      startY.current = null;
      set(0);
      if (!committed) return;
      setRefreshing(true);
      try {
        await qc.invalidateQueries({ predicate: (q) => isAdminQuery(q.queryKey) });
        navigator.vibrate?.(10);
      } finally {
        setRefreshing(false);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [qc]);

  const visible = pull > 4 || refreshing;
  const ready = pull >= PULL_TRIGGER;
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-opacity duration-160 lg:hidden",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ transform: `translateY(${refreshing ? 56 : pull}px)` }}
    >
      <span className="mt-[env(safe-area-inset-top)] flex h-10 w-10 items-center justify-center rounded-full border border-glass-line bg-card shadow-md">
        <RefreshCw
          className={cn("h-5 w-5 text-accent", refreshing && "animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          aria-hidden="true"
        />
        <span className="sr-only">{refreshing ? "מרענן…" : ready ? "שחררו לרענון" : ""}</span>
      </span>
    </div>
  );
}
