import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton } from "@/components/Skeletons";
import { Package, FolderTree, ShoppingBag, ShoppingCart, LayoutDashboard, Star, Users, Mail, Send, Store } from "lucide-react";

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

const items = [
  { to: "/admin", label: "סקירה", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "מוצרים", icon: Package },
  { to: "/admin/categories", label: "קטגוריות", icon: FolderTree },
  { to: "/admin/orders", label: "הזמנות", icon: ShoppingBag },
  { to: "/admin/customers", label: "לקוחות", icon: Users },
  { to: "/admin/abandoned", label: "עגלות נטושות", icon: ShoppingCart },
  { to: "/admin/campaigns", label: "דיוור", icon: Mail },
  { to: "/admin/reviews", label: "חוות דעת", icon: Star },
  // Reachable only by typing the URL until now — a settings screen nothing
  // links to is a screen that does not exist.
  { to: "/admin/telegram", label: "התראות", icon: Send },
];

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

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
    <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
      {/* On a phone this was a stacked column of nine links: every admin screen
          opened to a full height of navigation, and the actual content began
          below the fold. Under lg it is now one horizontally scrollable row —
          the whole panel is one thumb-swipe away and the page starts with the
          page. From lg up it is the sidebar it always was, made sticky so the
          nav does not scroll away down a long orders table. */}
      <aside
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:sticky lg:top-24 lg:self-start"
      >
        <div className="mb-3 hidden font-display text-lg font-bold text-primary lg:block">
          פאנל ניהול
        </div>
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm transition-colors duration-160 ease-out lg:py-2 ${
                active ? "bg-primary text-primary-foreground" : "bg-muted/50 lg:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
              }`}
            >
              <it.icon className="h-4 w-4 shrink-0" /> {it.label}
            </Link>
          );
        })}
        {/* The panel had no way back to the shop — the owner had to edit the
            URL to look at their own storefront. */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-160 ease-out lg:mt-4 lg:py-2 lg:border-t lg:rounded-none lg:pt-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
        >
          <Store className="h-4 w-4 shrink-0" /> לחנות
        </Link>
      </aside>
      <section>
        <Outlet />
      </section>
    </div>
  );
}
