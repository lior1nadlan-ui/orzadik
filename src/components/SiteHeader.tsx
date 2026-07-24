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
import { CartDrawer } from "@/components/cart/CartDrawer";
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

// ---------------------------------------------------------------------------
// Shared class idioms for the chrome.
//
// Every hover is gated behind (hover:hover) and (pointer:fine) so touch devices
// never latch a hover state, and every transition names its properties — no
// `transition-all`, no bare `transition`. Written out literally (not composed
// from fragments) because Tailwind's scanner only sees whole class names.
// ---------------------------------------------------------------------------

// Nav link idiom: animated gold hairline underline growing in from the right
// (transform-origin right = RTL-correct). Only `transform` and `color` animate.
//
// Reduced motion is handled with `motion-reduce:after:transition-none` rather
// than by dropping the rule with `motion-safe:`. Dropping it would take the
// underline away entirely and leave that user with a weaker hover affordance;
// this way the underline still appears, it just appears instantly — movement
// gone, the state change kept.
const NAV_LINK_CLS = `relative py-1 text-foreground
  transition-[color] duration-200 ease-out
  after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0
  after:bg-gold after:transition-transform after:duration-200 after:ease-out
  motion-reduce:after:transition-none
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent
  [@media(hover:hover)_and_(pointer:fine)]:hover:after:scale-x-100`;

// Plain text links (drawer, footer): a named colour transition, nothing else.
const LINK_HOVER_CLS = `transition-[color] duration-200 ease-out
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`;

// Icon buttons in the bar. These are the highest-frequency controls on the site,
// so per the frequency rule they get press feedback and an INSTANT colour swap —
// `.press` owns transition-property here (it is emitted after Tailwind's own
// utilities), so pairing it with a colour transition would be a lie.
const ICON_BTN_CLS = `inline-flex h-10 w-10 items-center justify-center rounded-full
  text-foreground press
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`;

