// Background music for the shop — a single licensed track, played only when a
// visitor taps the music button (src/components/SiteMusicPlayer.tsx) and
// credited in the footer.
//
// OFF until the owner supplies a track they hold the rights to. A commercial
// site playing a song is a public performance: it needs a licence from ACUM
// (אקו"ם) or written permission from the artist/label, kept on file. While
// SITE_MUSIC is null the button and the credit line do not render at all.
//
// To turn it on: put the file in public/music/ (MP3, ideally ≤3MB — it is
// fetched only when someone presses play) and fill in the fields below.

export type SiteMusic = {
  /** Path under public/, e.g. "/music/track.mp3". */
  src: string;
  /** Song title as it should appear in the credit. */
  title: string;
  /** Performer / composer for the credit, e.g. "ישי ריבו". */
  artist: string;
  /** How the right to play it was obtained, shown with the credit,
   *  e.g. "מושמע באישור אקו״ם" or "באדיבות האמן". */
  license: string;
};

export const SITE_MUSIC: SiteMusic | null = null;

export const MUSIC_PREF_KEY = "site-music";
/** Background level: present, not loud. */
export const MUSIC_VOLUME = 0.35;

/** One line for the footer: «title» – artist · license. */
export function musicCredit(m: SiteMusic): string {
  return `מוזיקה באתר: «${m.title}» – ${m.artist} · ${m.license}`;
}
