import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Package, FolderTree, ShoppingBag, ShoppingCart, LayoutDashboard, Star, Users } from "lucide-react";

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
  { to: "/admin/reviews", label: "חוות דעת", icon: Star },
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
    return <div className="container mx-auto px-4 py-20 text-center">טוען...</div>;
  }
  if (!user) return <div className="container mx-auto px-4 py-20 text-center">אין הרשאה</div>;

  return (
    <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
      <aside className="space-y-1">
        <div className="font-display text-lg font-bold mb-3 text-primary">פאנל ניהול</div>
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <it.icon className="h-4 w-4" /> {it.label}
            </Link>
          );
        })}
      </aside>
      <section>
        <Outlet />
      </section>
    </div>
  );
}
