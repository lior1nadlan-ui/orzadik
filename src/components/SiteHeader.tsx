import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, Search, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ClubBadge } from "@/components/ClubBadge";
import { openCookieSettings } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";
import logoUrl from "@/assets/logo.png";

type Cat = { id: string; slug: string; name: string };

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const { data: categories = [] } = useQuery({
    queryKey: ["header-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .not("slug", "in", "(uncategorized)")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as Cat[];
    },
  });

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearchOpen(false);
    navigate({ to: "/shop", search: { q: term } as any });
  };

  return (
    <header className="w-full border-b border-border/60 bg-background">
      <ClubBadge variant="strip" />
      <div className="container mx-auto grid h-20 grid-cols-3 items-center px-4">
        {/* RTL start (right): menu + search */}
        <div className="flex items-center gap-1 justify-self-start">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                aria-label="תפריט"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 overflow-y-auto">
              <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="px-6 py-5 border-b">
                  <div className="font-display text-lg text-foreground">תפריט</div>
                </div>


                <nav className="px-6 py-4 flex flex-col text-base">
                  <Link to="/" onClick={() => setDrawerOpen(false)} className="py-3 border-b border-border/40 hover:text-accent transition-colors">בית</Link>
                  <Link to="/shop" onClick={() => setDrawerOpen(false)} className="py-3 border-b border-border/40 hover:text-accent transition-colors">כל המוצרים</Link>
                  <Link to="/categories" onClick={() => setDrawerOpen(false)} className="py-3 border-b border-border/40 hover:text-accent transition-colors">קטגוריות</Link>
                  <Link to="/about" onClick={() => setDrawerOpen(false)} className="py-3 border-b border-border/40 hover:text-accent transition-colors">אודות</Link>
                </nav>

                <div className="px-6 pt-4 pb-2">
                  <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">קטגוריות</div>
                  <div className="flex flex-col">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => setDrawerOpen(false)}
                        className="py-2.5 text-sm text-foreground/85 hover:text-accent transition-colors border-b border-border/30"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-auto px-6 py-5 border-t bg-cream/40 flex flex-col gap-2">
                  <Link to="/cart" onClick={() => setDrawerOpen(false)} className="flex items-center justify-between py-2 text-sm hover:text-accent">
                    <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> עגלת קניות</span>
                    {count > 0 && <span className="text-xs text-accent font-semibold">{count}</span>}
                  </Link>
                  {user ? (
                    <>
                      <Link to="/account" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 py-2 text-sm hover:text-accent">
                        <UserIcon className="h-4 w-4" /> החשבון שלי
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setDrawerOpen(false)} className="py-2 text-sm hover:text-accent">ניהול</Link>
                      )}
                      <button onClick={() => { signOut(); setDrawerOpen(false); }} className="text-right py-2 text-sm hover:text-accent">יציאה</button>
                    </>
                  ) : (
                    <Link to="/auth" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 py-2 text-sm hover:text-accent">
                      <UserIcon className="h-4 w-4" /> כניסה / הרשמה
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
            aria-label="חיפוש"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>


        {/* Center: logo */}
        <Link to="/" className="justify-self-center flex items-center" aria-label="אור זרוע לצדיק">
          <img
            src={logoUrl}
            alt="אור זרוע לצדיק"
            className="h-14 md:h-16 w-auto object-contain"
          />
        </Link>

        {/* RTL end (left): cart + account */}
        <div className="flex items-center gap-1 justify-self-end">
          <Link to="/cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted" aria-label="עגלה">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <Link to="/account" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted" aria-label="החשבון שלי">
              <UserIcon className="h-5 w-5 text-[#A8862A]" />
            </Link>
          ) : (
            <Link to="/auth" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted" aria-label="כניסה">
              <UserIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש באתר"
            className="bg-background border-b shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={submitSearch} className="container mx-auto px-4 py-6 flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="site-search" className="sr-only">חיפוש מוצרים וקטגוריות</label>
              <input
                id="site-search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="חיפוש מוצרים, קטגוריות…"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-24 bg-gradient-to-b from-cream/40 via-background to-cream/60 text-foreground overflow-hidden">
      {/* Top gold hairline */}
      <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      {/* Decorative ornament */}
      <div className="container mx-auto px-4 pt-14 pb-4">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="font-display text-3xl md:text-4xl tracking-wide text-foreground">אור זרוע לצדיק</div>
          <div className="flex items-center gap-3 mt-4" aria-hidden="true">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-accent/60" />
            <span className="text-accent text-sm tracking-widest">✦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-accent/60" />
          </div>
          <p className="mt-5 max-w-xl text-sm md:text-[15px] text-muted-foreground leading-relaxed">
            חנות תשמישי קדושה — כלי כסף, כוסות קידוש, חנוכיות, מזוזות, טליתות ועוד, באיכות ובהידור.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-3 max-w-5xl mx-auto">
          <div className="text-center md:text-right">
            <div className="text-[10px] tracking-[0.4em] text-accent uppercase mb-4">קישורים</div>
            <ul className="space-y-2.5 text-sm text-foreground/80">
              <li><Link to="/shop" className="hover:text-accent transition-colors">כל המוצרים</Link></li>
              <li><Link to="/categories" className="hover:text-accent transition-colors">קטגוריות</Link></li>
              <li><Link to="/about" className="hover:text-accent transition-colors">אודות</Link></li>
            </ul>
          </div>
          <div className="text-center">
            <div className="text-[10px] tracking-[0.4em] text-accent uppercase mb-4">תקנון האתר</div>
            <ul className="space-y-2.5 text-sm text-foreground/80">
              <li><Link to="/privacy" className="hover:text-accent transition-colors">מדיניות פרטיות</Link></li>
              <li><Link to="/accessibility" className="hover:text-accent transition-colors">הצהרת נגישות</Link></li>
              <li><Link to="/terms" className="hover:text-accent transition-colors">תקנון ותנאי שימוש</Link></li>
              <li>
                <button onClick={openCookieSettings} className="hover:text-accent transition-colors">
                  ניהול עוגיות
                </button>
              </li>
            </ul>
          </div>
          <div className="text-center md:text-left">
            <div className="text-[10px] tracking-[0.4em] text-accent uppercase mb-4">צור קשר</div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              לבירורים והזמנות מיוחדות,<br />צרו איתנו קשר.
            </p>
            <div className="mt-3 text-xs text-foreground/70 leading-relaxed space-y-0.5">
              <div>{BUSINESS.name}{BUSINESS.legalId ? ` · ${BUSINESS.legalId}` : ""}</div>
              {BUSINESS.address && <div>{BUSINESS.address}</div>}
              <div>
                <a href={`tel:${BUSINESS.phone}`} className="hover:text-accent">{BUSINESS.phoneDisplay}</a>
                {" · "}
                <a href={`mailto:${BUSINESS.email}`} className="hover:text-accent">{BUSINESS.email}</a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-14 flex items-center gap-4 max-w-4xl mx-auto" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <span className="text-accent text-xs">✦</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        </div>

        <div className="py-6 text-center text-xs tracking-wide text-muted-foreground">
          © {new Date().getFullYear()} אור זרוע לצדיק. כל הזכויות שמורות.
        </div>
      </div>
    </footer>
  );
}

