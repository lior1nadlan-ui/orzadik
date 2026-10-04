// The music button: one round toggle beside the accessibility button. Plays the
// licensed track from src/lib/site-music.ts on a tap and mutes it on the next.
//
// Never starts by itself on a first visit — browsers block audible autoplay,
// and the accessibility statement (§4.5) promises no sound without the
// visitor's action. A visitor who turned it on keeps it on: the choice is
// remembered, the audio element lives in the root layout so it plays on across
// page changes, and on a later visit it resumes at their first tap or key
// press anywhere. It pauses while the tab is hidden and resumes on return.

import { useEffect, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { MUSIC_PREF_KEY, MUSIC_VOLUME, SITE_MUSIC } from "@/lib/site-music";

function readPref(): boolean {
  try {
    return localStorage.getItem(MUSIC_PREF_KEY) === "on";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(MUSIC_PREF_KEY, on ? "on" : "off");
  } catch {
    /* private mode: the choice simply isn't remembered */
  }
}

export function SiteMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const audio = () => {
    if (!audioRef.current && SITE_MUSIC) {
      const a = new Audio(SITE_MUSIC.src);
      a.loop = true;
      a.preload = "none";
      a.volume = MUSIC_VOLUME;
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const play = () => {
    audio()
      ?.play()
      .catch(() => setPlaying(false));
  };

  // Returning visitor who left it on: resume at their first interaction.
  useEffect(() => {
    if (!SITE_MUSIC || !readPref()) return;
    const resume = () => play();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

  // Quiet while the tab is in the background.
  useEffect(() => {
    let wasPlaying = false;
    const onVisibility = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.hidden) {
        wasPlaying = !a.paused;
        a.pause();
      } else if (wasPlaying) {
        play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      audioRef.current?.pause();
    };
  }, []);

  if (!SITE_MUSIC) return null;

  const toggle = (e: React.MouseEvent) => {
    // Don't let the "resume on first interaction" listener re-start what this
    // tap is pausing.
    e.stopPropagation();
    if (playing) {
      audioRef.current?.pause();
      writePref(false);
    } else {
      play();
      writePref(true);
    }
  };

  const label = playing ? "השתקת המוזיקה" : `השמעת «${SITE_MUSIC.title}»`;

  return (
    <button
      type="button"
      onClick={toggle}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={playing}
      aria-label={label}
      title={label}
      className={cn(
        "press fab-float fixed bottom-5 left-20 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold bg-card text-accent shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:[transform:scale(1.05)]",
      )}
    >
      {playing ? (
        <Music2 className="h-5 w-5 motion-safe:animate-pulse" aria-hidden="true" />
      ) : (
        <VolumeX className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
