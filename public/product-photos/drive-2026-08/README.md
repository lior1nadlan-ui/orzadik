# Owner photographs, uploaded 2026-08-19

47 photographs supplied by the owner via Google Drive (shared 2026-08-19,
shot 2026-08-16), re-encoded to WebP at max 1200px / q80. Originals are HEIC
and JPEG straight off an iPhone; they are not kept here.

## What is in the set

| Group | Files | Content |
|---|---|---|
| Groom-set flat-lays | `img_0068`–`img_0106` (28 files) | Full מארז לחתן laid out: tallit, tallit bag, tefillin bag, kippah, siddur, atara. Distinct colourways: white/cream, beige linen, taupe suede, grey melange, grey flame-print, denim blue, light blue. |
| Siddur covers | `img_0107`–`img_0118` (11 files) | Single siddur, shot flat, one cover per frame: navy+gold crown, grey linen, cream linen, white embossed, white+silver crown, flame-motif linen, charcoal. |
| Lifestyle | `photo-2026-08-16-*` (8 files) | Model wearing a tallit outdoors at golden hour. Suitable for category banners and the homepage hero, not for a product tile. |

## Not yet attached to any product

Deliberately. `src/lib/product-photos.ts` records the rule and the reason: a
photograph on a product page is a factual claim about what arrives in the box,
and the last set of slug→photo pairings made by guessing from filename order
was measured wrong in half of the cases on a ₪1,643–2,000 product line.

Seven active groom sets still have `thumbnail_url IS NULL`:

    groom-set-grey-print        מארז לחתן - דגם אפור עם הדפס
    groom-set-white-crown       מארז לחתן - דגם לבן עם כתר
    groom-set-beige-suede       מארז לחתן - דגם זמש בז'
    groom-set-light-blue        מארז לחתן - דגם תכלת
    groom-set-blue-denim        מארז לחתן - דגם ג'ינס כחול
    groom-set-white-embroidered מארז לחתן - דגם לבן מעוצב
    groom-set-beige-linen-classic מארז לחתן - דגם בז' פשתן קלאסי

The colourways above plainly cover all seven, but which physical set is which
model is the owner's call, not an inference from a photograph. Once each
pairing is confirmed, wire it in and the "אין תמונה" fallback goes away.

## Before any of these become a product hero

Some frames carry a customer's embroidered name in the fabric (the same issue
flagged for `public/groom-sets/`). Check the pixels of a frame before promoting
it, and prefer one without a name.
