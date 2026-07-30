import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MobileCarousel } from "@/components/MobileCarousel";
import { Sparkles, Gift, PackageSearch, BellRing, BadgePercent } from "lucide-react";
import { MEMBER_DISCOUNT } from "@/lib/pricing";

/** Rendered from the constant the checkout actually applies, so the promise on
 *  this page can never drift from the discount the server gives. */
const MEMBER_PCT = Math.round(MEMBER_DISCOUNT * 100);

export const Route = createFileRoute("/club")({
  component: ClubPage,
  head: () => ({
    meta: [
      { title: "מועדון אור זרוע — חברות חינם" },
      {
        name: "description",
        content:
          `הצטרפו בחינם למועדון אור זרוע לצדיק — ${MEMBER_PCT}% הנחה אוטומטית על כל הזמנה, מעקב הזמנות באזור האישי ועדכונים לפני כולם.`,
      },
      { property: "og:title", content: "מועדון אור זרוע — חברות חינם" },
      {
        property: "og:description",
        content: `חברות חינם, ${MEMBER_PCT}% הנחה אוטומטית על כל הזמנה ומעקב הזמנות.`,
      },
      { property: "og:url", content: "https://orzadik.com/club" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/club" }],
  }),
});

const BENEFITS = [
  {
    icon: BadgePercent,
    title: `${MEMBER_PCT}% הנחה על כל הזמנה`,
    body: `ההנחה מחושבת אוטומטית בקופה לכל חבר מועדון מחובר — על כל הזמנה, בלי קוד קופון ובלי מינימום.`,
  },
  {
    icon: PackageSearch,
    title: "מעקב הזמנות באזור האישי",
    body: "כל ההזמנות שלכם, סטטוס המשלוח ומספרי המעקב — במקום אחד.",
  },
  {
    icon: Gift,
    title: "עטיפת מתנה והקדשה בחינם",
    body: "כל הזמנה יכולה לצאת ארוזה כמתנה, עם הקדשה אישית מודפסת, ללא תוספת מחיר — גם ללא הרשמה.",
  },
  {
    icon: BellRing,
    title: "תוכן ועדכונים לפני כולם",
    body: "מדריכים לקראת החגים ופריטים חדשים — למי שבחר לקבל דיוור. אפשר להסיר בכל רגע.",
  },
];

const FAQ = [
  {
    q: "כמה עולה החברות?",
    a: "כלום. ההצטרפות והחברות חינמיות לחלוטין — צריך רק ליצור חשבון באתר.",
  },
  {
    q: "איך מקבלים את ההטבות?",
    a: "ההטבות מחושבות אוטומטית בקופה אחרי התחברות לחשבון. אין צורך בקוד קופון — פשוט התחברו לפני שמשלימים את ההזמנה.",
  },
  {
    q: "אני חייב לקבל מיילים?",
    a: "לא. דיוור שיווקי הוא הסכמה נפרדת ואופציונלית לגמרי, ואפשר להסיר את עצמכם בכל רגע דרך הקישור שבתחתית כל הודעה.",
  },
];

function ClubPage() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero — a glass panel floating on the page's light mesh. The old dark
          argaman band is gone; every descendant that used to rely on a dark
          ground (gold-bright / cream) is now a light-ground token. */}
      <section className="container mx-auto px-4 pt-10 md:pt-14">
        <div className="glass glass-gold reveal mx-auto max-w-3xl px-6 py-14 md:px-14 md:py-20 text-center [--glass-radius:1.5rem]">
          <div className="hairline-gold inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs tracking-[0.2em] text-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            חברות חינם
          </div>
          <h1 className="mt-5 font-display text-3xl md:text-5xl font-bold text-foreground">
            מועדון <span className="text-accent">אור זרוע</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
            מעקב הזמנות באזור האישי, עטיפת מתנה עם הקדשה, והטבות לחברי מועדון —
            ללא עלות ובלי אותיות קטנות.
          </p>
          <div className="mt-8">
            {user ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-lg font-semibold text-accent">
                  את/ה כבר חבר/ת מועדון ✓
                </div>
                <Link to="/account" className="press inline-block">
                  <Button className="bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong">
                    לאזור האישי
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Link to="/auth" className="press inline-block">
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong px-10"
                  >
                    הצטרפו עכשיו — חינם
                  </Button>
                </Link>
                <span className="text-xs text-muted-foreground">
                  נרשמים פעם אחת, וההטבות מחכות בקופה בכל הזמנה.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 max-w-4xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-foreground">
          מה מקבלים
        </h2>
        <MobileCarousel basis="basis-4/5" mdGrid="md:grid-cols-2" mdGap="md:gap-5" className="mt-8">
          {BENEFITS.map((b) => (
            <div key={b.title} className="glass glass-lift h-full p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <b.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-3 font-display text-lg text-foreground">{b.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{b.body}</p>
            </div>
          ))}
        </MobileCarousel>

        {/* Decorative ornament. The aria-hidden wrapper is load-bearing for the
            page's Accessibility 100 — the ✦ and the gold rules are pure
            decoration and must stay out of the accessibility tree. */}
        <div className="mt-14 flex items-center gap-4" aria-hidden="true">
          <span className="gold-rule flex-1" />
          <span className="text-gold text-xs">✦</span>
          <span className="gold-rule flex-1" />
        </div>

        <h2 className="mt-12 font-display text-2xl md:text-3xl font-bold text-center text-foreground">
          שאלות נפוצות
        </h2>
        <dl className="mt-8 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="glass p-5">
              <dt className="font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>

        {!user && (
          <div className="mt-12 text-center">
            <Link to="/auth" className="press inline-block">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong px-10"
              >
                הצטרפו עכשיו — חינם
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
