import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { rangeableVideoSrc } from "@/lib/video-range";

/**
 * The owner's own store film: "סרטון לאתר" in the photographer's shared Drive
 * folder (June 2026), 42 s of the shop's stock and the laser engraver at work,
 * shot vertically for a phone, with a music track. Encoded for the web as
 * 720x1280 H.264 + AAC, about 5.6 MB.
 *
 * Loading follows <LazyReel> on the homepage: nothing is fetched until the
 * block is within 200px of the viewport, and the poster is the clip's own first
 * frame, so the tile is never blank while the video buffers.
 *
 * Playback:
 *   • It plays muted and looped only while on screen, and pauses when scrolled
 *     away, so an off-screen loop does not keep burning a phone's battery.
 *   • Sound is opt-in through its own button. Browsers refuse unmuted autoplay
 *     anyway, and a store page that starts playing music unasked is hostile.
 *   • A visible pause button, because a looping clip longer than five seconds
 *     needs one (WCAG 2.2.2).
 *   • "Reduce motion" means no autoplay. The poster stays until the visitor
 *     presses play.
 * Both controls are 44px targets and announce their state in Hebrew.
 */
export function StoreVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const reduceMotion = useRef(false);
  // The visitor paused it on purpose: do not resume when it scrolls back in.
  const userPaused = useRef(false);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting);
        if (on) setNear(true);
        setInView(on);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !near) return;
    if (!inView) {
      v.pause();
      return;
    }
    if (!userPaused.current && !reduceMotion.current) v.play().catch(() => {});
  }, [near, inView]);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (!near) setNear(true);
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    // Turning the sound on is a request to hear it, so start it if it was stopped.
    if (!next && v.paused) {
      userPaused.current = false;
      if (!near) setNear(true);
      v.play().catch(() => {});
    }
  }

  const control =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-black/55 text-white backdrop-blur-md transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40";

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[20rem] overflow-hidden rounded-[1.5rem] border border-gold/40 bg-muted shadow-[var(--shadow-card)] md:max-w-[22rem]">
      <video
        ref={ref}
        // /v/ in production: the byte-range path iOS Safari needs (video-range.ts).
        src={near ? rangeableVideoSrc(src) : undefined}
        poster={poster}
        muted={muted}
        loop
        playsInline
        preload={near ? "metadata" : "none"}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute bottom-3 start-3 flex gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "השהיית הסרטון" : "הפעלת הסרטון"}
          className={control}
        >
          {playing ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "הפעלת קול" : "השתקת קול"}
          aria-pressed={!muted}
          className={control}
        >
          {muted ? (
            <VolumeX className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
