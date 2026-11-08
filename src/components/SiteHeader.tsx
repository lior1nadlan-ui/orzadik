import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { SITE_MUSIC, musicCredit } from "@/lib/site-music";
import {
  ShoppingBag,
  User as UserIcon,
  Search,
  Menu,
  X,
  Heart,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
import type { NavDepartment } from "@/lib/nav-taxonomy";
import { useNavDepartments } from "@/hooks/use-nav-departments";
import { useCart, formatILS } from "@/lib/cart";
import { priceView, promoFor } from "@/lib/promotions";
import { usePromoIndex, usePromoHeadline } from "@/lib/promotions-data";
import { useFavorites } from "@/components/engagement/favorites";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useMemo, useRef, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearchTerm, sanitizeTerm } from "@/routes/shop";
import { resolveSearchQuery } from "@/lib/search-redirects";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ClubBadge } from "@/components/ClubBadge";
import { PromoStrip } from "@/components/PromoStrip";
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

type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
};

// The category menu (desktop dropdowns, phone accordion, search shortcuts) is
// one hand-curated map in src/lib/nav-taxonomy.ts, where each category appears
// exactly once. See that file for why the menus stopped mirroring the
// categories table, and for what was left out on purpose.

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
// Footer list links, measured at 18px tall on a 390px phone with a 15px gap —
// the smallest touch targets on the site, and there are seventeen of them.
// They clear WCAG 2.2 SC 2.5.8 (AA) on the 24px spacing exception, so this is a
// usability fix rather than a conformance one, and it is bought for free:
// `py-1.5 -my-1.5` grows the hit area by 6px above and below while the negative
// margin cancels the same 6px from the layout box, so every target goes 18px →
// 30px. `inline-block` is what makes the padding count at all — vertical
// padding on an inline element paints but does not enlarge the hit box.
//
// The list spacing moved with it, 2.5 → 4, and that pairing is not optional.
// The rows sat 10px apart; growing each target 6px in both directions closed
// that to -2px, and a re-measure caught ELEVEN adjacent pairs whose hit areas
// now overlapped — a tap on the seam would land on the neighbouring link, which
// is a worse bug than the small target it replaced. 16px of spacing restores a
// 4px gap. The footer is ~40px taller as a result; that is the honest price of
// targets you can actually hit, and it is paid once, below the fold.
//
// NOT applied to LINK_HOVER_CLS itself: that class is also used inline inside
// running sentences (TrustBadges, the policy notes), where a block box would
// break the line.
const FOOT_LINK_CLS = `inline-block py-1.5 -my-1.5 transition-[color] duration-200 ease-out
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`;

const LINK_HOVER_CLS = `transition-[color] duration-200 ease-out
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`;

// Icon buttons in the bar. These are the highest-frequency controls on the site,
// so per the frequency rule they get press feedback and an INSTANT colour swap —
// `.press` owns transition-property here (it is emitted after Tailwind's own
// utilities), so pairing it with a colour transition would be a lie.
// 44x44, not 40x40. These five controls (menu, search, cart, favourites,
// account) are the only navigation a phone gets, they sit on every page, and
// they were measured at 40x40 in a headless browser. That clears WCAG 2.2
// SC 2.5.8 (24px, AA) comfortably but sits under the 44px floor that both
// Apple's HIG and Material set for a primary touch control — and under
// SC 2.5.5 (AAA). The glyph inside stays h-5 w-5; only the hit area grew, so
// nothing about the bar's density changes visually.
const ICON_BTN_CLS = `inline-flex h-11 w-11 items-center justify-center rounded-full
  text-foreground press
  [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`;

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
      <div className="glass-strong absolute end-0 top-full z-50 mt-2 w-72 p-5 [--glass-bg-strong:#FFFDFA] [--glass-radius:1rem] [--glass-shadow-lift:var(--shadow-soft)]">
        <span className="font-display text-lg text-foreground">מתנות לפי אירוע</span>
        <div aria-hidden="true" className="gold-rule my-3" />
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
                className="flex min-h-10 items-center rounded-lg px-2 text-[15px] text-foreground transition-[color,background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
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

