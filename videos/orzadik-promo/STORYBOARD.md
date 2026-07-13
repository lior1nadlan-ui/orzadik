---
format: 1080x1920
message: "תשמישי קדושה מהודרים, בהתאמה אישית — לרגעים הקדושים שלך"
arc: Category hook → Brand → Showcase → Personalization → Trust → CTA
audience: ישראלים דתיים ומסורתיים שקונים תשמישי קדושה ומתנות לאירועי חיים (חתונה, בר מצווה, חלאקה)
mode: collaborative
music: warm elegant uplifting cinematic
---

## Video direction

- **palette system** (from `frame.md`, never invented): canvas = warm cream `#fcfaf6`; all text/ink = `#1f1915`; **accent = gold `#D4AF37`/`#ac7b49`** — reserved for the ONE hero word per frame, hairline rules, the brand mark, the radial "bloom", and the URL. Panels/tiles sit on muted cream `#f2eee7` with a 1px gold hairline; no heavy shadows (this pack is hairline-elevation, flat paper). Product photos are the color — the ground stays quiet cream so they pop.
- **motion grammar + reveal model**: long-tail `power3`-family eases (smooth over bouncy — this is a premium brand, nothing springs/overshoots). **VO-paced reveal** (here the on-screen Hebrew line is the "VO"): at t=0 only the first cue enters; each further word/tile/chip reveals **when its line lands**, spread across the shot — never front-load the whole canvas. Hebrew is RTL: text flows right-to-left, hero words enter from the right or scale from center.
- **rhythm / held-frame allocation**: Frames 1, 3, 5 reveal actively (word-hero / tiles / triad). **Frames 2 (brand) and 4 (personalization) are the held breathers** — content resolves then reads STILL (a lockup that just sits; embroidery text settling), only the gold bloom breathing faintly behind. Frame 6 lands the URL and holds. Vary energy so it isn't uniformly busy.
- **negative list — never appears**: browser chrome / nav / scrollbars / real cursors; floating bokeh or purple-blue "AI" gradients; pure `#000`/`#fff`; **Latin serif rendering Hebrew** (all Hebrew is Assistant — a real Hebrew face); and BOTH motion failure modes — slideshow (dump-everything-then-freeze) and screensaver (everything drifting independently). Gold is scarce voltage, never a wash.
- **type** (from `frame.md` by role): the display ramp (`headline`, `display`, `display-it`) carries every hero Hebrew line; `body`/`micro-label` for sub-lines and chips; all weight-400/600 Assistant. Reference by role, never raw px.
- **caption band**: no captions (silent film) — but keep the bottom ~12% quiet for bottom-edge consistency; the CTA URL may sit in the lower-third but not the very edge.

## Frame 1 — Hook

- scene: רקע קרם עם פריחת זהב רדיאלית; המילה "מהודר" מוזרקת גדול על תמונת מוצר גיבור
- src: compositions/frames/01-hook.html
- duration: 3.5s
- transition_in: cut
- status: animated
- voiceover: "לרגעים הכי קדושים — משהו מהודר."
- type: hook
- asset_candidates: assets/cat-chatan-mveaizjf.webp — מארז מהודר לחתן (background hero); assets/hero-poster.webp — פוסטר מותג חם (supporting)
- blueprint: kinetic-type-beats (Reproduce)
- focal: cat-chatan-mveaizjf.webp
- roles: cat-chatan-mveaizjf.webp = background (full-bleed, dim ~45%) · hero-poster.webp = supporting
- sfx: riser-soft
Scene 1 (0.0–1.3s): cream canvas; the product photo (מארז לחתן) sits full-bleed behind, dimmed ~45%, a soft gold radial bloom igniting from center. The line "לרגעים הכי קדושים" fades up in ink on the upper-third, RTL, one calm reveal — Centered, top-third, ~40% of frame.
Scene 2 (1.3–2.6s): on the beat, the hero word **"מהודר"** scales in huge and gold from center (display ramp), the bloom pulses once behind it — the swap/payoff is the word. Layered depth: dimmed photo (bg) · gold bloom (mid) · gold word (fg).
Scene 3 (2.6–3.5s): the word settles and reads STILL; only the bloom breathes faintly. A 1px gold hairline draws under the word. Held read against the entrance motion.

## Frame 2 — Brand

