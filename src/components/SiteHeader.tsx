import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, Search, Menu, X, Heart, ChevronDown } from "lucide-react";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
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
import { BUSINESS, SOCIAL_PROFILES } from "@/lib/business";
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
// The six doors in the header.
//
// WHAT WAS HERE BEFORE, AND WHY IT WENT
//
// The four curated shortcuts were marazim-chatanim / chatan-kala / chalaka-set
// / talitot. Measured on the live anon REST 2026-08-09 (count=exact, active
// products only): 11 / 45 / 40 / 55 products — 151 rows, 3.2% of the 4,648-item
// catalogue, and the two most expensive shelves in the shop (marazim-chatanim
// runs ₪1,150-1,800 effective, talitot ₪235-1,100). Every page of this site
// carried a nav whose shopping links pointed almost exclusively at things a
// stranger cannot afford to risk on a shop they have never bought from.
//
// The six below are the six deepest shelves the catalogue actually has —
// verified the same day, same query, and every one of them has ZERO rows with a
// null thumbnail:
//
//   כיפות              kipot                    743
//   חגים               chagim                   523
//   טלית ותפילין        talit-tefilin            465
//   נרתיקי מזוזה        plastic                  383
//   שבת                shabbat                  357
//   ברכות וחמסות        brachot-chamsot-segulot  301
//
// (The plan this implements said 525 / 359 for chagim / shabbat; the live counts
// are 523 / 357 and those are the numbers printed. Re-check with:
//   /rest/v1/categories?select=slug,name,products(count)
//     &slug=in.(kipot,chagim,talit-tefilin,plastic,shabbat,brachot-chamsot-segulot)
//     &products.is_active=eq.true )
//
// The two sets share ZERO products, so this is not a reshuffle — it is 2,772
// products of newly-reachable shelf against 151.
//
// COUNTS ARE HARDCODED, DELIBERATELY. The header's own categories query does
// carry live counts (CATEGORY_COUNT_EMBED, below), but SiteHeader is a
// component and not a route: that query is client-only, so a live number would
// pop in after hydration and reflow the nav on every page of the site. A static
// label is in the server HTML. It is a NAV LABEL, not a promise — re-run the
// query above after a supplier import and edit the six numbers.
//
// WHAT THE NUMBER MEANS: products, not tiles. /category/<slug> collapses
// same-name models into one card (collapseSameName), so kipot's 743 products
// render as ~671 cards, each carrying its own model_count. Nothing is hidden
// and nothing is inflated; the count is the shelf's depth.
//
// marazim-chatanim KEEPS ITS PAGE AND LOSES THE HEADER. The old comment here
// recorded why it was chosen over /category/wedding — "/category/wedding
// contains הפרשת חלה sets, a bride's blessing plaque and tallit clips, zero
// groom boxes; the groom sets are all in marazim-chatanim" — and that reasoning
// is still correct FOR THAT PAGE, which is why the page stays and the flagship
// band on the homepage still sells it. What changed is that it may not be a
// DOOR: 7 of its 11 active products have a null thumbnail (measured 2026-08-09,
// same 7 as the last audit), so a stranger arriving from the site chrome meets
// a grid that is majority placeholder. That is a blocking owner input — photos —
// not something markup can fix. Re-add it here when the 7 rows have images.
//
// The label for brachot-chamsot-segulot is shortened from the DB name
// "ברכות חמסות וסגולות"; the category page carries the full name in its own h1.
const CURATED_CATEGORIES: { slug: string; label: string; count: number }[] = [
  { slug: "kipot", label: "כיפות", count: 743 },
  { slug: "chagim", label: "חגים", count: 523 },
  { slug: "talit-tefilin", label: "טלית ותפילין", count: 465 },
  { slug: "plastic", label: "נרתיקי מזוזה", count: 383 },
  { slug: "shabbat", label: "שבת", count: 357 },
  { slug: "brachot-chamsot-segulot", label: "ברכות וחמסות", count: 301 },
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

// The depth number beside a curated shortcut. Muted and a step down in size so
// it reads as metadata ON the label rather than as a second word. It lives
// INSIDE the <Link>, which means it is part of the accessible name ("כיפות
// 743") — the only way the number means anything to a screen-reader user.
// tabular-nums keeps the six of them optically aligned in the drawer's column.
const NAV_COUNT_CLS = "ms-1.5 text-[11px] text-muted-foreground tabular-nums";

/**
 * "מתנות לפי אירוע" — the seven occasion hubs, as seven real links.
 *
 * This nav item used to point at /categories, whose top section indexes the
 * hubs. That made every occasion two clicks away and, more expensively, meant
 * the site chrome emitted ZERO /collection/ anchors: the seven hub pages are
 * the shop's only rankable gift-guide surfaces and the most-linked element on
 * the site pointed at none of them, passing every drop of that authority to
 * /categories instead.
 *
 * A native <details> and not a JS menu, for the reason the guide FAQ is one
 * (see articles/$slug.tsx): a closed <details> keeps its content in the DOM, so
 * all seven anchors are in the server HTML on every page — while the mobile
 * drawer's copy of this list is inside a Radix Sheet, which portals and
 * UNMOUNTS when closed and is therefore invisible to a crawler. No JS, no
 * hydration cost, keyboard-operable out of the box.
 *
 * Rendered only in the lg nav row; the drawer has its own always-open list.
 */
function OccasionMenu() {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-foreground transition-[color] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent [&::-webkit-details-marker]:hidden">
        מתנות לפי אירוע
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-180"
        />
      </summary>
      {/* .glass-strong because this panel floats over whatever the page is
          scrolled to. It must restate --glass-shadow-lift: the header bar above
          sets that variable to a zero-alpha shadow at rest and custom
          properties inherit, so without this the panel would have no lift at
          all until the page scrolled. */}
      <div className="glass-strong absolute start-0 top-full z-50 mt-2 w-72 p-2 [--glass-radius:1rem] [--glass-shadow-lift:var(--shadow-soft)]">
        <ul className="flex flex-col">
          {OCCASION_COLLECTIONS.map((c) => (
            <li key={c.slug}>
              {/* /collection/$slug — `to`/`params` cast exactly as
                  categories.tsx and the homepage rail do, so the link does not
                  depend on the router's literal path union being regenerated
                  before type-check. */}
              <Link
                to="/collection/$slug"
                params={{ slug: c.slug }}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm text-foreground transition-[color,background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

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
                  {/* /articles had no entry point anywhere in the shell; the drawer
                      is the one nav that is visible at every breakpoint, so the
                      guides live here as well as in the footer. */}
                  <Link to="/articles" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>מדריכים ומאמרים</Link>
                  <Link to="/about" onClick={() => setDrawerOpen(false)} className={`py-3 border-b border-border/40 ${LINK_HOVER_CLS}`}>אודות</Link>
                </nav>

                <div className="px-6 pt-4 pb-2">
                  {/* Curated shortcuts — the same six deepest shelves surfaced
                      in the desktop nav row, mirrored here as quick-access chips
                      (the gold-hairline chip idiom the search suggestions already
                      use), each carrying the same depth number. min-h-[44px]
                      clears the touch floor: this drawer is the ONLY navigation
                      on a phone. The full category list follows below. */}
                  <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">קטגוריות מובחרות</div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {CURATED_CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => setDrawerOpen(false)}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-3.5 text-xs text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                      >
                        {c.label}
                        <span className={NAV_COUNT_CLS}>{c.count}</span>
                      </Link>
                    ))}
                  </div>
                  {/* מתנות לפי אירוע — the seven occasion hubs as seven real
                      links, replacing the single "מתנות לפי אירוע" row that
                      pointed at /categories and made every occasion a two-click
                      journey. This is the desktop OccasionMenu's counterpart:
                      the Sheet unmounts when closed, so these anchors are for
                      the shopper, and the crawlable copy is the one in the nav
                      row. Same chip idiom, same 44px floor. */}
                  <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">מתנות לפי אירוע</div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {OCCASION_COLLECTIONS.map((c) => (
                      <Link
                        key={c.slug}
                        to="/collection/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => setDrawerOpen(false)}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-3.5 text-xs text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                      >
                        {c.title}
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

      {/* Desktop nav row — the six deepest shelves with their depth (the full
          102-category drawer stays behind the hamburger). Owner: swap items by
          editing CURATED_CATEGORIES above; every slug is a real category
          verified against the live REST API on the date recorded there.
          h-11 became min-h-11 + flex-wrap: six labels carrying counts plus the
          five chrome links exceed the lg container on one line, and a row that
          wraps to two at 1024px and back to one at xl is a better trade than
          dropping a door. Gap tightens to 5 at lg for the same reason. */}
      <nav
        aria-label="ניווט ראשי"
        className="hidden min-h-11 flex-wrap items-center justify-center gap-x-5 gap-y-1 py-1.5 text-[15px] lg:flex xl:gap-x-7"
      >
        <Link to="/shop" className={NAV_LINK_CLS}>חנות</Link>
        {CURATED_CATEGORIES.map((c) => (
          <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className={NAV_LINK_CLS}>
            {c.label}
            <span className={NAV_COUNT_CLS}>{c.count}</span>
          </Link>
        ))}
        <Link to="/categories" className={NAV_LINK_CLS}>כל הקטגוריות</Link>
        {/* Secondary group — a discovery entry plus the informational
            destinations that only lived in the drawer/footer before. A hairline
            divider sets them off from the curated shopping links so the row
            reads as two clusters. "מתנות לפי אירוע" now opens the seven
            /collection/ hubs directly instead of bouncing through /categories —
            see OccasionMenu for why that matters and why it is a <details>. */}
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <OccasionMenu />
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
                        className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-3.5 text-xs text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                      >
                        {c.label}
                        <span className={NAV_COUNT_CLS}>{c.count}</span>
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
            {/* The brand's own profiles, linked visibly for the first time.
                Until now the Organization node declared four of them in `sameAs`
                while the site linked to exactly ONE (Instagram, from the
                homepage strip) — so Facebook and TikTok were asserted as
                official identities and corroborated by nothing. sameAs is an
                identity claim, and a crawler weighs it far more heavily when the
                site visibly links out and the profile links back.
                It matters more here than on a typical shop: on the brand-store
                query these profiles rank ABOVE the store, so binding them to the
                entity is what converts them from rivals for the brand name into
                evidence for it.
                Same list as sameAs, from business.ts, so the two cannot drift.
                rel="me" is the microformats convention for "another profile of
                the same entity" and is the machine-readable half of the claim;
                noopener is standard for target=_blank. */}
            <nav className="mt-4" aria-label="הפרופילים שלנו ברשתות החברתיות">
              <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground md:justify-start">
                {SOCIAL_PROFILES.map((p, i) => (
                  <li key={p.url} className="flex items-center gap-3">
                    {i > 0 && <span aria-hidden="true" className="text-glass-line">·</span>}
                    <a
                      href={p.url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className={LINK_HOVER_CLS}
                    >
                      {p.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
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

