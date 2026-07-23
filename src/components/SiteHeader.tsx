import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, Search, Menu, X, Heart } from "lucide-react";
import { useCart, formatILS, getEffectivePrice } from "@/lib/cart";
import { useFavorites } from "@/components/engagement/favorites";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeTerm } from "@/routes/shop";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ClubBadge } from "@/components/ClubBadge";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { thumbUrl } from "@/lib/img";
import { openCookieSettings } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";
import logoUrl from "@/assets/logo.webp";

type Cat = { id: string; slug: string; name: string };

type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
};

// ---------------------------------------------------------------------------
// Desktop nav row — curated links to REAL category slugs (verified in the DB).
// Owner: to swap a destination, edit the <Link> labels/slugs in the nav row
// below. TALITOT_SLUG is the store's percent-encoded talitot category slug —
// the exact same slug the homepage hero CTA links to; keep it verbatim.
// ---------------------------------------------------------------------------
const TALITOT_SLUG = "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa";

// Nav link idiom: animated gold hairline underline growing in from the right
// (transform-origin right = RTL-correct).
const NAV_LINK_CLS =
  "relative py-1 text-foreground transition-colors hover:text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-gold after:transition-transform after:duration-300 hover:after:scale-x-100";

export function SiteHeader() {
  const { count } = useCart();
  // SSR renders favCount 0 (the hook returns [] on the server), so there is
  // no hydration mismatch — the badge appears after mount, like the cart badge.
  const { count: favCount } = useFavorites();
  const { user, isAdmin, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Visual-only: the sticky bar rests on its gold hairline; the soft shadow
  // joins it only after the page scrolls. Attached in an effect — SSR-safe.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["header-categories"],
    queryFn: async () => {
      // Top level only. With the full supplier catalog loaded there are 72
      // categories, and listing every subcategory turns the drawer into a
      // 70-item scroll. Subcategories are reachable from /categories.
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .is("parent_slug", null)
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

  // Debounce keystrokes so we hit the DB at most a few times per search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const term = sanitizeTerm(debounced);
  const suggestionsEnabled = searchOpen && term.length >= 2;

  const { data: suggestions, isSuccess: suggestionsReady } = useQuery({
    queryKey: ["header-search", debounced],
    enabled: suggestionsEnabled,
    staleTime: 60_000,
    queryFn: async () => {
      // Same hybrid RPC the /shop results page uses, so the suggestions can
      // never disagree with the page they lead to. Falls back to the old ILIKE
      // lookup if the function is unavailable.
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("search_products", {
        p_term: debounced.trim().slice(0, 100),
        p_limit: 6,
        p_offset: 0,
        p_sort: "relevance",
      });
      if (!rpcErr) {
        const rows = (rpcRows ?? []) as Array<SearchSuggestion & { total_count: number }>;
        return { rows: rows as SearchSuggestion[], total: Number(rows[0]?.total_count ?? 0) };
      }
      console.warn("[header] search_products RPC unavailable, using ILIKE fallback:", rpcErr);

      const like = `%${term}%`;
      const { data, error, count } = await supabase
        .from("products")
        .select("id, slug, name, price, sale_price, thumbnail_url", { count: "exact" })
        .eq("is_active", true)
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .limit(6);
      if (error) throw error;
      return { rows: (data ?? []) as SearchSuggestion[], total: count ?? 0 };
    },
  });

  // Category suggestions come from the already-cached header list — no extra fetch.
  const catSuggestions = suggestionsEnabled
    ? categories.filter((c) => c.name.includes(term)).slice(0, 2)
    : [];

  const goToAllResults = () => {
    const t = q.trim();
    if (!t) return;
    setSearchOpen(false);
    navigate({ to: "/shop", search: { q: t } as any });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToAllResults();
  };

  // ArrowDown/ArrowUp move focus across the suggestion rows (they are links,
  // so Tab order already works — this just adds the expected arrow behavior).
  const focusSuggestion = (delta: number) => {
    const items = suggestionsRef.current?.querySelectorAll<HTMLElement>("[data-suggestion]");
    if (!items || items.length === 0) return;
    const idx = Array.from(items).indexOf(document.activeElement as HTMLElement);
    const next = idx === -1 ? (delta > 0 ? 0 : items.length - 1) : Math.min(Math.max(idx + delta, 0), items.length - 1);
    items[next]?.focus();
  };

  return (
    // Sticky lives on the <header> itself with -top-9 (the club strip is h-9):
    // the strip scrolls off while the glass bar below pins to the viewport top.
    // z-40 matches the old layout wrapper so overlay layering is unchanged.
    <header className="sticky -top-9 z-40 w-full">
      <ClubBadge variant="strip" />
      {/* Main bar: parchment glass, gold hairline at rest, shadow after scroll */}
      <div
        className={`bg-background/90 backdrop-blur-md transition-shadow ${
          scrolled ? "shadow-[var(--shadow-soft)]" : ""
        }`}
      >
      <div className="container mx-auto grid h-20 grid-cols-3 items-center px-4">
        {/* RTL start (right): menu + search */}
        <div className="flex items-center gap-1 justify-self-start">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent"
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
                  {/* /articles had no entry point anywhere in the shell; the drawer
                      is the one nav that is visible at every breakpoint, so the
                      guides live here as well as in the footer. */}
                  <Link to="/articles" onClick={() => setDrawerOpen(false)} className="py-3 border-b border-border/40 hover:text-accent transition-colors">מדריכים ומאמרים</Link>
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
                  <Link to="/favorites" onClick={() => setDrawerOpen(false)} className="flex items-center justify-between py-2 text-sm hover:text-accent">
                    <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> מועדפים</span>
                    {favCount > 0 && <span className="text-xs text-accent font-semibold">{favCount}</span>}
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent"
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
          <Link to="/cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent" aria-label="עגלה">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-argaman px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <Link to="/favorites" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent" aria-label="מועדפים">
            <Heart className="h-5 w-5" />
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-argaman px-1 text-[11px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          {user ? (
            <Link to="/account" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent" aria-label="החשבון שלי">
              <UserIcon className="h-5 w-5 text-accent" />
            </Link>
          ) : (
            <Link to="/auth" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent" aria-label="כניסה">
              <UserIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Desktop nav row — curated premium destinations (the full 72-category
          drawer stays behind the hamburger). Owner: swap items by editing the
          labels/slugs here; every slug is a real category verified in the DB. */}
      <nav aria-label="ניווט ראשי" className="hidden lg:flex h-11 items-center justify-center gap-8 text-[15px]">
        <Link to="/shop" className={NAV_LINK_CLS}>חנות</Link>
        <Link to="/category/$slug" params={{ slug: "wedding" }} className={NAV_LINK_CLS}>מארזים לחתן</Link>
        <Link to="/category/$slug" params={{ slug: "chatan-kala" }} className={NAV_LINK_CLS}>חתן וכלה</Link>
        <Link to="/category/$slug" params={{ slug: "chalaka-set" }} className={NAV_LINK_CLS}>סטי חלאקה</Link>
        <Link to="/category/$slug" params={{ slug: TALITOT_SLUG }} className={NAV_LINK_CLS}>טליתות</Link>
        <Link to="/categories" className={NAV_LINK_CLS}>כל הקטגוריות</Link>
      </nav>

      {/* Bottom edge: full-width gold hairline */}
      <div aria-hidden="true" className="h-px w-full" style={{ background: "var(--gradient-gold-line)" }} />
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur" onClick={() => setSearchOpen(false)}>
          <div className="container mx-auto px-4 pt-6 md:pt-10">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש באתר"
            className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-gold/40 bg-background shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={submitSearch} className="flex items-center gap-3 px-4 py-4">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="site-search" className="sr-only">חיפוש מוצרים וקטגוריות</label>
              <input
                id="site-search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusSuggestion(1);
                  }
                }}
                placeholder="חיפוש מוצרים, קטגוריות…"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:text-accent"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </form>

            {/* Live suggestions */}
            {suggestionsEnabled && (
              <div className="border-t border-gold/20">
                <div
                  ref={suggestionsRef}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      focusSuggestion(1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      focusSuggestion(-1);
                    }
                  }}
                >
                  {catSuggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border/40">
                      <span className="text-xs text-muted-foreground">קטגוריות</span>
                      {catSuggestions.map((c) => (
                        <Link
                          key={c.id}
                          to="/category/$slug"
                          params={{ slug: c.slug }}
                          data-suggestion
                          onClick={() => setSearchOpen(false)}
                          className="rounded-full border border-gold/40 px-3 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {(suggestions?.rows ?? []).map((p) => {
                    const effective = getEffectivePrice(p.price);
                    return (
                      <Link
                        key={p.id}
                        to="/product/$slug"
                        params={{ slug: p.slug }}
                        data-suggestion
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
                      >
                        {p.thumbnail_url && (
                          <img
                            src={thumbUrl(p.thumbnail_url, 96) ?? p.thumbnail_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            // Suggestion rows are decorative next to the product
                            // name, so a single fallback to the original is
                            // enough — no placeholder stage needed.
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src !== p.thumbnail_url) img.src = p.thumbnail_url!;
                            }}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <span className="flex-1 font-display text-[15px] line-clamp-1">{p.name}</span>
                        {Number(p.price) === 0 ? (
                          <span className="shrink-0 text-xs font-semibold text-accent">לפי שער הזהב</span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-sm font-semibold text-accent">{formatILS(effective)}</span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {suggestionsReady && (suggestions?.rows.length ?? 0) === 0 && (
                    <div className="px-4 py-2.5 text-sm text-muted-foreground">לא נמצאו מוצרים מתאימים</div>
                  )}
                  {(suggestions?.total ?? 0) > 0 && (
                    <div className="px-4 py-3">
                      <button
                        type="button"
                        data-suggestion
                        onClick={goToAllResults}
                        className="w-full rounded-full border border-accent px-6 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        כל התוצאות ({suggestions!.total})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-24 bg-cream text-foreground">
      {/* Top edge: gold hairline */}
      <div aria-hidden="true" className="h-px w-full" style={{ background: "var(--gradient-gold-line)" }} />
      {/* Decorative ornament */}
      <div className="container mx-auto px-4 pt-14 pb-4">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="font-display text-2xl tracking-wide text-foreground">אור זרוע לצדיק</div>
          <div className="flex items-center gap-3 mt-4" aria-hidden="true">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
            <span className="text-gold text-sm tracking-widest">✦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
          </div>
          <p className="mt-5 max-w-xl text-sm md:text-[15px] text-muted-foreground leading-relaxed">
            חנות תשמישי קדושה — כלי כסף, כוסות קידוש, חנוכיות, מזוזות, טליתות ועוד, באיכות ובהידור.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-3 max-w-5xl mx-auto">
          <div className="text-center md:text-right">
            <div className="text-xs tracking-[0.35em] text-accent uppercase mb-4">קישורים</div>
            <ul className="space-y-2.5 text-[15px] text-muted-foreground">
              <li><Link to="/shop" className="hover:text-accent transition-colors">כל המוצרים</Link></li>
              <li><Link to="/categories" className="hover:text-accent transition-colors">קטגוריות</Link></li>
              <li><Link to="/articles" className="hover:text-accent transition-colors">מדריכים ומאמרים</Link></li>
              <li><Link to="/about" className="hover:text-accent transition-colors">אודות</Link></li>
              <li><Link to="/club" className="hover:text-accent transition-colors">מועדון חברים</Link></li>
              <li><Link to="/track" className="hover:text-accent transition-colors">מעקב הזמנה</Link></li>
            </ul>
          </div>
          <div className="text-center">
            <div className="text-xs tracking-[0.35em] text-accent uppercase mb-4">תקנון האתר</div>
            <ul className="space-y-2.5 text-[15px] text-muted-foreground">
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
          {/* Contact block — the CANONICAL home of the address/phone (the
              homepage colophon de-emphasizes them); content stays unchanged. */}
          <div className="text-center md:text-left">
            <div className="text-xs tracking-[0.35em] text-accent uppercase mb-4">צור קשר</div>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              לבירורים והזמנות מיוחדות,<br />צרו איתנו קשר.
            </p>
            <div className="mt-3 text-xs text-muted-foreground leading-relaxed space-y-0.5">
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

        {/* Newsletter capture — marketing consent, separate from the
            operational contact consent collected at checkout. */}
        <div className="mt-12 mx-auto max-w-lg text-center">
          <div className="text-xs tracking-[0.35em] text-accent uppercase mb-3">
            הצטרפו לרשימת התפוצה
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            מבצעים ועדכונים — בלי ספאם, אפשר להסיר בכל רגע.
          </p>
          <NewsletterSignup />
        </div>

        {/* Divider */}
        <div className="mt-14 flex items-center gap-4 max-w-4xl mx-auto" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <span className="text-gold text-xs">✦</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-gold/30">
        <div className="container mx-auto px-4 py-6 text-center text-xs tracking-wide text-muted-foreground">
          © {new Date().getFullYear()} אור זרוע לצדיק. כל הזכויות שמורות.
        </div>
      </div>
    </footer>
  );
}

