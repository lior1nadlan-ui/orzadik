import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads } from "@/lib/leads.functions";
import { countOrdersToHandle } from "@/lib/admin-crm.functions";
import {
  PullToRefresh,
  useAdminManifest,
  useAppBadge,
  useRefreshOnReturn,
} from "@/components/admin/AdminAppShell";
import { AdminSheet, AdminSheetContent } from "@/components/admin/AdminSheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton } from "@/components/Skeletons";
import {
  Package,
  FolderTree,
  ShoppingBag,
  ShoppingCart,
  LayoutDashboard,
  Star,
  Users,
  Mail,
  BadgePercent,
  Send,
  Store,
  Activity,
  Target,
  Ellipsis,
  Accessibility,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: AdminLayout,
  head: () => ({ meta: [{ title: "ניהול" }, { name: "robots", content: "noindex, nofollow" }] }),
});

type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

const items: NavItem[] = [
  // Daily work first: the first four are the phone's bottom tabs (TAB_PATHS),
  // the rest sit under "עוד". Catalog and settings follow.
  { to: "/admin", label: "סקירה", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "הזמנות", icon: ShoppingBag },
  // Right after orders: the people who almost were orders.
  { to: "/admin/leads", label: "לידים", icon: Target },
  { to: "/admin/customers", label: "לקוחות", icon: Users },
  { to: "/admin/products", label: "מוצרים", icon: Package },
  { to: "/admin/categories", label: "קטגוריות", icon: FolderTree },
  { to: "/admin/promotions", label: "מבצעים", icon: BadgePercent },
  { to: "/admin/campaigns", label: "דיוור", icon: Mail },
  { to: "/admin/reviews", label: "חוות דעת", icon: Star },
  // The carts' own history (reminder runs, converted carts). Day-to-day
  // follow-up of open carts lives in לידים.
  { to: "/admin/abandoned", label: "היסטוריית עגלות", icon: ShoppingCart },
  // Reachable only by typing the URL until now — a settings screen nothing
  // links to is a screen that does not exist.
  { to: "/admin/telegram", label: "התראות", icon: Send },
  { to: "/admin/system", label: "מצב המערכת", icon: Activity },
];

const isActive = (it: NavItem, path: string) =>
  it.exact ? path === it.to || path === `${it.to}/` : path.startsWith(it.to);

// The phone's bottom tabs: the daily four, then "עוד" for the rest.
const TAB_PATHS = ["/admin", "/admin/orders", "/admin/leads", "/admin/customers"];
const TABS = TAB_PATHS.map((to) => items.find((it) => it.to === to)!);
const MORE = items.filter((it) => !TAB_PATHS.includes(it.to));

const TAB_CLASS =
  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** The icon's pill: the active tab gets the bronze-tinted capsule (Material's
 *  "active indicator"), so the current screen reads at a glance. */
function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-160 ease-out",
        active ? "bg-accent/12 text-accent" : "",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** The number on a tab: something is waiting on that screen. */
function TabBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute top-1 start-[calc(50%+0.5rem)] min-w-5 rounded-full bg-amber-500 px-1 text-center text-[11px] font-bold leading-5 text-white"
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileTabBar({
  path,
  leadCount,
  toShipCount,
}: {
  path: string;
  leadCount: number;
  toShipCount: number;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Close the "עוד" sheet once one of its screens has opened.
  useEffect(() => setMoreOpen(false), [path]);
  const moreActive = MORE.some((it) => isActive(it, path));
  return (
    <>
      {/* data-mobile-actionbar: styles.css lifts the cookie band (and any
          floating button) clear of a bottom bar under lg. data-admin-tabbar
          hides the accessibility button there — "עוד" opens its menu. */}
      <nav
        aria-label="ניווט בפאנל הניהול"
        data-mobile-actionbar
        data-admin-tabbar
        className="glass-strong fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gold/40 pb-[env(safe-area-inset-bottom)] [--glass-radius:0px] lg:hidden"
      >
        {TABS.map((it) => {
          const active = isActive(it, path);
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active ? "page" : undefined}
              className={cn(TAB_CLASS, active ? "text-accent" : "text-muted-foreground")}
            >
              <TabIcon icon={it.icon} active={active} />
              {it.label}
              {it.to === "/admin/leads" && (
                <TabBadge count={leadCount} label={`${leadCount} לידים פתוחים`} />
              )}
              {it.to === "/admin/orders" && (
                <TabBadge
                  count={toShipCount}
                  label={
                    toShipCount === 1
                      ? "הזמנה אחת ששולמה ממתינה לטיפול"
                      : `${toShipCount} הזמנות ששולמו ממתינות לטיפול`
                  }
                />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(TAB_CLASS, moreActive ? "text-accent" : "text-muted-foreground")}
        >
          <TabIcon icon={Ellipsis} active={moreActive} />
          עוד
        </button>
      </nav>

      <AdminSheet open={moreOpen} onOpenChange={setMoreOpen}>
        <AdminSheetContent
          title="עוד בפאנל"
          size="md"
          // On a phone this one is a bottom sheet, not a full screen: it is a
          // menu, and the screen behind it should stay in view.
          className="max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[85dvh] max-sm:[--glass-radius:1.25rem_1.25rem_0_0]"
        >
          <ul className="grid grid-cols-3 gap-2">
            {MORE.map((it) => {
              const active = isActive(it, path);
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-3 text-center text-xs font-medium transition-colors duration-160 ease-out",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-glass-line bg-card/60 active:bg-muted",
                    )}
                  >
                    <it.icon className="h-5 w-5" aria-hidden="true" />
                    {it.label}
                  </Link>
                </li>
              );
            })}
            <li>
              {/* The floating accessibility button is hidden under the tab bar
                  (styles.css); this opens the same menu. */}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  document.querySelector<HTMLButtonElement>("[data-a11y-fab]")?.click();
                }}
                className="flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-glass-line bg-card/60 px-1 py-3 text-center text-xs font-medium active:bg-muted"
              >
                <Accessibility className="h-5 w-5" aria-hidden="true" />
                נגישות
              </button>
            </li>
            <li>
              <Link
                to="/"
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-glass-line px-1 py-3 text-center text-xs font-medium text-muted-foreground active:bg-muted"
              >
                <Store className="h-5 w-5" aria-hidden="true" />
                לחנות
              </Link>
            </li>
          </ul>
        </AdminSheetContent>
      </AdminSheet>
    </>
  );
}

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Open leads, for the count on the "לידים" tab — the one number that says
  // "someone is waiting for a call". Same query key and function as the leads
  // screen, so the two share one cache entry and never disagree.
  const loadLeads = useServerFn(listLeads);
  const { data: leads } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: () => loadLeads(),
    enabled: !!user && isAdmin,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const leadCount = (leads ?? []).filter((l) => l.state === "open").length;
  // Paid orders still waiting to go out (or to be collected) — the count on
  // the "הזמנות" tab, and what its "לטיפול" view lists.
  const countToHandle = useServerFn(countOrdersToHandle);
  const { data: toShipCount = 0 } = useQuery({
    queryKey: ["admin-orders-to-handle"],
    queryFn: () => countToHandle(),
    enabled: !!user && isAdmin,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  useAdminManifest();
  useRefreshOnReturn();
  useAppBadge(isAdmin ? leadCount + toShipCount : 0);

  useEffect(() => {
    // The real gate is the DB: RLS `has_role('admin')` policies on every admin
    // table. `beforeLoad` and this effect are client-side UX redirects only
    // (beforeLoad early-returns during SSR). We only handle a fully signed-out
    // state here — we must NOT redirect on the transient `!isAdmin` window,
    // because `loading` flips false (from getSession) before the isAdmin role
    // round-trip resolves, which used to bounce genuine admins on hard refresh.
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Show a loader while auth is resolving OR while the admin-role check is still
  // in flight (user present but isAdmin not yet true). beforeLoad guarantees a
  // non-admin never reaches this component.
  if (loading || (user && !isAdmin)) {
    // Keep the panel's sidebar + content footprint while auth/role resolves,
    // instead of a bare one-line loader that collapses the layout.
    return (
      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
        <CardSkeleton className="min-h-[16rem]" />
        <CardSkeleton className="min-h-[24rem]" />
      </div>
    );
  }
  if (!user) return <div className="container mx-auto px-4 py-20 text-center">אין הרשאה</div>;

  return (
    <div className="container mx-auto px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] grid lg:grid-cols-[220px_1fr] gap-6 lg:py-6">
      {/* From lg up: the sidebar it always was, sticky so the nav does not
          scroll away down a long orders table. Under lg the panel's navigation
          is the bottom tab bar below — the screens the owners open twenty times
          a day sit under the thumb, everything else is one tap away in "עוד".
          (It used to be a sideways-scrolling strip under the shop header, with
          half the panel off screen and the page starting below the fold.) */}
      <aside className="hidden lg:block lg:space-y-1 lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 font-display text-lg font-bold text-primary">פאנל ניהול</div>
        {items.map((it) => {
          const active = isActive(it, path);
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors duration-160 ease-out ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
              }`}
            >
              <it.icon className="h-4 w-4 shrink-0" /> {it.label}
              {it.to === "/admin/leads" && leadCount > 0 && (
                <span className="ms-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900">
                  {leadCount}
                </span>
              )}
              {it.to === "/admin/orders" && toShipCount > 0 && (
                <span className="ms-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900">
                  {toShipCount}
                </span>
              )}
            </Link>
          );
        })}
        {/* The panel had no way back to the shop — the owner had to edit the
            URL to look at their own storefront. */}
        <Link
          to="/"
          className="mt-4 flex items-center gap-2 whitespace-nowrap border-t px-3 pt-4 pb-2 text-sm text-muted-foreground transition-colors duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
        >
          <Store className="h-4 w-4 shrink-0" /> לחנות
        </Link>
      </aside>
      {/* min-w-0: a grid track is `minmax(auto, 1fr)`, so a wide table inside
          (orders, products) used to stretch the whole column — and the page —
          past the phone's width instead of scrolling inside its own box. */}
      <section className="min-w-0">
        <Outlet />
      </section>
      <MobileTabBar path={path} leadCount={leadCount} toShipCount={toShipCount} />
      <PullToRefresh />
    </div>
  );
}
