// The homepage hero's photography: the owner's own golden-hour shoot (see
// public/product-photos/drive-2026-08/README.md), cross-fading slowly with a
// gentle push-in on the frame that is showing.
//
// It replaced a product-mosaic video (2026-10): a fast montage of white
// catalogue shots, some still carrying "image for demonstration purposes"
// stamps, that read as cheap at exactly the moment a stranger decides whether
// to trust the shop. These frames are real tallitot on a real person — the
// product in use, which a catalogue mosaic cannot show.
//
// Decorative, like the video was: the type beside it says everything the
// pictures do, so the whole stack is aria-hidden and the alt texts are empty.
//
// Motion rules (WCAG 2.2.2, and the accessibility statement §4.5):
// - prefers-reduced-motion: the first frame only, no cycling, no push-in.
// - Otherwise a visible pause control (rendered by the caller, driven by
//   `paused`) stops the cycle on the current frame.
// - A hidden tab stops cycling, so the visitor does not come back mid-fade.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DIR = "/product-photos/drive-2026-08";

/** Order matters: the first frame is the LCP paint and the reduced-motion
 *  still, so it is the strongest single image of the set. `pos` keeps the face
 *  in frame when object-cover crops a portrait photo to a wider box. */
export const HERO_SLIDES = [
  { file: "photo-2026-08-16-17-39-57_3", pos: "50% 28%" },
  { file: "hero-2026-08-16-09", pos: "50% 25%" },
  { file: "photo-2026-08-16-17-39-56_2", pos: "50% 30%" },
  { file: "photo-2026-08-16-17-39-56_4", pos: "50% 25%" },
] as const;

export const heroSrc = (file: string, w?: 768 | 1024) => `${DIR}/${file}${w ? `-${w}w` : ""}.webp`;
export const heroSrcSet = (file: string) =>
  `${heroSrc(file, 768)} 768w, ${heroSrc(file, 1024)} 1024w, ${heroSrc(file)} 1086w`;
/** Full-bleed under lg; the arched frame takes about 42% of the row above it. */
export const HERO_SIZES = "(min-width: 1024px) 42vw, 100vw";

const SLIDE_MS = 6500;

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Whether the frames cycle at all. False on the server and for
 *  reduced-motion visitors, so the caller shows no pause control then. */
export function useHeroCycles() {
  const [cycles, setCycles] = useState(false);
  useEffect(() => setCycles(!reducedMotion()), []);
  return cycles;
}

export function HeroSlides({
  paused,
  cycles,
  className,
}: {
  paused: boolean;
  cycles: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!cycles || paused) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      id ??= setInterval(() => setActive((i) => (i + 1) % HERO_SLIDES.length), SLIDE_MS);
    };
    const stop = () => {
      if (id !== undefined) clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cycles, paused]);

  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 overflow-hidden bg-[#3b2a17]", className)}
    >
      {HERO_SLIDES.map((s, i) => {
        const on = i === active;
        return (
          <img
            key={s.file}
            src={heroSrc(s.file, 1024)}
            srcSet={heroSrcSet(s.file)}
            sizes={HERO_SIZES}
            alt=""
            width={1086}
            height={1448}
            decoding="async"
            // The first frame is the LCP element: eager and high priority. The
            // rest wait their turn — they are needed 6.5s apart at the soonest.
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 h-full w-full object-cover will-change-[opacity,transform]"
            style={{
              objectPosition: s.pos,
              opacity: on ? 1 : 0,
              // A slow push-in on the showing frame; the outgoing one keeps its
              // scale while it fades, so nothing snaps back mid-transition.
              transform: cycles && on ? "scale(1.07)" : "scale(1)",
              transition: cycles
                ? `opacity 1400ms ease-in-out, transform ${SLIDE_MS + 1400}ms linear`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