/**
 * One department of the category map in the desktop nav row: a native
 * <details> dropdown, like OccasionMenu and for the same reasons (every anchor
 * is in the server HTML, it opens without JS, it is keyboard-operable).
 * useNavDisclosures() adds what <details> lacks.
 *
 * The panel hangs from a `pt-2` wrapper rather than an `mt-2` offset, so there
 * is no dead gap between the trigger and the panel. `align="end"` anchors it to
 * the trigger's far edge for the departments near the row's left end, so a wide
 * panel never runs off the screen. More than five shelves go in two columns.
 */
function DepartmentMenu({ dept, align }: { dept: NavDepartment; align: "start" | "end" }) {
  const twoCols = dept.children.length > 5;
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-foreground transition-[color] duration-200 ease-out group-open:text-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent [&::-webkit-details-marker]:hidden">
        {dept.label}
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-180"
        />
      </summary>
      <div className={`absolute top-full z-50 pt-2 ${align === "end" ? "end-0" : "start-0"}`}>
        {/* Opaque on purpose: the header bar has its own backdrop-filter, so a
            nested panel's blur cannot reach the page and the 94% glass let the
            hero heading show through. */}
        <div
          className={`glass-strong p-5 [--glass-bg-strong:#FFFDFA] [--glass-radius:1rem] [--glass-shadow-lift:var(--shadow-soft)] ${twoCols ? "w-[34rem]" : "w-72"}`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display text-lg text-foreground">{dept.label}</span>
            {dept.slug ? (
              <Link
                to="/category/$slug"
                params={{ slug: dept.slug }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                {dept.allLabel}
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div aria-hidden="true" className="gold-rule my-3" />
          {/* columns-2, not a grid: the list reads DOWN each column. */}
          <ul className={twoCols ? "columns-2 gap-x-8" : "flex flex-col"}>
            {dept.children.map((c) => (
              <li key={c.slug} className="break-inside-avoid">
                <Link
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="flex min-h-10 items-center rounded-lg px-2 text-[15px] text-foreground transition-[color,background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

/**
 * What native <details> menus lack, for the desktop nav row: opening one closes
 * the others; a click outside, Escape (focus returns to the trigger), a click on
 * a link inside, or a route change closes whatever is open. The route change
 * matters because the header persists between pages, so without it a panel
 * would stay open over the next page.
 */
function useNavDisclosures(ref: RefObject<HTMLElement | null>) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    ref.current
      ?.querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((d) => (d.open = false));
  }, [pathname, ref]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const closeAll = (except?: Element) =>
      root.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => {
        if (d !== except) d.open = false;
      });
    // `toggle` does not bubble, so it is caught on the way down.
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (d.open) closeAll(d);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) closeAll();
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("details a")) closeAll();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const open = root.querySelector<HTMLDetailsElement>("details[open]");
      if (!open) return;
      open.open = false;
      open.querySelector<HTMLElement>("summary")?.focus();
    };
    root.addEventListener("toggle", onToggle, true);
    root.addEventListener("click", onClick);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("toggle", onToggle, true);
      root.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref]);
}

