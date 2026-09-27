/**
 * Old category slugs that 301 to a canonical one — from the 2026-07 dedupe and
 * the 2026-09 rename that corrected part of it. Read by the /category/$slug
 * loader, and by category-slugs.test.ts, which fails if any category config
 * (personalization gate, cross-sells, guide links) still names one of these
 * slugs: the 2026-09 covers rename silently broke all three.
 *
 * The 2026-07 dedupe folded a `talit-tefillin-covers` category into
 * `talit-tefillin-sets` because their products overlapped. Merging the rows was
 * right; keeping the SETS slug for a page of COVERS was not, and that half is
 * undone below. The kippot/talitot twins merged at the same time carried
 * percent-encoded slugs with no meaningful inbound links, so they are
 * intentionally left to 404 rather than risk a double-encoded redirect target.
 */
export const MERGED_CATEGORY_REDIRECTS: Record<string, string> = {
  // 2026-09 rename, and it is a CORRECTION of the 2026-07 merge below rather
  // than a new dedupe. That merge folded the covers category into a slug named
  // `talit-tefillin-sets` — while a separate, larger sets category
  // (`setim-talit-tefilin`, 229 products) went on existing. So the URL said
  // "sets" over a page of 55 covers named "כיסויים לטלית ותפילין", next to a
  // real sets page. Search Console showed both live and both losing: the covers
  // page ranked for "כיסוי טלית" and the sets page for "סט טלית ותפילין", each
  // around position 67, with the URL of one describing the other.
  "talit-tefillin-sets": "talit-tefillin-covers",
  // 2026-07 slug cleanup: four product-bearing categories carried percent-encoded
  // Hebrew slugs (ugly URLs whose natural form 404'd — the router decodes %d7.. to
  // Hebrew, which never matched the literal-encoded DB slug). Renamed to clean
  // ASCII; these 301s catch any double-encoded inbound link whose decoded param is
  // the old literal slug string.
  "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa": "talitot",
  "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d": "sidurim",
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94": "yehudaika",
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94":
    "marazim-chatanim",
};
