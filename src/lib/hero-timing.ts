// The hero carousel's timing, in ONE place.
//
// It is stated in two surfaces that must never disagree: the homepage effect
// that advances the slides, and §4.5 of the accessibility statement, which
// DECLARES the interval to the public under תקנות שוויון זכויות לאנשים עם
// מוגבלות. The statement said "כל 5 שניות" for a while after the homepage had
// already moved to 3 — a published accessibility declaration that no longer
// described the site. Importing both numbers from here is what stops the next
// timing change from doing that again.
//
// The cross-fade must stay well inside the hold: at a fade approaching the
// interval a slide is still lighting up when the next one starts, and the
// stack reads as a blur rather than as frames.
export const HERO_SLIDE_INTERVAL_MS = 3000;
export const HERO_FADE_MS = 800;

/** The interval in whole seconds, for Hebrew prose ("כל 3 שניות"). */
export const HERO_SLIDE_INTERVAL_SECONDS = HERO_SLIDE_INTERVAL_MS / 1000;