export function SiteHeader() {
  const { count, openCart, isCartOpen } = useCart();
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
    // The top-level category list is effectively static across a session — it
    // changes only when the owner edits the catalog. A generous staleTime (10m)
    // plus a long gcTime keeps the nav out of the refetch path so navigating
    // between pages doesn't trigger a fresh Supabase round-trip. (The global
    // default is only 60s with refetchOnWindowFocus off; this is the nav's own,
    // longer budget.) What the nav renders is unchanged.
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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
    <>
    {/* Mini-cart drawer — rendered once at the site-chrome level (SiteHeader is
        on every storefront page). Portals to the body, so its position here has
        no layout effect; it is opened by the cart button above and by any
        add-to-cart across the site. */}
    <CartDrawer />
    {/* Sticky lives on the <header> itself with -top-9 (the club strip is h-9):
      the strip scrolls off while the glass bar below pins to the viewport top.
      z-40 matches the old layout wrapper so overlay layering is unchanged. */}
    <header className="sticky -top-9 z-40 w-full">
      <ClubBadge variant="strip" />
      {/* Main bar: white glass, gold hairline at rest, soft shadow after scroll.
          .glass-strong (94% white) and NOT .glass — this bar scrolls over the
          hero video, and at 72% the gold --accent inside it would drop to
          2.9:1. At 94% the worst backdrop imaginable (pure black) still leaves
          --accent at 5.08:1.
          The scrolled shadow is swapped through .glass-strong's own
          --glass-shadow-lift variable rather than a competing `shadow-*`
          utility (which .glass-strong would win against anyway). That keeps the
          inset hairline ring and the highlight intact and animates box-shadow
          ONLY — the resting value is the same shadow at zero alpha so the two
          states interpolate instead of popping. */}
      <div
        className={`glass-strong [--glass-radius:0] [--glass-line-strong:var(--glass-line)]
          transition-[box-shadow] duration-200 ease-out ${
          scrolled
            ? "[--glass-shadow-lift:var(--shadow-soft)]"
            : "[--glass-shadow-lift:0_20px_56px_-20px_rgba(22,24,29,0)]"
        }`}
      >
      <div className="container mx-auto grid h-20 grid-cols-3 items-center px-4">
        {/* RTL start (right): menu + search */}
        <div className="flex items-center gap-1 justify-self-start">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button className={ICON_BTN_CLS} aria-label="תפריט">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 overflow-y-auto">
              <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="px-6 py-5 border-b border-border/60">
                  <div className="font-display text-lg text-foreground">תפריט</div>
                  <div aria-hidden="true" className="gold-rule mt-3 w-16" />
                </div>


                <nav className="px-6 py-4 flex flex-col text-base">
                  <Link to="/" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>בית</Link>
                  <Link to="/shop" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>כל המוצרים</Link>
                  <Link to="/categories" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>קטגוריות</Link>
                  {/* /articles had no entry point anywhere in the shell; the drawer
                      is the one nav that is visible at every breakpoint, so the
                      guides live here as well as in the footer. */}
                  <Link to="/articles" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>מדריכים ומאמרים</Link>
                  <Link to="/about" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>אודות</Link>
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
                        className={`py-2.5 text-sm text-foreground/85 border-b border-border/30 ${LINK_HOVER_CLS}`}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Decorative wash well. .glass-soft is normally text-forbidden
                    because its backdrop is unknowable — here it is not: the
                    Sheet panel above it is an opaque bg-background (#F7F8FA),
                    so the 50% white composites to a known #FBFCFD and
                    --accent reads 5.64:1 on it. Squared off and left to the
                    utility's own inset hairline instead of a border-t. */}
                <div className="mt-auto px-6 py-5 glass-soft [--glass-radius:0] flex flex-col gap-2">
                  <Link to="/cart" onClick={() => setDrawerOpen(false)} className={`flex items-center justify-between py-2 text-sm ${LINK_HOVER_CLS}`}>
                    <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> עגלת קניות</span>
                    {count > 0 && <span className="text-xs text-accent font-semibold">{count}</span>}
                  </Link>
                  <Link to="/favorites" onClick={() => setDrawerOpen(false)} className={`flex items-center justify-between py-2 text-sm ${LINK_HOVER_CLS}`}>
                    <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> מועדפים</span>
                    {favCount > 0 && <span className="text-xs text-accent font-semibold">{favCount}</span>}
                  </Link>
                  {user ? (
                    <>
                      <Link to="/account" onClick={() => setDrawerOpen(false)} className={`flex items-center gap-2 py-2 text-sm ${LINK_HOVER_CLS}`}>
                        <UserIcon className="h-4 w-4" /> החשבון שלי
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setDrawerOpen(false)} className={`py-2 text-sm ${LINK_HOVER_CLS}`}>ניהול</Link>
                      )}
                      <button onClick={() => { signOut(); setDrawerOpen(false); }} className={`text-right py-2 text-sm ${LINK_HOVER_CLS}`}>יציאה</button>
                    </>
                  ) : (
                    <Link to="/auth" onClick={() => setDrawerOpen(false)} className={`flex items-center gap-2 py-2 text-sm ${LINK_HOVER_CLS}`}>
                      <UserIcon className="h-4 w-4" /> כניסה / הרשמה
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <button onClick={() => setSearchOpen(true)} className={ICON_BTN_CLS} aria-label="חיפוש">
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
          {/* The count bubbles keep bg-argaman: burgundy survives the white
              redesign exactly here, as a small semantic fill carrying white
              text at 12.57:1. It is a badge now, never a band. */}
          {/* The cart icon now opens the mini-cart drawer (a persistent
              confirmation with a running subtotal and a direct path to
              checkout). The full /cart page stays reachable from inside the
              drawer and from the mobile nav menu above. */}
          <button
            type="button"
            onClick={openCart}
            className={`relative ${ICON_BTN_CLS}`}
            aria-label="עגלה"
            aria-haspopup="dialog"
            aria-expanded={isCartOpen}
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-argaman px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
          <Link to="/favorites" className={`relative ${ICON_BTN_CLS}`} aria-label="מועדפים">
            <Heart className="h-5 w-5" />
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-argaman px-1 text-[11px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          {user ? (
            <Link to="/account" className={ICON_BTN_CLS} aria-label="החשבון שלי">
              <UserIcon className="h-5 w-5 text-accent" />
            </Link>
          ) : (
            <Link to="/auth" className={ICON_BTN_CLS} aria-label="כניסה">
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
        // The scrim is a light veil, not a blackout: bg-foreground/60 turned the
        // whole white page into a dark wash, which is the opposite of the
        // direction. 25% of the cool deep ink plus a small blur pushes the page
        // back without extinguishing it.
        <div className="fixed inset-0 z-50 bg-argaman-deep/25 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div className="container mx-auto px-4 pt-6 md:pt-10">
          {/* The panel floats over an unknown page, so it must be .glass-strong —
              on the scrim its --accent prices read 5.64:1. Its own inset
              hairline replaces border-gold/40 and its own shadow replaces
              shadow-soft (both would lose to .glass-strong anyway). */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש באתר"
            className="mx-auto max-w-2xl overflow-hidden glass-strong"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground press [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </form>

            {/* Live suggestions. The gold hairline between the field and the
                results is the direction's signature rule — decorative, never
                text. */}
            {suggestionsEnabled && (
              <div className="border-t border-gold/25">
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
                          className="rounded-full border border-gold/40 px-3 py-1 text-xs press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
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
                        className="flex items-center gap-3 px-4 py-2.5 transition-[background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
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
                        className="w-full rounded-full border border-accent px-6 py-2 text-sm font-medium text-accent press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground"
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
    </>
  );
}

export function SiteFooter() {
  return (
    // --cream is no longer warm parchment — it is now the pale COOL tint
    // #F4F6F9, so bg-cream survives the redesign as the faint surface that
    // separates the footer from the white page above it.
    <footer className="relative mt-24 bg-cream text-foreground">
      {/* Top edge: gold hairline — the direction's signature rule. Verbatim. */}
      <div aria-hidden="true" className="h-px w-full" style={{ background: "var(--gradient-gold-line)" }} />
      {/* Decorative ornament */}
      <div className="container mx-auto px-4 pt-14 pb-4">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="font-display text-2xl tracking-wide text-foreground">אור זרוע לצדיק</div>
          {/* aria-hidden is load-bearing: text-gold is 2.44:1 on this surface.
              It is legal ONLY because it is decorative and hidden from the
              accessibility tree — removing this wrapper fails Lighthouse. */}
          <div className="flex items-center gap-3 mt-4" aria-hidden="true">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
            <span className="text-gold text-sm tracking-widest">✦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
          </div>
          <p className="mt-5 max-w-xl text-sm md:text-[15px] text-muted-foreground leading-relaxed">
            חנות תשמישי קדושה — כלי כסף, כוסות קידוש, חנוכיות, מזוזות, טליתות ועוד, באיכות ובהידור.
          </p>
        </div>

        {/* One glass pane holds the link columns AND the newsletter, split by a
            single gold rule. Layered depth over the pale cool surface rather
            than three flat columns floating on it. .glass (72%) is legal here
            because the backdrop is known and light — bg-cream, #F4F6F9 — which
            composites to #FCFDFD, where --accent reads 5.68:1,
            --muted-foreground 6.40:1 and --foreground 17.37:1. */}
        <div className="mx-auto max-w-5xl glass [--glass-radius:1.5rem] px-6 py-10 md:px-10">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="text-center md:text-right">
            <div className="text-xs tracking-[0.35em] text-accent uppercase mb-4">קישורים</div>
            <ul className="space-y-2.5 text-[15px] text-muted-foreground">
              <li><Link to="/shop" className={LINK_HOVER_CLS}>כל המוצרים</Link></li>
              <li><Link to="/categories" className={LINK_HOVER_CLS}>קטגוריות</Link></li>
              <li><Link to="/articles" className={LINK_HOVER_CLS}>מדריכים ומאמרים</Link></li>
              <li><Link to="/about" className={LINK_HOVER_CLS}>אודות</Link></li>
              <li><Link to="/club" className={LINK_HOVER_CLS}>מועדון חברים</Link></li>
              <li><Link to="/track" className={LINK_HOVER_CLS}>מעקב הזמנה</Link></li>
              <li><Link to="/contact" className={LINK_HOVER_CLS}>צור קשר</Link></li>
            </ul>
          </div>
          <div className="text-center">
            <div className="text-xs tracking-[0.35em] text-accent uppercase mb-4">תקנון האתר</div>
            <ul className="space-y-2.5 text-[15px] text-muted-foreground">
              <li><Link to="/privacy" className={LINK_HOVER_CLS}>מדיניות פרטיות</Link></li>
              <li><Link to="/accessibility" className={LINK_HOVER_CLS}>הצהרת נגישות</Link></li>
              <li><Link to="/terms" className={LINK_HOVER_CLS}>תקנון ותנאי שימוש</Link></li>
              <li>
                <button onClick={openCookieSettings} className={LINK_HOVER_CLS}>
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
                <a href={`tel:${BUSINESS.phone}`} className={LINK_HOVER_CLS}>{BUSINESS.phoneDisplay}</a>
                {" · "}
                <a href={`mailto:${BUSINESS.email}`} className={LINK_HOVER_CLS}>{BUSINESS.email}</a>
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="gold-rule my-10" />

        {/* Newsletter capture — marketing consent, separate from the
            operational contact consent collected at checkout. */}
        <div className="mx-auto max-w-lg text-center">
          <div className="text-xs tracking-[0.35em] text-accent uppercase mb-3">
            הצטרפו לרשימת התפוצה
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            מדריכים ותוכן לקראת החגים, ופריטים חדשים לפני כולם — בלי ספאם, אפשר להסיר בכל רגע.
          </p>
          <NewsletterSignup />
        </div>
        </div>

        {/* Closing ornament. Same rule as the one above the columns: the ✦ and
            its rules are text-gold at 2.44:1 and are only permissible because
            this wrapper hides them from assistive tech. Keep aria-hidden. */}
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

