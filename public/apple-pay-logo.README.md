# apple-pay-logo.png

The merchant logo CardCom shows inside the Apple Pay sheet.

Paste this URL into the CardCom panel, under
`ראשי > רשימת מסופים > ☰ > Apple Pay > כתובת לוגו`:

    https://orzadik.com/apple-pay-logo.png

## Why this file exists rather than reusing logo.png

CardCom's spec is a **square** PNG, 180x180, under 200KB, publicly reachable.
Nothing in the repo met it:

* `public/logo.png` is the 586x200 lockup — 2.9:1, not square. Apple crops a
  non-square image to a square itself, which would have cut the wordmark.
* `public/favicon.ico` IS 256x256, but it is a bad centre-crop of that same
  lockup: it renders as "זרוע ל" with both ends sliced off.

So the lockup is letterboxed onto the brand cream (#FFFBF2) with 14px of
padding, which keeps the whole mark — wordmark, tagline and ornament rule —
inside the square. 7.4KB.

## If the brand mark ever changes

Regenerate from `public/logo.png` at the same 180x180 / cream / 14px padding,
or replace with a purpose-drawn square mark if one is ever commissioned. The
URL above is configured in CardCom's panel, not in this codebase, so the
filename must not change without updating it there.