- scene: הלוגו + השם "אור זרוע לצדיק" מתלכדים במרכז על קרם, תת-שורה "תשמישי קדושה ויודאיקה מהודרת"
- src: compositions/frames/02-brand.html
- duration: 3s
- transition_in: crossfade
- status: animated
- voiceover: "אור זרוע לצדיק — תשמישי קדושה ויודאיקה מהודרת."
- type: branding
- asset_candidates: assets/logo-c8h4s61c.webp — לוגו המותג (centered mark); assets/hero-poster.webp — פוסטר מותג (background)
- blueprint: logo-assemble-lockup (Adapt)
- focal: logo-c8h4s61c.webp
- roles: logo-c8h4s61c.webp = cutout (centered mark) · hero-poster.webp = background (full-bleed, dim ~60%)
- sfx: chime-soft
Adapt: keep the assemble→centered-lockup signature; the mark fades+scales in rather than orbiting parts (premium, calm), the wordmark cascades under it.
Scene 1 (0.0–1.2s): crossfade onto a quiet cream ground (product photo far behind, dim ~60%, blurred). The **logo** fades and gently scales into dead-center from 0.9→1.0 on a long ease — Centered, ~30% of frame, upper-middle.
Scene 2 (1.2–2.2s): the wordmark **"אור זרוע לצדיק"** cascades in beneath the logo (RTL, letters/word settling), gold hairline rules flanking it left+right draw outward.
Scene 3 (2.2–3.0s): the sub-line "תשמישי קדושה ויודאיקה מהודרת" fades up small below in ink; the full lockup holds STILL — a breather beat, only faint bloom behind.

## Frame 3 — Showcase: מארזים וסטים

- scene: שתי תמונות מוצר (מארז לחתן + סט חלאקה) עולות בפאנלים בזה אחר זה, מסגור זהב דק
- src: compositions/frames/03-showcase.html
- duration: 3.5s
- transition_in: wipe
- status: animated
- voiceover: "מארזים לחתן · סטי חלאקה · בעיצוב אישי."
- type: feature_showcase
- asset_candidates: assets/cat-chatan-mveaizjf.webp — מארז לחתן (top tile); assets/cat-chalaka-d4oif-im.webp — סט חלאקה (bottom tile)
- blueprint: grid-card-assemble (Adapt)
- focal: cat-chatan-mveaizjf.webp
- roles: cat-chatan-mveaizjf.webp = cutout (top tile) · cat-chalaka-d4oif-im.webp = cutout (bottom tile)
- sfx: impact-soft
Adapt: keep the staggered self-assemble signature; two large stacked tiles (not a dense grid — this is 9:16 vertical), each with a gold-hairline frame and a label.
Scene 1 (0.0–1.2s): wipe reveals cream; the **top tile (מארז לחתן)** assembles in from the right (RTL slide + scale-settle) into the upper half, gold hairline frame drawing around it; its label "מארזים לחתן" fades in on its cue — asymmetric stack, ~45% each tile.
Scene 2 (1.2–2.4s): the **bottom tile (סט חלאקה)** assembles into the lower half the same way, staggered after the first; its label "סטי חלאקה" reveals as it lands. Two depth layers per tile (photo + frame).
Scene 3 (2.4–3.5s): both tiles held; the gold accent phrase **"בעיצוב אישי"** slides up between/over them and settles — the payoff line lands last, then stillness.

## Frame 4 — Personalization

- scene: כיסוי טלית/תפילין עם רקמה בקלוז-אפ; המילים "רקמה וחריטה אישית" נרקמות/נחרטות פנימה
- src: compositions/frames/04-personalization.html
- duration: 3.5s
- transition_in: crossfade
- status: animated
- voiceover: "רקמה וחריטה אישית — כל פריט, רק שלכם."
- type: feature_showcase
- asset_candidates: assets/cat-tallit-tefillin-covers-b1m2gdsl.webp — כיסוי טלית/תפילין עם רקמה (hero); assets/cat-tallit-cdg80v-6.webp — טלית מהודרת (background)
- blueprint: compose
- focal: cat-tallit-tefillin-covers-b1m2gdsl.webp
- roles: cat-tallit-tefillin-covers-b1m2gdsl.webp = cutout (hero, right ~55%) · cat-tallit-cdg80v-6.webp = supporting (background, dim ~50%)
- sfx: shimmer-soft
Compose: the differentiator beat — the text "embroiders itself" onto the product. Signature is a **draw-on / stroke-reveal** of the Hebrew line (like stitching), over a real embroidered cover.
Scene 1 (0.0–1.3s): crossfade to the embroidered cover held hero on the right ~55% (a second tallit dim ~50% full-bleed behind). Empty gold text-frame on the left ready — Asymmetric 55/45, 3 depth layers.
Scene 2 (1.3–2.5s): **"רקמה וחריטה אישית"** draws on stroke-by-stroke in gold (stitch/write-on) into the left frame, RTL — the writing IS the personalization. Product stays still and hero.
Scene 3 (2.5–3.5s): the sub-line "כל פריט, רק שלכם" fades up in ink beneath; everything holds STILL, the embroidery gleaming — a held climax (prefer stillness here).

