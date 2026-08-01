import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, Search, Menu, X, Heart } from "lucide-react";
import { useCart, formatILS, getEffectivePrice } from "@/lib/cart";
import { useFavorites } from "@/components/engagement/favorites";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeTerm } from "@/routes/shop";
import { CATEGORY_COUNT_EMBED, listableCategories } from "@/routes/categories";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ClubBadge } from "@/components/ClubBadge";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { thumbUrl } from "@/lib/img";
import { openCookieSettings } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";
import { trackSearch } from "@/lib/analytics";
import logoUrl from "@/assets/logo.webp";

// Persisted recent search terms (last few submitted, most-recent first). Read
// in an effect so it is SSR-safe; capped so the empty-state chip row stays short.
const RECENT_SEARCHES_KEY = "ozl-recent-search-v1";
const RECENT_SEARCHES_MAX = 5;

type Cat = {
  id: string;
  slug: string;
  name: string;
  // parent_slug + the count embed are fetched only so listableCategories() can
  // do its job (see the query below); neither is rendered.
  parent_slug: string | null;
  products?: { count: number }[] | null;
};

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
// below. TALITOT_SLUG is the same slug the homepage hero CTA links to; keep the
// two in step. (It used to be the percent-encoded Hebrew slug — the 2026-07
// cleanup renamed that row to clean ASCII precisely because the encoded form
// 404s through the router.)
// ---------------------------------------------------------------------------
const TALITOT_SLUG = "talitot";