export function SiteHeader({ hideOnMobile = false }: { hideOnMobile?: boolean } = {}) {
  // Search results quote the same promotional price the product page charges.
  const promoIndex = usePromoIndex();
  const { count, openCart, isCartOpen } = useCart();
  // SSR renders favCount 0 (the hook returns [] on the server), so there is
  // no hydration mismatch — the badge appears after mount, like the cart badge.
  const { count: favCount } = useFavorites();
  const { user, isAdmin, signOut } = useAuth();
  // A live CRM promotion takes the club strip's place (same slot, same height).
  const promoLive = usePromoHeadline() !== null;
  // Whether a 36px strip sits above the bar at all: the club strip hides itself
  // for a signed-in shopper (ClubBadge), and the promotion strip shows to
  // everyone. The header's sticky offset must follow it — see below.
  const stripShown = promoLive || !user;
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
  // Set when the drawer's search button closes the drawer to open search, so
  // the Sheet does not hand focus back to the menu button over the field.
  const openSearchFromDrawer = useRef(false);
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

  // The category map (nav-taxonomy.ts) minus any shelf that has emptied out;
  // the homepage squares read the same hook, so the two always agree.
  const departments = useNavDepartments();
  // Every entry of the map as a flat list, for the search suggestions.
  const menuCategories = useMemo(
    () =>
      departments.flatMap((d) => [
        ...(d.slug ? [{ id: d.slug, slug: d.slug, name: d.label }] : []),
        ...d.children.map((c) => ({ id: c.slug, slug: c.slug, name: c.label })),
      ]),
    [departments],
  );
  const navRef = useRef<HTMLElement>(null);
  useNavDisclosures(navRef);

  // Restore the visitor's recent search terms once on mount (SSR-safe: no
  // localStorage access on the server).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setRecentTerms(
          arr
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
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
      //
      // The term goes through the same two steps as /shop (the owner's
      // redirects, then the spelling fixes), or the preview would say "nothing
      // found" for מצוה / a redirected phrase while the results page lists them.
      const effective = normalizeSearchTerm(await resolveSearchQuery(debounced));
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("list_products_collapsed", {
        p_term: effective.slice(0, 100),
        p_category_id: null as unknown as string | undefined,
        p_limit: 6,
        p_offset: 0,
        p_sort: "relevance",
      });
      if (!rpcErr) {
        const rows = (rpcRows ?? []) as Array<SearchSuggestion & { total_count: number }>;
        return { rows: rows as SearchSuggestion[], total: Number(rows[0]?.total_count ?? 0) };
      }
      console.warn(
        "[header] list_products_collapsed RPC unavailable, using ILIKE fallback:",
        rpcErr,
      );

      const like = `%${sanitizeTerm(effective)}%`;
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

  // Category suggestions come from the same menu map, so search never offers a
  // duplicate shelf or one the menu leaves out. No extra fetch.
  const catSuggestions = suggestionsEnabled
    ? menuCategories.filter((c) => c.name.includes(term)).slice(0, 2)
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
      {/* Sticky lives on the <header> itself with -top-9 (the strip is h-9):
      the strip scrolls off while the glass bar below pins to the viewport top.
      With no strip (a signed-in shopper, no promotion) the offset is 0 — a
      fixed -top-9 there pushed the top 36px of the logo bar off screen once the
      page scrolled, which on a phone is most of the bar: logo, cart, search.
      z-40 matches the old layout wrapper so overlay layering is unchanged. */}
      <header
        className={`sticky ${stripShown ? "-top-9" : "top-0"} z-40 w-full ${hideOnMobile ? "max-lg:hidden" : ""}`}
      >
        {promoLive ? <PromoStrip /> : <ClubBadge variant="strip" />}
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
          {/* h-16, down from h-20. Measured on the live site 2026-08-09 at 1440x900:
          the header was 161px and sticky — 17.9% of the viewport following the
          shopper down every page — made of a 36px club strip, an 80px logo bar
          and a 44px nav row. The nav row is already at the 44px touch floor and
          the strip scrolls away under `sticky -top-9`, so the logo bar was the
          only band with slack in it: 80px of chrome around a 64px image.
          64px around a 48px logo keeps the same 8px of breathing room and takes
          16px off every route. */}
          {/* WIDE SCREENS: measured at 1920 on the owner's own monitor.
          The bar is `justify-between` inside a 1536px container, so the logo
          pinned to one edge and the icon cluster to the other left ~1160px of
          nothing between them — nine tenths of the bar was empty. Worse, the
          nav row underneath was NOT in this container at all: it centred on the
          full 1920 viewport while the bar centred on 1536, so neither end of
          the two rows lined up with the other and the whole header read as
          sloppy rather than airy.

          Both are one fix: the nav moves INSIDE this container, and the
          container wraps. Below 2xl the nav takes `w-full` and drops to its own
          line exactly as before — but now bounded by the same edges as the
          logo. At 2xl it un-wraps into the row and fills the void as the
          middle column, which also takes the 44px nav row off every route.

          MOBILE: the container used to wrap at every width with a gap-x-6
          between the logo and the icon cluster. At 390px the logo (~129px at
          h-11) plus five 44px buttons plus the gap and padding overflow the
          row, so the icons wrapped onto a second line and the bar rendered as
          a lone logo above a stranded icon row. The nav row only exists from
          lg up, so wrapping below lg has nothing to wrap: the container is
          flex-nowrap until lg, the gap and side padding tighten below sm, and
          the logo (h-9) and buttons (40px) step down on the smallest screens
          so the whole cluster fits one row from 360px up.

          The nav used to join this row at 2xl. Since the department menu
          (8.11.2026) it is wider than the space beside the logo and the icons
          even at 1536px, and wrapping INSIDE the bar would make a two-line bar,
          which is worse than two clean rows. So it always takes its own row. */}
          <div className="container mx-auto flex min-h-14 flex-nowrap items-center lg:flex-wrap justify-between gap-x-2 px-3 sm:gap-x-4 sm:px-4 2xl:gap-x-6">
            {/* RTL start (RIGHT): the logo.
            Moved out of the centre at the owner's request. The three-column
            grid existed only to hold it there; with the mark on the leading
            edge the row is a plain two-part flex, which is also why every icon
            now sits together on the left instead of straddling the wordmark.

            h-11 at BOTH breakpoints, down from h-11/h-12. The lockup is three
            stacked parts — wordmark, tagline "תשמישי קדושה בעיצוב אישי",
            ornament rule — and 44px is the floor at which the tagline still
            reads: 40px loses it. So the bar tightened to h-14 and the logo did
            NOT shrink with it; going further needs a wordmark-only asset, which
            is a brand decision, not a CSS one. */}
            <Link to="/" className="flex shrink-0 items-center" aria-label="אור זרוע לצדיק">
              <img
                src={logoUrl}
                alt="אור זרוע לצדיק"
                width={586}
                height={200}
                className="h-11 w-auto object-contain"
              />
            </Link>

            {/* RTL end (LEFT): every control, in one cluster. The nav row below
            is `order-last w-full`, so it always wraps to a row of its own and
            this cluster stays at the left edge of the bar. */}
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <div className="flex items-center gap-1">
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger asChild>
                    <button className={`${ICON_BTN_CLS} lg:hidden`} aria-label="תפריט">
                      <Menu className="h-5 w-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-[320px] sm:w-[380px] p-0 overflow-y-auto"
                    onCloseAutoFocus={(e) => {
                      // Opening search from the drawer: do not pull focus back
                      // to the menu button over the search field.
                      if (openSearchFromDrawer.current) {
                        e.preventDefault();
                        openSearchFromDrawer.current = false;
                      }
                    }}
                  >
                    <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
                    <div className="flex flex-col h-full">
                      {/* The drawer opens on the brand and a search field, not on
                      the word "תפריט" and a "בית" row (UI review, 8.11.2026). The
                      logo is the way home. ps-14 keeps it clear of the Sheet's
                      close button, which is pinned to the physical right, where
                      an RTL header starts. */}
                      <div className="ps-14 pe-6 py-4 border-b border-border/60">
                        <Link
                          to="/"
                          onClick={() => setDrawerOpen(false)}
                          aria-label="אור זרוע לצדיק, לדף הבית"
                          className="inline-flex"
                        >
                          <img
                            src={logoUrl}
                            alt=""
                            width={586}
                            height={200}
                            className="h-10 w-auto object-contain"
                          />
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          openSearchFromDrawer.current = true;
                          setDrawerOpen(false);
                          setSearchOpen(true);
                        }}
                        className="mx-6 mt-4 flex h-12 items-center gap-3 rounded-full border border-input/60 bg-card px-4 text-[15px] text-muted-foreground transition-[border-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent"
                      >
                        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                        חיפוש מוצרים…
                      </button>

                      {/* The category map (src/lib/nav-taxonomy.ts) as an
                      accordion: nine departments, each category exactly once,
                      then the occasion hubs as a tenth row. name="drawer-dept"
                      makes the details elements exclusive, so one group is open
                      at a time and an open group reads as a block (tinted). */}
                      <nav aria-label="ניווט בתפריט" className="px-6 pt-3">
                        <Link
                          to="/shop"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex min-h-[52px] items-center justify-between border-b border-border/40 font-display text-[17px] text-foreground ${LINK_HOVER_CLS}`}
                        >
                          כל המוצרים
                          <ChevronLeft
                            aria-hidden="true"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </Link>
                        {departments.map((d) => (
                          <details
                            key={d.label}
                            name="drawer-dept"
                            className="group border-b border-border/40"
                          >
                            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between font-display text-[17px] text-foreground group-open:text-accent [&::-webkit-details-marker]:hidden">
                              {d.label}
                              <ChevronDown
                                aria-hidden="true"
                                className="h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-180"
                              />
                            </summary>
                            <ul className="mb-3 flex flex-col rounded-xl bg-secondary/70 py-1 ps-4 pe-3">
                              {d.slug ? (
                                <li>
                                  <Link
                                    to="/category/$slug"
                                    params={{ slug: d.slug }}
                                    onClick={() => setDrawerOpen(false)}
                                    className="flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-accent"
                                  >
                                    {d.allLabel}
                                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                                  </Link>
                                </li>
                              ) : null}
                              {d.children.map((c) => (
                                <li key={c.slug}>
                                  <Link
                                    to="/category/$slug"
                                    params={{ slug: c.slug }}
                                    onClick={() => setDrawerOpen(false)}
                                    className={`flex min-h-[44px] items-center text-[15px] text-foreground/90 ${LINK_HOVER_CLS}`}
                                  >
                                    {c.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ))}
                        {/* מתנות לפי אירוע: the seven occasion hubs, mirroring the
                        desktop OccasionMenu (which is the crawlable copy; this
                        Sheet unmounts when closed). */}
                        <details name="drawer-dept" className="group border-b border-border/40">
                          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between font-display text-[17px] text-foreground group-open:text-accent [&::-webkit-details-marker]:hidden">
                            מתנות לפי אירוע
                            <ChevronDown
                              aria-hidden="true"
                              className="h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-180"
                            />
                          </summary>
                          <ul className="mb-3 flex flex-col rounded-xl bg-secondary/70 py-1 ps-4 pe-3">
                            {OCCASION_COLLECTIONS.map((c) => (
                              <li key={c.slug}>
                                <Link
                                  to="/collection/$slug"
                                  params={{ slug: c.slug }}
                                  onClick={() => setDrawerOpen(false)}
                                  className={`flex min-h-[44px] items-center text-[15px] text-foreground/90 ${LINK_HOVER_CLS}`}
                                >
                                  {c.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                        <Link
                          to="/categories"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex min-h-[52px] items-center justify-between font-display text-[17px] text-foreground ${LINK_HOVER_CLS}`}
                        >
                          כל הקטגוריות
                          <ChevronLeft
                            aria-hidden="true"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </Link>
                      </nav>

                      <div className="px-6 pt-6 pb-4">
                        <div className="mb-1 text-[11px] font-medium tracking-[0.12em] [word-spacing:0.25em] text-muted-foreground">
                          מידע
                        </div>
                        <div className="flex flex-col">
                          <Link
                            to="/articles"
                            onClick={() => setDrawerOpen(false)}
                            className={`flex min-h-[44px] items-center text-[15px] text-foreground/85 border-b border-border/30 ${LINK_HOVER_CLS}`}
                          >
                            מדריכים ומאמרים
                          </Link>
                          <Link
                            to="/about"
                            onClick={() => setDrawerOpen(false)}
                            className={`flex min-h-[44px] items-center text-[15px] text-foreground/85 border-b border-border/30 ${LINK_HOVER_CLS}`}
                          >
                            אודות
                          </Link>
                          <Link
                            to="/contact"
                            onClick={() => setDrawerOpen(false)}
                            className={`flex min-h-[44px] items-center text-[15px] text-foreground/85 ${LINK_HOVER_CLS}`}
                          >
                            צור קשר
                          </Link>
                        </div>
                      </div>

                      {/* Decorative wash well. .glass-soft is normally text-forbidden
                    because its backdrop is unknowable — here it is not: the
                    Sheet panel above it is an opaque bg-background (#F7F8FA),
                    so the 50% white composites to a known #FBFCFD and
                    --accent reads 5.64:1 on it. Squared off and left to the
                    utility's own inset hairline instead of a border-t. */}
                      <div className="mt-auto px-6 py-5 glass-soft [--glass-radius:0] flex flex-col gap-2">
                        <Link
                          to="/cart"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center justify-between min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                        >
                          <span className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" /> עגלת קניות
                          </span>
                          {count > 0 && (
                            <span className="text-xs text-accent font-semibold">{count}</span>
                          )}
                        </Link>
                        <Link
                          to="/favorites"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center justify-between min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                        >
                          <span className="flex items-center gap-2">
                            <Heart className="h-4 w-4" /> מועדפים
                          </span>
                          {favCount > 0 && (
                            <span className="text-xs text-accent font-semibold">{favCount}</span>
                          )}
                        </Link>
                        {user ? (
                          <>
                            <Link
                              to="/account"
                              onClick={() => setDrawerOpen(false)}
                              className={`flex items-center gap-2 min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                            >
                              <UserIcon className="h-4 w-4" /> החשבון שלי
                            </Link>
                            {isAdmin && (
                              <Link
                                to="/admin"
                                onClick={() => setDrawerOpen(false)}
                                className={`min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                              >
                                ניהול
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                signOut();
                                setDrawerOpen(false);
                              }}
                              className={`text-right min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                            >
                              יציאה
                            </button>
                          </>
                        ) : (
                          <Link
                            to="/auth"
                            onClick={() => setDrawerOpen(false)}
                            className={`flex items-center gap-2 min-h-[44px] py-2 text-[15px] ${LINK_HOVER_CLS}`}
                          >
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

              {/* RTL end (left): cart + account */}
              <div className="flex items-center gap-1">
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
                  aria-label={
                    count === 0
                      ? "עגלה"
                      : count === 1
                        ? "עגלה — פריט אחד"
                        : `עגלה — ${count} פריטים`
                  }
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
                {/* Favourites and account leave the phone bar (UI review,
                8.11.2026): five 44px targets beside the logo crowd a 375px
                screen, and both sit at the bottom of the drawer with their
                counts. */}
                <Link
                  to="/favorites"
                  className={`relative ${ICON_BTN_CLS} max-sm:hidden`}
                  aria-label={
                    favCount === 0
                      ? "מועדפים"
                      : favCount === 1
                        ? "מועדפים — פריט אחד"
                        : `מועדפים — ${favCount} פריטים`
                  }
                >
                  <Heart className="h-5 w-5" />
                  {favCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-argaman px-1 text-[11px] font-bold text-white">
                      {favCount}
                    </span>
                  )}
                </Link>
                {user ? (
                  <Link
                    to="/account"
                    className={`${ICON_BTN_CLS} max-sm:hidden`}
                    aria-label="החשבון שלי"
                  >
                    <UserIcon className="h-5 w-5 text-accent" />
                  </Link>
                ) : (
                  <Link to="/auth" className={`${ICON_BTN_CLS} max-sm:hidden`} aria-label="כניסה">
                    <UserIcon className="h-5 w-5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop nav row: the nine departments of the category map
          (src/lib/nav-taxonomy.ts), each a dropdown with its shelves, so every
          category is one hover-free click away and none is listed twice. It
          replaced seven shortcut links with frozen counts and a separate
          "כל הקטגוריות" door (owner, 8.11.2026). The row is wider than the 2xl
          logo row can hold, so it stays on its own line at every desktop
          width; it may wrap to two lines on a 1024px screen. Panels in the
          left half of the row open toward the centre (align="end"). */}
            <nav
              ref={navRef}
              aria-label="ניווט ראשי"
              className="order-last hidden min-h-11 w-full flex-wrap items-center justify-center gap-x-5 gap-y-1 py-1.5 text-[15px] lg:flex xl:gap-x-6"
            >
              <Link to="/shop" className={NAV_LINK_CLS}>
                חנות
              </Link>
              {departments.map((d, i) => (
                <DepartmentMenu
                  key={d.label}
                  dept={d}
                  align={i < departments.length / 2 ? "start" : "end"}
                />
              ))}
              {/* Secondary group — a discovery entry plus the informational
            destinations that only lived in the drawer/footer before. A hairline
            divider sets them off from the curated shopping links so the row
            reads as two clusters. "מתנות לפי אירוע" now opens the seven
            /collection/ hubs directly instead of bouncing through /categories —
            see OccasionMenu for why that matters and why it is a <details>. */}
              <span aria-hidden="true" className="h-4 w-px bg-border" />
              <OccasionMenu />
              <Link to="/articles" className={NAV_LINK_CLS}>
                מדריכים
              </Link>
              <Link to="/about" className={NAV_LINK_CLS}>
                אודות
              </Link>
            </nav>
          </div>

          {/* Bottom edge: full-width gold hairline */}
          <div
            aria-hidden="true"
            className="h-px w-full"
            style={{ background: "var(--gradient-gold-line)" }}
          />
        </div>

        {/* Search overlay */}
        {searchOpen && (
          // The scrim is a light veil, not a blackout: bg-foreground/60 turned the
          // whole white page into a dark wash, which is the opposite of the
          // direction. 25% of the cool deep ink plus a small blur pushes the page
          // back without extinguishing it.
          <div
            className="fixed inset-0 z-50 bg-argaman-deep/25 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
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
                <form
                  onSubmit={submitSearch}
                  className="flex shrink-0 items-center gap-3 px-4 py-4"
                >
                  <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="site-search" className="sr-only">
                    חיפוש מוצרים וקטגוריות
                  </label>
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
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground press [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
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
                          const effective = priceView(
                            Number(p.price),
                            promoFor(promoIndex, p.id),
                          ).pays;
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
                              <span className="flex-1 font-display text-[15px] line-clamp-1">
                                {p.name}
                              </span>
                              {Number(p.price) === 0 ? (
                                <span className="shrink-0 text-xs font-semibold text-accent">
                                  לפי שער הזהב
                                </span>
                              ) : (
                                <span className="flex shrink-0 items-center gap-1.5">
                                  <span className="text-sm font-semibold text-accent">
                                    {formatILS(effective)}
                                  </span>
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
                                className="inline-flex min-h-[44px] items-center rounded-full border border-accent px-4 text-sm font-medium text-accent press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground"
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
                                className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-4 text-sm press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
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
                              className={`min-h-[44px] w-full rounded-full border border-accent px-6 py-2 text-sm font-medium text-accent press ${activeOptionId === "sopt-all" ? "bg-accent text-accent-foreground" : ""} [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground`}
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
                                className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-4 text-sm press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">קטגוריות</div>
                        <div className="flex flex-wrap gap-2">
                          {departments.map((d) =>
                            d.slug ? (
                              <Link
                                key={d.slug}
                                to="/category/$slug"
                                params={{ slug: d.slug }}
                                onClick={() => setSearchOpen(false)}
                                className="inline-flex min-h-[44px] items-center rounded-full border border-gold/40 px-4 text-sm text-foreground/85 press [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                              >
                                {d.label}
                              </Link>
                            ) : null,
                          )}
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

export function SiteFooter({ hideOnMobile = false }: { hideOnMobile?: boolean } = {}) {
  return (
    // --cream is no longer warm parchment — it is now the pale COOL tint
    // #F4F6F9, so bg-cream survives the redesign as the faint surface that
    // separates the footer from the white page above it.
    <footer
      className={`relative mt-24 bg-cream text-foreground ${hideOnMobile ? "max-lg:hidden" : ""}`}
    >
      {/* Top edge: gold hairline — the direction's signature rule. Verbatim. */}
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{ background: "var(--gradient-gold-line)" }}
      />
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
            חנות תשמישי קדושה — כלי כסף, כוסות קידוש, חנוכיות, נרתיקי מזוזה, טליתות ועוד, באיכות
            ובהידור.
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
              <div className="text-xs font-medium tracking-[0.12em] [word-spacing:0.25em] text-accent mb-4">
                קישורים
              </div>
              <ul className="space-y-4 text-[15px] text-muted-foreground">
                <li>
                  <Link to="/shop" className={FOOT_LINK_CLS}>
                    כל המוצרים
                  </Link>
                </li>
                <li>
                  <Link to="/categories" className={FOOT_LINK_CLS}>
                    קטגוריות
                  </Link>
                </li>
                <li>
                  <Link to="/articles" className={FOOT_LINK_CLS}>
                    מדריכים ומאמרים
                  </Link>
                </li>
                <li>
                  <Link to="/about" className={FOOT_LINK_CLS}>
                    אודות
                  </Link>
                </li>
                {/* Sitewide footer link, which is what makes the brand-name
                    page a real part of the site rather than an orphan the
                    sitemap alone points at. */}
                <li>
                  <Link to="/or-zarua-latzadik" className={FOOT_LINK_CLS}>
                    מקור השם
                  </Link>
                </li>
                <li>
                  <Link to="/club" className={FOOT_LINK_CLS}>
                    מועדון חברים
                  </Link>
                </li>
                <li>
                  <Link to="/track" className={FOOT_LINK_CLS}>
                    מעקב הזמנה
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className={FOOT_LINK_CLS}>
                    צור קשר
                  </Link>
                </li>
              </ul>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium tracking-[0.12em] [word-spacing:0.25em] text-accent mb-4">
                תקנון האתר
              </div>
              <ul className="space-y-4 text-[15px] text-muted-foreground">
                {/* Shipping/returns lead the column: they are what a first-time
                  buyer looks for, and each is a short summary of the matching
                  clause in the terms below. */}
                <li>
                  <Link to="/shipping" className={FOOT_LINK_CLS}>
                    משלוחים ואספקה
                  </Link>
                </li>
                <li>
                  <Link to="/returns" className={FOOT_LINK_CLS}>
                    ביטול והחזרות
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className={FOOT_LINK_CLS}>
                    מדיניות פרטיות
                  </Link>
                </li>
                <li>
                  <Link to="/accessibility" className={FOOT_LINK_CLS}>
                    הצהרת נגישות
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className={FOOT_LINK_CLS}>
                    תקנון ותנאי שימוש
                  </Link>
                </li>
                <li>
                  <button onClick={openCookieSettings} className={FOOT_LINK_CLS}>
                    ניהול עוגיות
                  </button>
                </li>
              </ul>
            </div>
            {/* Contact block — the CANONICAL home of the address/phone (the
              homepage colophon de-emphasizes them); content stays unchanged. */}
            <div className="text-center md:text-left">
              <div className="text-xs font-medium tracking-[0.12em] [word-spacing:0.25em] text-accent mb-4">
                צור קשר
              </div>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                לבירורים והזמנות מיוחדות,
                <br />
                צרו איתנו קשר.
              </p>
              <div className="mt-3 text-xs text-muted-foreground leading-relaxed space-y-0.5">
                <div>
                  {BUSINESS.name}
                  {BUSINESS.legalId ? ` · ${BUSINESS.legalId}` : ""}
                </div>
                {BUSINESS.address && <div>{BUSINESS.address}</div>}
                {/* text-sm, a step up from the `text-xs` the rest of this
                  colophon runs at. The phone number and the address are the
                  only two CONVERSION elements in the footer — a shopper who
                  wants to ask before buying taps one of them — and they were
                  the smallest touch targets on the whole site at 14px tall.
                  The legal identity lines around them are genuinely fine print
                  and stay at text-xs. */}
                <div className="text-sm">
                  <a href={`tel:${BUSINESS.phone}`} className={FOOT_LINK_CLS}>
                    {BUSINESS.phoneDisplay}
                  </a>
                  {" · "}
                  <a href={`mailto:${BUSINESS.email}`} className={FOOT_LINK_CLS}>
                    {BUSINESS.email}
                  </a>
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
                      {i > 0 && (
                        <span aria-hidden="true" className="text-glass-line">
                          ·
                        </span>
                      )}
                      <a
                        href={p.url}
                        target="_blank"
                        rel="me noopener noreferrer"
                        className={FOOT_LINK_CLS}
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
            <div className="text-xs font-medium tracking-[0.12em] [word-spacing:0.25em] text-accent mb-3">
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
        {/* pb-24: the floating buttons (accessibility, music, WhatsApp) sit over
            the last 5rem of the viewport; without the room they covered this
            line, and with it the music credit. */}
        <div className="container mx-auto px-4 pt-6 pb-24 text-center text-xs tracking-wide text-muted-foreground">
          © {new Date().getFullYear()} אור זרוע לצדיק. כל הזכויות שמורות.
          {SITE_MUSIC ? <p className="mt-2">🎵 {musicCredit(SITE_MUSIC)}</p> : null}
        </div>
      </div>
    </footer>
  );
}
