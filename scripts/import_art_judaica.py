#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate a Supabase migration that imports the ART Judaica supplier catalog
(ART_JUDAICA_ITEMS.xlsx) into public.categories / products / product_categories
/ product_images.

Usage:
    python scripts/import_art_judaica.py \
        --xlsx  "C:/Users/ariel/Downloads/ART_JUDAICA_ITEMS.xlsx" \
        --out   supabase/migrations/<timestamp>_import_art_judaica_catalog.sql \
        [--image-status image_status.json]   # cached HEAD-check results
        [--validate-images]                  # re-check every image URL over HTTP
        [--price-mode ils|usd] [--fx 3.7] [--markup 1.0]

The generated SQL is idempotent: re-running the migration updates existing rows
instead of duplicating them (products keyed on wp_id, categories on slug).
"""

import argparse
import io
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

IMG_BASE = "https://www.israel-judaica.com/big/"
URL_COL = "קישור_לתמונה_באתר_ארט"

# --------------------------------------------------------------------------
# Category taxonomy: Hebrew name -> URL slug.
# Curated (not auto-transliterated) so the public URLs stay clean and stable.
# --------------------------------------------------------------------------
PARENT_SLUGS = {
    "אביזרי תצוגה": "avizarei-tetzuga",
    "ברכות חמסות וסגולות": "brachot-chamsot-segulot",
    "גביעי קידוש וסטים ליין": "gviei-kidush",
    "גופיה ציצית וקיטלים": "gufiya-tzitzit-kitelim",
    "הבדלה": "havdala",
    "חגים": "chagim",
    "חסידים צבעוניים": "chasidim-tzivoniim",
    "טלית ותפילין": "talit-tefilin",
    "ילדים": "yeladim",
    "כיפות": "kipot",
    "כרית לברית": "karit-labrit",
    "מוצרי בית כנסת ושטנדרים": "beit-knesset-shtenderim",
    "מזוזות": "mezuzot",
    "מזכרות ארץ ישראל ומנורות": "mazkarot-eretz-israel",
    "מחזיקי מפתחות ומגנטים": "machzikei-maftechot-magnetim",
    "נטילת ידיים ומים אחרונים": "netilat-yadaim",
    "סידורים ברכונים ותהילים": "sidurim-tehilim",
    "עטים": "etim",
    "פמוטים": "pamotim",
    "קופות צדקה": "kupot-tzedaka",
    "שבת": "shabbat",
    "תכשיטים": "tachshitim",
}

CHILD_SLUGS = {
    "ברכות": "brachot",
    "חמסות": "chamsot",
    "סגולות": "segulot",
    "גביעי קידוש מתכת": "gviei-kidush-matechet",
    "גביעי קידוש פולימר": "gviei-kidush-polymer",
    "גביעי קידוש קריסטל וקרמיקה": "gviei-kidush-crystal-keramika",
    "מחלקי יין וסטים לקידוש": "machlekei-yain-setim",
    "גופיה ציצית": "gufiya-tzitzit",
    "קיטלים": "kitelim",
    "חנוכה": "chanuka",
    "סוכות": "sukot",
    "פורים": "purim",
    "פסח": "pesach",
    "ראש השנה": "rosh-hashana",
    "בתי תפילין ומראות": "batei-tefilin-marot",
    "מחזיקי טלית, עטרות וניילונים": "machzikei-talit-atarot",
    "סטים טלית ותפילין": "setim-talit-tefilin",
    "תיק- תפ": "tik-tefilin",
    "תיקי טלית": "tikei-talit",
    "כיפות DMC עבודות יד": "kipot-dmc-avodat-yad",
    "כיפות מיוחדות": "kipot-meyuchadot",
    "כיפות סטן וטרילין": "kipot-satan-trilin",
    "כיפות סרוגות": "kipot-srugot",
    "כיפות סרוגות עם רקמה": "kipot-srugot-rikma",
    "כיפות עור": "kipot-or",
    "כיפות פריק": "kipot-frik",
    "כיפות קטיפה": "kipot-ktifa",
    "סיכות לכיפה": "sikot-lakipa",
    "מזוזות אלומניום": "mezuzot-aluminium",
    "מזוזות זכוכית": "mezuzot-zchuchit",
    "מזוזות לרכב": "mezuzot-larechev",
    "מזוזות מתכת": "mezuzot-matechet",
    "מזוזות עץ": "mezuzot-etz",
    "מזוזות פולירזין ואבן": "mezuzot-polyresin-even",
    "מזוזות פלסטיק": "mezuzot-plastik",
    "מגנטים": "magnetim",
    "מחזיק מפתחות": "machzikei-maftechot",
    "סידורים ותהילים": "sidurim-utehilim",
    "טליתות": "tachshitei-talitot",
    "צמידים טבעות ועגילים": "tzmidim-tabaot-agilim",
    "תכשיטי נרוסטה ורודיום": "tachshitei-nirosta-rodium",
    "תכשיטים כסף טהור": "tachshitei-kesef-tahor",
    "כיסויי חלה": "kisuyei-chala",
    "כיסויים לפלטה": "kisuyim-lapalta",
    "מפות שולחן + רנר": "mapot-shulchan-runner",
    "קרשי חלה סכינים  ומפיונים": "karshei-chala-sakinim",
    "שבת שונות": "shabbat-shonot",
    # Orphans in the sheet (no category_parent) -> promoted to top level.
    "ברכונים": "birchonim",
    "חתן כלה": "chatan-kala",
    "סכינים": "sakinim",
}

# Display order for top-level categories (lower = earlier).
PARENT_ORDER = [
    "שבת", "חגים", "מזוזות", "כיפות", "טלית ותפילין", "פמוטים",
    "גביעי קידוש וסטים ליין", "הבדלה", "נטילת ידיים ומים אחרונים",
    "ברכות חמסות וסגולות", "סידורים ברכונים ותהילים", "ברכונים",
    "מוצרי בית כנסת ושטנדרים", "קופות צדקה", "תכשיטים", "חתן כלה",
    "כרית לברית", "ילדים", "מחזיקי מפתחות ומגנטים", "חסידים צבעוניים",
    "גופיה ציצית וקיטלים", "סכינים", "מזכרות ארץ ישראל ומנורות",
    "עטים", "אביזרי תצוגה",
]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def sql_str(v):
    """Render a Python value as a SQL literal."""
    if v is None or v == "":
        return "NULL"
    # Postgres runs with standard_conforming_strings = on, so a backslash is a
    # literal backslash - only the single quote needs doubling.
    s = str(v).replace("'", "''")
    s = "".join(ch for ch in s if ch == "\n" or ch == "\t" or unicodedata.category(ch)[0] != "C")
    return "'" + s.strip() + "'"


def sql_num(v):
    if v is None or v == "":
        return "NULL"
    try:
        return repr(round(float(v), 2))
    except (TypeError, ValueError):
        return "NULL"


def slugify(text, maxlen=70):
    """ASCII slug from the English product name."""
    s = unicodedata.normalize("NFKD", str(text))
    s = s.encode("ascii", "ignore").decode("ascii").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s[:maxlen].strip("-")


def clean(v):
    """Normalise a spreadsheet cell: '_' and blanks mean 'no value'."""
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s in ("_", "-", "0", "") else s


def item_number(row):
    m = re.search(r"/big/(\d+)\.jpg", str(row.get(URL_COL) or ""))
    if m:
        return m.group(1)
    m = re.search(r"(\d+)", str(row.get("ITEMKEY") or ""))
    return m.group(1) if m else None


def build_descriptions(row):
    """Return (description, short_description) in Hebrew."""
    specs = []
    for label, key in (("חומר", "ItemMaterial"), ("צבע", "Color"), ("שפה", "Language")):
        val = clean(row.get(key))
        if val:
            specs.append(f"{label}: {val}")

    dims = []
    for label, key in (("אורך", "ItemLength"), ("רוחב", "ItemWidth"), ("עומק", "ItemDepth")):
        val = clean(row.get(key))
        if val:
            dims.append(f"{label} {val} ס\"מ")
    if dims:
        specs.append("מידות: " + ", ".join(dims))

    spec_line = " | ".join(specs)
    info = clean(row.get("MORE_INFO"))
    name = clean(row.get("Items_Name"))

    if info:
        description = info + (("\n\n" + spec_line) if spec_line else "")
        short = trim_words(info, 160)
    else:
        description = name + (("\n\n" + spec_line) if spec_line else "")
        short = trim_words(spec_line or name, 160)
    return description, short


def trim_words(text, limit):
    """Truncate on a word boundary so Hebrew text never breaks mid-word."""
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if " " in cut:
        cut = cut[:cut.rindex(" ")]
    return cut.rstrip(" ,.;:|-") + "…"


def convert_price(raw, mode, fx, markup):
    price = float(raw)
    if mode == "usd":
        price = price * fx
    price = price * markup
    if mode == "usd" or markup != 1.0:
        # keep the .90 psychological ending after conversion
        price = max(1.0, round(price) - 0.1)
    return round(price, 2)


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--image-status", default=None,
                    help="JSON cache of {url: [status, content_type, length]}")
    ap.add_argument("--validate-images", action="store_true")
    ap.add_argument("--price-mode", choices=["ils", "usd"], default="ils",
                    help="'ils' = sheet PRICE is already shekels; "
                         "'usd' = multiply by --fx")
    ap.add_argument("--fx", type=float, default=3.7)
    ap.add_argument("--markup", type=float, default=1.0)
    ap.add_argument("--inactive", action="store_true",
                    help="import products with is_active = false (staging)")
    ap.add_argument("--image-base", default=None,
                    help="serve images from here instead of the supplier host, "
                         "e.g. https://<ref>.supabase.co/storage/v1/object/public/"
                         "product-images/catalog/ (see scripts/fetch_product_images.py)")
    ap.add_argument("--image-ext", default=".webp",
                    help="file extension used with --image-base")
    args = ap.parse_args()

    import openpyxl
    wb = openpyxl.load_workbook(args.xlsx, data_only=True, read_only=True)
    ws = wb["ITEMS_ART"]
    raw = list(ws.iter_rows(values_only=True))
    hdr = [str(h) if h is not None else "" for h in raw[0]]
    rows = [dict(zip(hdr, r)) for r in raw[1:]
            if any(c is not None and str(c).strip() for c in r)]
    print(f"read {len(rows)} catalog rows")

    # ---- image validity -------------------------------------------------
    status = {}
    if args.image_status and os.path.exists(args.image_status):
        status = json.load(io.open(args.image_status, encoding="utf-8"))
        print(f"loaded image status cache: {len(status)} urls")
    elif args.validate_images:
        status = validate_images(rows)

    def img_ok(url):
        if not status:
            return True                      # no data -> trust the sheet
        st = status.get(url)
        return bool(st) and st[0] == 200 and str(st[1]).startswith("image")

    # ---- build category set --------------------------------------------
    # A child whose name equals its parent collapses into the parent.
    cats = {}          # slug -> dict(name, parent_slug, sort_order)
    pair_to_slug = {}  # (parent_he, child_he) -> slug products attach to

    for row in rows:
        parent_he = clean(row.get("category_parent"))
        child_he = clean(row.get("category"))
        if not child_he:
            continue

        if parent_he and parent_he != child_he:
            pslug = PARENT_SLUGS.get(parent_he)
            cslug = CHILD_SLUGS.get(child_he)
            if not pslug or not cslug:
                print(f"  !! unmapped: |{parent_he}| -> |{child_he}|", file=sys.stderr)
                continue
            cats.setdefault(pslug, {"name": parent_he, "parent": None})
            cats.setdefault(cslug, {"name": child_he, "parent": pslug})
            pair_to_slug[(parent_he, child_he)] = cslug
        else:
            # top-level: parent==child, or no parent at all
            name = parent_he or child_he
            slug = PARENT_SLUGS.get(name) or CHILD_SLUGS.get(name)
            if not slug:
                print(f"  !! unmapped top-level: |{name}|", file=sys.stderr)
                continue
            cats.setdefault(slug, {"name": name, "parent": None})
            pair_to_slug[(parent_he, child_he)] = slug

    for slug, c in cats.items():
        base = c["name"] if c["parent"] is None else cats[c["parent"]]["name"]
        c["sort_order"] = (PARENT_ORDER.index(base) if base in PARENT_ORDER else 99) * 100
    print(f"categories: {len(cats)} "
          f"({sum(1 for c in cats.values() if c['parent'] is None)} top-level)")

    # ---- build product rows ---------------------------------------------
    products, prod_cats, prod_imgs = [], [], []
    seen_slug, seen_wp = set(), set()
    skipped = {"no_number": 0, "dup": 0, "no_category": 0}

    for row in rows:
        num = item_number(row)
        if not num:
            skipped["no_number"] += 1
            continue
        wp_id = int(num)
        if wp_id in seen_wp:
            skipped["dup"] += 1
            continue

        key = (clean(row.get("category_parent")), clean(row.get("category")))
        cat_slug = pair_to_slug.get(key)
        if not cat_slug:
            skipped["no_category"] += 1
            continue
        seen_wp.add(wp_id)

        base = slugify(row.get("FORIGNNAME") or row.get("Items_Name") or f"item-{num}")
        slug = f"{base}-{num}" if base else f"item-{num}"
        while slug in seen_slug:
            slug += "-x"
        seen_slug.add(slug)

        description, short = build_descriptions(row)
        # Validity is always judged against the supplier URL (that is what was
        # HEAD-checked); only the published URL changes with --image-base.
        main_src = f"{IMG_BASE}{num}.jpg"
        main_url = (f"{args.image_base}{num}{args.image_ext}"
                    if args.image_base else main_src)

        products.append({
            "wp_id": wp_id,
            "slug": slug,
            "name": clean(row.get("Items_Name")) or clean(row.get("FORIGNNAME")),
            "description": description,
            "short_description": short,
            "price": convert_price(row.get("PRICE") or 0, args.price_mode,
                                   args.fx, args.markup),
            "sku": clean(row.get("ITEMKEY")),
            "thumbnail_url": main_url if img_ok(main_src) else None,
            "is_active": not args.inactive,
        })
        # Link to the subcategory *and* its parent. The storefront queries
        # product_categories by exact category id and has no roll-up, so
        # without the second link every parent category page renders empty.
        prod_cats.append((wp_id, cat_slug))
        parent_slug = cats[cat_slug]["parent"]
        if parent_slug:
            prod_cats.append((wp_id, parent_slug))

        order = 0
        for i in (1, 2, 3, 4):
            if not clean(row.get(f"Imageexist_{i}")):
                continue
            gsrc = f"{IMG_BASE}{num}_{i}.jpg"
            if img_ok(gsrc):
                order += 1
                gurl = (f"{args.image_base}{num}_{i}{args.image_ext}"
                        if args.image_base else gsrc)
                prod_imgs.append((wp_id, gurl, order))

    print(f"products: {len(products)}  skipped={skipped}")
    print(f"gallery images: {len(prod_imgs)}")
    print(f"missing thumbnails: {sum(1 for p in products if not p['thumbnail_url'])}")

    write_sql(args.out, cats, products, prod_cats, prod_imgs, args)
    print(f"wrote {args.out} ({os.path.getsize(args.out)/1024/1024:.2f} MB)")


def validate_images(rows):
    import concurrent.futures as cf
    import urllib.request
    urls = set()
    for r in rows:
        n = item_number(r)
        if not n:
            continue
        urls.add(f"{IMG_BASE}{n}.jpg")
        for i in (1, 2, 3, 4):
            if clean(r.get(f"Imageexist_{i}")):
                urls.add(f"{IMG_BASE}{n}_{i}.jpg")
    urls = sorted(urls)
    print(f"validating {len(urls)} image urls ...")

    def head(u):
        try:
            rq = urllib.request.Request(
                u, method="HEAD",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(rq, timeout=30) as resp:
                return u, [resp.status, resp.headers.get("Content-Type", ""), ""]
        except Exception as e:
            return u, [getattr(e, "code", 0), "ERR", ""]

    out = {}
    # keep concurrency low - the supplier host rate-limits aggressively
    with cf.ThreadPoolExecutor(5) as ex:
        for u, st in ex.map(head, urls):
            out[u] = st
    return out


def write_sql(path, cats, products, prod_cats, prod_imgs, args):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    f = io.open(path, "w", encoding="utf-8", newline="\n")
    w = f.write

    w("-- ART Judaica supplier catalog import\n")
    w(f"-- generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC} "
      f"by scripts/import_art_judaica.py\n")
    w(f"-- price-mode={args.price_mode} fx={args.fx} markup={args.markup}\n")
    w(f"-- {len(cats)} categories, {len(products)} products, "
      f"{len(prod_imgs)} gallery images\n")
    w("-- Idempotent: re-running updates existing rows (products keyed on wp_id).\n\n")
    w("BEGIN;\n\n")

    # gallery images need a uniqueness key so re-runs don't duplicate
    w("CREATE UNIQUE INDEX IF NOT EXISTS product_images_product_url_key\n")
    w("  ON public.product_images (product_id, url);\n\n")

    # ---- categories -----------------------------------------------------
    w("-- ============ categories ============\n")
    w("INSERT INTO public.categories (slug, name, parent_slug, sort_order) VALUES\n")
    vals = []
    for slug, c in sorted(cats.items(), key=lambda kv: (kv[1]["sort_order"], kv[0])):
        vals.append(f"  ({sql_str(slug)}, {sql_str(c['name'])}, "
                    f"{sql_str(c['parent'])}, {c['sort_order']})")
    w(",\n".join(vals))
    w("\nON CONFLICT (slug) DO UPDATE SET\n"
      "  name = EXCLUDED.name,\n"
      "  parent_slug = EXCLUDED.parent_slug,\n"
      "  sort_order = EXCLUDED.sort_order,\n"
      "  updated_at = now();\n\n")

    # ---- products -------------------------------------------------------
    w("-- ============ products ============\n")
    B = 250
    for i in range(0, len(products), B):
        chunk = products[i:i + B]
        w("INSERT INTO public.products\n"
          "  (wp_id, slug, name, description, short_description, price, sku,\n"
          "   thumbnail_url, stock_status, is_active) VALUES\n")
        w(",\n".join(
            f"  ({p['wp_id']}, {sql_str(p['slug'])}, {sql_str(p['name'])}, "
            f"{sql_str(p['description'])}, {sql_str(p['short_description'])}, "
            f"{sql_num(p['price'])}, {sql_str(p['sku'])}, "
            f"{sql_str(p['thumbnail_url'])}, 'instock', "
            f"{'true' if p['is_active'] else 'false'})"
            for p in chunk))
        w("\nON CONFLICT (wp_id) DO UPDATE SET\n"
          "  slug = EXCLUDED.slug,\n"
          "  name = EXCLUDED.name,\n"
          "  description = EXCLUDED.description,\n"
          "  short_description = EXCLUDED.short_description,\n"
          "  price = EXCLUDED.price,\n"
          "  sku = EXCLUDED.sku,\n"
          "  thumbnail_url = EXCLUDED.thumbnail_url,\n"
          "  is_active = EXCLUDED.is_active,\n"
          "  updated_at = now();\n\n")

    # ---- product <-> category ------------------------------------------
    w("-- ============ product_categories ============\n")
    for i in range(0, len(prod_cats), 500):
        chunk = prod_cats[i:i + 500]
        w("INSERT INTO public.product_categories (product_id, category_id)\n"
          "SELECT p.id, c.id FROM (VALUES\n")
        w(",\n".join(f"  ({wp}, {sql_str(cs)})" for wp, cs in chunk))
        w("\n) AS v(wp_id, cat_slug)\n"
          "JOIN public.products p ON p.wp_id = v.wp_id\n"
          "JOIN public.categories c ON c.slug = v.cat_slug\n"
          "ON CONFLICT DO NOTHING;\n\n")

    # ---- gallery images -------------------------------------------------
    if prod_imgs:
        w("-- ============ product_images ============\n")
        for i in range(0, len(prod_imgs), 500):
            chunk = prod_imgs[i:i + 500]
            w("INSERT INTO public.product_images (product_id, url, sort_order)\n"
              "SELECT p.id, v.url, v.sort_order FROM (VALUES\n")
            w(",\n".join(f"  ({wp}, {sql_str(u)}, {o})" for wp, u, o in chunk))
            w("\n) AS v(wp_id, url, sort_order)\n"
              "JOIN public.products p ON p.wp_id = v.wp_id\n"
              "ON CONFLICT (product_id, url) DO NOTHING;\n\n")

    w("COMMIT;\n")
    f.close()


if __name__ == "__main__":
    main()