// The curated category shortcuts, shared by the desktop nav row AND the drawer's
// category section so the two surfaces can never drift. Every slug is a real
// category verified in the DB (see note above). Owner: edit here to retarget a
// shortcut in both places at once.
const CURATED_CATEGORIES: { slug: string; label: string }[] = [
  // marazim-chatanim, NOT "wedding": /category/wedding contains הפרשת חלה sets, a
  // bride's blessing plaque and tallit clips — zero groom boxes. The four active
  // groom sets are all in marazim-chatanim.
  { slug: "marazim-chatanim", label: "מארזים לחתן" },
  { slug: "chatan-kala", label: "חתן וכלה" },
  { slug: "chalaka-set", label: "סטי חלאקה" },
  { slug: TALITOT_SLUG, label: "טליתות" },
];

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
  // Combobox active-option index (aria-activedescendant model): -1 = no
  // selection, focus stays in the input while ArrowUp/Down move this pointer.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  // Search-overlay dialog focus management: capture the trigger to return focus
  // to on close, the panel to trap Tab within, and the input to seed focus into.
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
      // The WHOLE tree is fetched (102 small rows, cached for the session) but
      // only the top level is rendered: with the full supplier catalog loaded
      // there are 56 top-level categories, and listing every subcategory turns
      // the drawer into a 100-item scroll. Subcategories stay reachable from
      // /categories. The children are here purely so listableCategories() can
      // roll a child's stock up to its parent before filtering.
      const { data, error } = await supabase
        .from("categories")
        .select(`id, slug, name, parent_slug, ${CATEGORY_COUNT_EMBED}`)
        .eq("products.is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      // The drawer is the ONLY navigation on a phone, and it was listing every
      // top-level row with just `uncategorized` excluded — 8 of those 55 entries
      // held zero active products and dead-ended on "לא נמצאו מוצרים", three of
      // them above the fold (positions 3, 8, 9) and one labelled with the
      // English word "sale". Four of the eight were outright 404s. The shared
      // predicate replaces the hand-maintained exclusion list.
      return listableCategories((data ?? []) as Cat[]).filter((c) => !c.parent_slug);
    },
  });

  // Restore the visitor's recent search terms once on mount (SSR-safe: no
  // localStorage access on the server).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setRecentTerms(
          arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .slice(0, RECENT_SEARCHES_MAX),
        );
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  // A fresh term (or reopening the panel) clears the combobox selection so the
  // highlight never points at a row from a previous query.
  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced, searchOpen]);

  // Accessible modal dialog focus management for the search overlay, mirroring
  // AccessibilityWidget: seed focus into the panel, trap Tab/Shift+Tab within
  // it, Escape closes, and focus returns to the trigger on close.
  useEffect(() => {
    if (!searchOpen) return;
    const panel = searchPanelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    // el.tabIndex !== -1 is load-bearing: the result options are
    // <a href tabIndex={-1}> (roving tabindex) and the "all results" control is
    // a <button tabIndex={-1}>. The [href]/button clauses still match them, so
    // without this guard `last` becomes a tabindex=-1 element that can never be
    // document.activeElement, forward-Tab never wraps, and focus escapes the
    // modal into the page behind the scrim.
    // Move focus into the search field (autoFocus covers the same target; this
    // makes the intent explicit and survives re-renders).
    searchInputRef.current?.focus();

    // Keyboard-aware height + background scroll lock. autoFocus above always
    // raises the software keyboard on a phone, which shrinks the *visual*
    // viewport while 100dvh keeps reporting the full height — so the panel's cap
    // is driven by visualViewport instead. Effect-only, so SSR never sees these.
    const vv = window.visualViewport;
    const syncVh = () => {
      if (vv) document.documentElement.style.setProperty("--search-vh", `${vv.height}px`);
    };
    syncVh();
    vv?.addEventListener("resize", syncVh);
    // Lock the background, compensating for the scrollbar the lock reclaims —
    // otherwise the whole desktop page jumps sideways ~15px on every open and
    // close. In RTL the classic scrollbar sits on the LEFT, so the padding goes
    // there. The gap is 0 on overlay-scrollbar platforms (phones, macOS), which
    // makes this a no-op exactly where it should be.
    const prevOverflow = document.body.style.overflow;
    const prevPadLeft = document.body.style.paddingLeft;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarGap > 0) document.body.style.paddingLeft = `${scrollbarGap}px`;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      vv?.removeEventListener("resize", syncVh);
      document.documentElement.style.removeProperty("--search-vh");
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingLeft = prevPadLeft;
      // Return focus to the button that opened the dialog.
      searchTriggerRef.current?.focus();
    };
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
      // Suggestions call the SAME RPC /shop uses (list_products_collapsed), so a
      // preview row maps 1:1 to a tile on the results page: one collapsed row per
      // name group with its own count, instead of six near-identical rows and a
      // "(43)" total that opened a single tile. p_category_id is NULL — search is
      // catalog-wide, exactly like /shop. Falls back to the old ILIKE lookup if
      // the function is unavailable.
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("list_products_collapsed", {
        p_term: debounced.trim().slice(0, 100),
        p_category_id: null as unknown as string | undefined,
        p_limit: 6,
        p_offset: 0,
        p_sort: "relevance",
      });
      if (!rpcErr) {
        const rows = (rpcRows ?? []) as Array<SearchSuggestion & { total_count: number }>;
        return { rows: rows as SearchSuggestion[], total: Number(rows[0]?.total_count ?? 0) };
      }
      console.warn("[header] list_products_collapsed RPC unavailable, using ILIKE fallback:", rpcErr);

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

  // Record a submitted term at the front of the recent list (deduped, capped).
  const pushRecentTerm = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setRecentTerms((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, RECENT_SEARCHES_MAX);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/availability errors */
      }
      return next;
    });
  };

  // Navigate to the full /shop results for a term. Used by the form submit, the
  // "all results" button, and the recent-term / empty-state chips. Records the
  // term and reports the search to analytics (count from the live suggestion
  // total when known — the /shop page fires the authoritative count on settle).
  const runSearch = (raw: string, count?: number) => {
    const t = raw.trim();
    if (!t) return;
    pushRecentTerm(t);
    if (typeof count === "number") trackSearch(t, count);
    setSearchOpen(false);
    navigate({ to: "/shop", search: { q: t } as any });
  };

  const goToAllResults = () => runSearch(q, suggestions?.total ?? 0);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToAllResults();
  };

  // Combobox model. A flat, ordered list of the listbox options — category
  // chips, then product rows, then the "all results" action — so ArrowUp/Down
  // can move an aria-activedescendant pointer while focus stays in the input,
  // and Enter runs the highlighted option. Recomputed each render; the input's
  // key handler and the rows both read from it, keeping index ↔ id in step.
  const productRows = suggestions?.rows ?? [];
  const totalSuggestions = suggestions?.total ?? 0;
  const catCount = catSuggestions.length;
  const comboItems: { id: string; run: () => void }[] = [
    ...catSuggestions.map((c) => ({
      id: `sopt-cat-${c.id}`,
      run: () => {
        setSearchOpen(false);
        navigate({ to: "/category/$slug", params: { slug: c.slug } });
      },
    })),
    ...productRows.map((p) => ({
      id: `sopt-prod-${p.id}`,
      run: () => {
        setSearchOpen(false);
        navigate({ to: "/product/$slug", params: { slug: p.slug } });
      },
    })),
    ...(totalSuggestions > 0 ? [{ id: "sopt-all", run: goToAllResults }] : []),
  ];
  const activeOptionId =
    activeIndex >= 0 && activeIndex < comboItems.length ? comboItems[activeIndex].id : undefined;

  const onSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (comboItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % comboItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? comboItems.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      // A highlighted option wins over the plain submit; with none highlighted
      // the form's onSubmit falls through to "all results".
      if (activeIndex >= 0 && activeIndex < comboItems.length) {
        e.preventDefault();
        comboItems[activeIndex].run();
      }
    }
  };

  // Announced by the overlay's aria-live region and used by the zero-results
  // fallback copy/links. Mirrors the visible "לא נמצאו" state exactly.
  const noResults = suggestionsEnabled && suggestionsReady && productRows.length === 0;
  const headerTerm = debounced.trim();

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
                  {/* Occasion/holiday gift hubs are indexed by the "קונים לפי
                      אירוע" section at the top of /categories; this dedicated
                      entry surfaces that shop-by-occasion path in the one nav
                      visible at every breakpoint. */}
                  <Link to="/categories" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>מתנות לפי אירוע</Link>
                  {/* /articles had no entry point anywhere in the shell; the drawer
                      is the one nav that is visible at every breakpoint, so the
                      guides live here as well as in the footer. */}
                  <Link to="/articles" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>מדריכים ומאמרים</Link>
                  <Link to="/about" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>אודות</Link>
                </nav>

                <div className="px-6 pt-4 pb-2">
                  {/* Curated shortcuts — the same picks surfaced in the desktop
                      nav row, mirrored here as quick-access chips (the gold-hairline
                      chip idiom the search suggestions already use). The full
                      category list follows below, unchanged. */}
                  <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">קטגוריות מובחרות</div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {CURATED_CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => setDrawerOpen(false)}
                        className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                  <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">כל הקטגוריות</div>
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
          <button
            ref={searchTriggerRef}
            onClick={() => setSearchOpen(true)}
            className={ICON_BTN_CLS}
            aria-label="חיפוש"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
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
          {/* The count bubbles keep bg-argaman: burgundy survives the white
              redesign exactly here, as a small semantic fill carrying white
              text at 12.57:1. It is a badge now, never a band. */}
          {/* The cart icon now opens the mini-cart drawer (a persistent
              confirmation with a running subtotal and a direct path to
              checkout). The full /cart page stays reachable from inside the
              drawer and from the mobile nav menu above. */}
          {/* The count badge is VISIBLE text inside these two controls, so each
              accessible name has to CONTAIN that number (WCAG 2.5.3 Label in
              Name — a live Lighthouse run flagged the mismatch against the old
              bare "עגלה"/"מועדפים" labels). Folding the count in also makes the
              name genuinely more useful to a screen-reader user. */}
          <button
            type="button"
            onClick={openCart}
            className={`relative ${ICON_BTN_CLS}`}
            aria-label={count === 0 ? "עגלה" : count === 1 ? "עגלה — פריט אחד" : `עגלה — ${count} פריטים`}
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
          <Link
            to="/favorites"
            className={`relative ${ICON_BTN_CLS}`}
            aria-label={favCount === 0 ? "מועדפים" : favCount === 1 ? "מועדפים — פריט אחד" : `מועדפים — ${favCount} פריטים`}
          >
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
        {CURATED_CATEGORIES.map((c) => (
          <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className={NAV_LINK_CLS}>
            {c.label}
          </Link>
        ))}
        <Link to="/categories" className={NAV_LINK_CLS}>כל הקטגוריות</Link>
        {/* Secondary group — a discovery entry plus the informational
            destinations that only lived in the drawer/footer before. A hairline
            divider sets them off from the curated shopping links so the row
            reads as two clusters. "מתנות לפי אירוע" points at /categories, whose
            top section ("קונים לפי אירוע") indexes every occasion/holiday hub
            (/collection/<slug>) — the discovery path into those rankable pages,
            surfaced here without adding another item to the shopping cluster. */}
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <Link to="/categories" className={NAV_LINK_CLS}>מתנות לפי אירוע</Link>
        <Link to="/articles" className={NAV_LINK_CLS}>מדריכים</Link>
        <Link to="/about" className={NAV_LINK_CLS}>אודות</Link>
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
            ref={searchPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש באתר"
            // Bounded height + an inner scroller. The panel used to be
            // content-sized inside a `fixed inset-0` parent that cannot scroll,
            // so on a phone — where autoFocus always raises the keyboard — the
            // last suggestions and the "כל התוצאות" CTA sat below the fold with
            // no way to reach them. --search-vh is set from visualViewport while
            // the overlay is open (see the effect above); the 100dvh fallback
            // keeps this correct even if that never runs. Desktop is unchanged:
            // the panel is far shorter than the viewport, so the cap never binds.
            className="mx-auto flex max-h-[calc(var(--search-vh,100dvh)-3rem)] max-w-2xl flex-col overflow-hidden glass-strong md:max-h-[calc(var(--search-vh,100dvh)-5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visually-hidden live region — announces the result count (or the
                no-match message) to assistive tech as the suggestions settle. */}
            <div className="sr-only" role="status" aria-live="polite">
              {suggestionsEnabled && suggestionsReady
                ? noResults
                  ? "לא נמצאו מוצרים מתאימים"
                  : `נמצאו ${totalSuggestions} תוצאות`
                : ""}
            </div>

            {/* shrink-0 so the field stays pinned while the results scroll. */}
            <form onSubmit={submitSearch} className="flex shrink-0 items-center gap-3 px-4 py-4">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="site-search" className="sr-only">חיפוש מוצרים וקטגוריות</label>
              <input
                id="site-search"
                ref={searchInputRef}
                autoFocus
                type="search"
                inputMode="search"
                enterKeyHint="search"
                role="combobox"
                aria-expanded={suggestionsEnabled}
                aria-controls={suggestionsEnabled ? "search-listbox" : undefined}
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchInputKeyDown}
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

            {/* Live suggestions (listbox) once the term is long enough; otherwise
                the pre-typing state (recent terms + curated categories). The gold
                hairline between the field and the panel is decorative, never text.
                Both branches share one scroller — min-h-0 so it can actually
                shrink inside the flex column, overscroll-contain so momentum
                doesn't chain into the page behind the scrim. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {suggestionsEnabled ? (
              <div className="border-t border-gold/25">
                <div id="search-listbox" role="listbox" aria-label="הצעות חיפוש">
                  {catSuggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border/40">
                      <span className="text-xs text-muted-foreground">קטגוריות</span>
                      {catSuggestions.map((c, ci) => {
                        const active = activeIndex === ci;
                        return (
                          <Link
                            key={c.id}
                            id={`sopt-cat-${c.id}`}
                            role="option"
                            aria-selected={active}
                            tabIndex={-1}
                            to="/category/$slug"
                            params={{ slug: c.slug }}
                            onClick={() => setSearchOpen(false)}
                            className={`rounded-full border px-3 py-1 text-xs press ${active ? "border-accent text-accent" : "border-gold/40"} [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`}
                          >
                            {c.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {productRows.map((p, pi) => {
                    const effective = getEffectivePrice(p.price);
                    const active = activeIndex === catCount + pi;
                    return (
                      <Link
                        key={p.id}
                        id={`sopt-prod-${p.id}`}
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        to="/product/$slug"
                        params={{ slug: p.slug }}
                        onClick={() => setSearchOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-[background-color] duration-150 ease-out ${active ? "bg-muted" : ""} [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted`}
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
                  {noResults && (
                    <div className="px-4 py-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        לא נמצאו מוצרים מתאימים{headerTerm ? ` עבור "${headerTerm}"` : ""}.
                      </p>
                      {/* Zero results is a dead end without an exit — offer the
                          full catalog and a direct line to the store. */}
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/shop"
                          onClick={() => setSearchOpen(false)}
                          className="rounded-full border border-accent px-4 py-1.5 text-xs font-medium text-accent press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground"
                        >
                          עיון בכל המוצרים
                        </Link>
                        <a
                          href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
                            headerTerm
                              ? `שלום, חיפשתי "${headerTerm}" באתר ולא מצאתי מוצר מתאים. אשמח לעזרה.`
                              : "שלום, אשמח לעזרה במציאת מוצר באתר.",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-gold/40 px-4 py-1.5 text-xs press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                        >
                          שליחת הודעה בוואטסאפ
                        </a>
                      </div>
                    </div>
                  )}
                  {totalSuggestions > 0 && (
                    <div className="px-4 py-3">
                      <button
                        type="button"
                        id="sopt-all"
                        role="option"
                        aria-selected={activeOptionId === "sopt-all"}
                        tabIndex={-1}
                        onClick={goToAllResults}
                        className={`w-full rounded-full border border-accent px-6 py-2 text-sm font-medium text-accent press ${activeOptionId === "sopt-all" ? "bg-accent text-accent-foreground" : ""} [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground`}
                      >
                        כל התוצאות ({totalSuggestions})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Pre-typing state: the visitor's recent terms (persisted) plus the
              // curated category chips, so an empty field is still a launch pad.
              <div className="border-t border-gold/25 px-4 py-4 space-y-4">
                {recentTerms.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">חיפושים אחרונים</div>
                    <div className="flex flex-wrap gap-2">
                      {recentTerms.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => runSearch(t)}
                          className="rounded-full border border-gold/40 px-3 py-1 text-xs press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">קטגוריות מובחרות</div>
                  <div className="flex flex-wrap gap-2">
                    {CURATED_CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => setSearchOpen(false)}
                        className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </div>
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
            חנות תשמישי קדושה — כלי כסף, כוסות קידוש, חנוכיות, נרתיקי מזוזה, טליתות ועוד, באיכות ובהידור.
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
              {/* Shipping/returns lead the column: they are what a first-time
                  buyer looks for, and each is a short summary of the matching
                  clause in the terms below. */}
              <li><Link to="/shipping" className={LINK_HOVER_CLS}>משלוחים ואספקה</Link></li>
              <li><Link to="/returns" className={LINK_HOVER_CLS}>ביטול והחזרות</Link></li>
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

