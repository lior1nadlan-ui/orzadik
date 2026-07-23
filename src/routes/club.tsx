import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MobileCarousel } from "@/components/MobileCarousel";
import { Sparkles, Gift, PackageSearch, BellRing, BadgePercent } from "lucide-react";

export const Route = createFileRoute("/club")({
  component: ClubPage,
  head: () => ({
    meta: [
      { title: "מועדון אור זרוע — חברות חינם" },
      {
        name: "description",
        content:
          "הצטרפו בחינם למועדון אור זרוע לצדיק — מעקב הזמנות באזור האישי, עטיפת מתנה והקדשה ללא עלות ועדכונים לפני כולם.",
      },
      { property: "og:title", content: "מועדון אור זרוע — חברות חינם" },
      {
        property: "og:description",
        content: "חברות חינם, מעקב הזמנות והטבות לחברי מועדון.",
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
    title: "הטבות לחברי מועדון",
    body: "הטבות החברים מחושבות אוטומטית בקופה לאחר התחברות לחשבון.",
  },
  {
    icon: PackageSearch,
    title: "מעקב הזמנות באזור האישי",
    body: "כל ההזמנות שלכם, סטטוס המשלוח ומספרי המעקב — במקום אחד.",
  },
  {
    icon: Gift,
    title: "עטיפת מתנה והקדשה בחינם",
    body: "כל הזמנה יכולה לצאת ארוזה כמתנה, עם הקדשה אישית מודפסת, ללא תוספת מחיר.",
  },
  {
    icon: BellRing,
    title: "עדכונים לפני כולם",
    body: "מבצעים ופריטים חדשים — למי שבחר לקבל דיוור. אפשר להסיר בכל רגע.",
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
      {/* Hero band — the site-wide dark argaman idiom with gold emphasis. */}
      <section className="bg-argaman-deep text-cream">
        <div className="container mx-auto px-4 py-16 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-bright/40 px-4 py-1 text-xs tracking-[0.2em] text-gold-bright">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            חברות חינם
          </div>
          <h1 className="mt-5 font-display text-3xl md:text-5xl font-bold">
            מועדון <span className="text-gold-bright">אור זרוע</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base md:text-lg text-cream/85 leading-relaxed">
            מעקב הזמנות באזור האישי, עטיפת מתנה עם הקדשה, והטבות לחברי מועדון —
            ללא עלות ובלי אותיות קטנות.
          </p>
          <div className="mt-8">
            {user ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-lg font-semibold text-gold-bright">
                  את/ה כבר חבר/ת מועדון ✓
                </div>
                <Link to="/account">
                  <Button className="bg-gold-bright text-argaman-deep hover:bg-gold-bright/90">
                    לאזור האישי
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="bg-gold-bright text-argaman-deep hover:bg-gold-bright/90 px-10"
                  >
                    הצטרפו עכשיו — חינם
                  </Button>
                </Link>
                <span className="text-xs text-cream/70">
                  נרשמים פעם אחת, וההטבות מחכות בקופה בכל הזמנה.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 max-w-4xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center">מה מקבלים</h2>
        <MobileCarousel basis="basis-4/5" mdGrid="md:grid-cols-2" mdGap="md:gap-5" className="mt-8">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-lg border border-gold/40 bg-gradient-to-br from-cream to-white p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <b.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-3 font-display text-lg">{b.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{b.body}</p>
            </div>
          ))}
        </MobileCarousel>

        <div className="mt-14 flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <span className="text-gold text-xs">✦</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        <h2 className="mt-12 font-display text-2xl md:text-3xl font-bold text-center">
          שאלות נפוצות
        </h2>
        <dl className="mt-8 space-y-5">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-lg border bg-card p-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>

        {!user && (
          <div className="mt-12 text-center">
            <Link to="/auth">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-10">
                הצטרפו עכשיו — חינם
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
