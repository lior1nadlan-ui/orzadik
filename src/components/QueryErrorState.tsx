/**
 * "The products did not load" — with a way to try again.
 *
 * WHY THIS IS A SHARED COMPONENT AND NOT TWO COPIES. /shop handled a failed
 * product query correctly (message + a retry button) while /category/$slug
 * destructured only `{ data: products = [] }`, so a failed query fell through
 * to the SAME empty-state card the page shows for a genuinely empty category —
 * telling the visitor "אין כרגע מוצרים בקטגוריה הזו" about a shop with 4,648
 * active products, with no retry and no hint that anything went wrong. The two
 * discovery pages disagreeing about what a network failure looks like is the
 * bug; one component both of them render is the fix.
 *
 * The copy deliberately does not blame the visitor's connection alone ("בדקו את
 * החיבור") without also offering the action — a shopper who reads only "check
 * your connection" and sees no button leaves.
 *
 * Purely presentational and SSR-safe: no hooks, no browser globals.
 */
export function QueryErrorState({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  /** Disables the button and swaps the label while a retry is in flight. */
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="glass max-w-2xl mx-auto my-12 text-center p-10 md:p-14 [--glass-radius:1.5rem]"
    >
      <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
        <span className="text-3xl" aria-hidden="true">
          ⚠️
        </span>
      </div>
      <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
        לא הצלחנו לטעון את המוצרים
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        זו תקלה זמנית אצלנו או בחיבור שלכם — המוצרים עדיין כאן.
      </p>
      {/* Same ink-on-white chip as the "load more" / pagination controls on both
          discovery pages, so a shopper meets one button family across the site. */}
      <button
        onClick={onRetry}
        disabled={retrying}
        className="press mt-6 rounded-full bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background disabled:opacity-60"
      >
        {retrying ? "טוען..." : "נסו שוב"}
      </button>
    </div>
  );
}