## Frame 5 — Trust

- scene: מונטאז' מהיר של 3 תמונות מוצר עם 3 שבבי-אמון: "כשרות מהודרת" · "מעל 1,000 פריטים" · "משלוח עד הבית"
- src: compositions/frames/05-trust.html
- duration: 3.2s
- transition_in: wipe
- status: animated
- voiceover: "כשרות מהודרת · מעל 1,000 פריטים · משלוח עד הבית."
- type: benefit_highlight
- asset_candidates: assets/cat-gold-jewelry-c-ctazyj.webp — תכשיטי זהב (band 1); assets/cat-siddur-zkg1hpcu.webp — סידור מהודר (band 2); assets/cat-judaica-9pv3hhya.webp — יודאיקה (band 3)
- blueprint: kinetic-type-beats (Adapt)
- focal: cat-gold-jewelry-c-ctazyj.webp
- roles: cat-gold-jewelry-c-ctazyj.webp = background (row 1) · cat-siddur-zkg1hpcu.webp = background (row 2) · cat-judaica-9pv3hhya.webp = background (row 3)
- sfx: tick-soft
Adapt: keep the beat-per-cue landing; three stacked bands, each a product photo strip (dim ~40%) with a gold chip that snaps in on its cue — a triad rhythm, one-two-three.
Scene 1 (0.0–1.0s): wipe reveals a cream 3-band stack; band 1 (gold-jewelry strip) slides in RTL and its gold chip **"כשרות מהודרת"** snaps center-band — full-width strip, upper band.
Scene 2 (1.0–2.1s): band 2 (siddur strip) slides in below, chip **"מעל 1,000 פריטים"** snaps in on its cue — staggered, middle band.
Scene 3 (2.1–3.2s): band 3 (judaica strip) slides in, chip **"משלוח עד הבית"** snaps in; all three read together, then a beat of stillness — the triad complete.

## Frame 6 — CTA

- scene: הלוגו + "orzadik.com" גדול בזהב על קרם, כפתור/רמז "הזמינו עכשיו", פריחת זהב סוגרת
- src: compositions/frames/06-cta.html
- duration: 3.3s
- transition_in: crossfade
- status: animated
- voiceover: "אור זרוע לצדיק · orzadik.com · הזמינו עכשיו."
- type: cta
- asset_candidates: assets/logo-c8h4s61c.webp — לוגו המותג (centered mark); assets/hero-poster.webp — פוסטר מותג (background)
- blueprint: cta-morph-press (Adapt)
- focal: logo-c8h4s61c.webp
- roles: logo-c8h4s61c.webp = cutout (centered mark) · hero-poster.webp = background (full-bleed, dim ~65%)
- sfx: chime-bright
Adapt: keep the identity→action morph; the resting mark condenses into a brighter CTA, no cursor (a wordless premium sign-off), the URL is the hero.
Scene 1 (0.0–1.1s): crossfade to cream (product far behind, dim ~65%); the **logo** rests centered upper-third, the gold bloom re-igniting (closing the loop from Frame 1) — Centered.
Scene 2 (1.1–2.2s): the mark condenses and **"orzadik.com"** scales up huge and gold at center (the payoff), a gold pill/underline drawing beneath it — the URL is the hero.
Scene 3 (2.2–3.3s): **"הזמינו עכשיו"** fades up in ink below the URL; the bloom gives one final pulse and the full lockup holds STILL — clean sign-off.
