// An influencer's own report: how their coupon code is doing. Reached only by
// the private link the owner creates in /admin/coupons ("קישורים" → "דוח אישי
// למפורסם"). Shows aggregates of the code's paid orders and the commission
// payments — never anything about a customer. See src/lib/partner.functions.ts.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { getPartnerReport } from "@/lib/partner.functions";
import { COUPON_STATUS_HE, hebrewMonth, PARTNER_TOKEN_RE } from "@/lib/coupons";
import { formatILS } from "@/lib/cart";
import { BUSINESS } from "@/lib/business";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/partner/$token")({
  component: PartnerPage,
  head: () => ({
    meta: [
      { title: "הדוח שלך | אור זרוע לצדיק" },
      // A private page: never in search results, never followed.
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
});

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("לא ניתן להעתיק — סמנו והעתיקו ידנית.");
  }
}

const dateIL = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl hairline bg-card px-3 py-3 text-center">
      <div className={`text-lg font-bold ${strong ? "text-accent" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PartnerPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getPartnerReport);
  const valid = PARTNER_TOKEN_RE.test(token);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["partner-report", token],
    queryFn: () => load({ data: { token } }),
    enabled: valid,
    retry: false,
  });

  const whatsapp = `https://wa.me/${BUSINESS.phone.replace(/\D/g, "")}`;

  if (!valid || (!isLoading && !isError && !data)) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">הקישור אינו פעיל</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ייתכן שהקישור הוחלף או בוטל. אפשר לבקש קישור עדכני מהחנות.
        </p>
        <Button asChild className="mt-6">
          <a href={whatsapp} target="_blank" rel="noreferrer">
            לכתוב לנו בוואטסאפ
          </a>
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        טוען את הדוח…
      </div>
    );
  }
  if (isError || !data) {
    const msg = (error as Error | null)?.message ?? "";
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">לא הצלחנו לטעון את הדוח</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {/[֐-׿]/.test(msg) ? msg : "נסו לרענן את העמוד בעוד רגע."}
        </p>
      </div>
    );
  }

  const r = data;
  const hasCommission = r.commissionPercent != null;
  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-10">
      <PageHeader
        eyebrow="הדוח שלך"
        title={r.influencerName ? `שלום ${r.influencerName}` : `הקוד ${r.code}`}
        sub="כך הקוד שלך עובד באור זרוע לצדיק. רק הזמנות ששולמו נספרות, והנתונים מתעדכנים בכל כניסה."
      />

      <section className="rounded-xl hairline bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => copy(r.code, `הקוד ${r.code} הועתק`)}
              className="flex items-center gap-1.5 text-2xl font-bold"
              dir="ltr"
              title="העתקת הקוד"
            >
              {r.code}
              <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
            <div className="text-sm font-semibold text-accent">{r.offer}</div>
            <div className="text-xs text-muted-foreground">
              {r.minOrder != null && `בקנייה מ-${formatILS(r.minOrder)} · `}
              {r.endsAt ? `בתוקף עד ${dateIL(r.endsAt)} · ` : ""}
              {COUPON_STATUS_HE[r.status]}
            </div>
          </div>
          <Button variant="outline" onClick={() => copy(r.shopLink, "הקישור לשיתוף הועתק")}>
            העתקת קישור לשיתוף
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          מי שנכנס דרך הקישור מקבל את ההנחה בקופה בלי להקליד את הקוד.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="הזמנות ששולמו" value={String(r.paidOrders)} />
        <Stat label="מכירות (ללא משלוח)" value={formatILS(r.sales)} />
        <Stat label="הנחה שקיבלו הלקוחות" value={formatILS(r.discountGiven)} />
        {hasCommission && (
          <>
            <Stat
              label={`העמלה שלך (${r.commissionPercent}%)`}
              value={formatILS(r.commission)}
              strong
            />
            <Stat label="שולם לך" value={formatILS(r.paidOut)} />
            <Stat
              label={r.balance >= 0 ? "יתרה לתשלום" : "שולם מראש"}
              value={formatILS(Math.abs(r.balance))}
              strong={r.balance > 0}
            />
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-bold">לפי חודשים</h2>
        {r.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">עוד אין הזמנות ששולמו עם הקוד.</p>
        ) : (
          <div className="overflow-hidden rounded-xl hairline">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="p-2.5 font-medium">חודש</th>
                  <th className="p-2.5 font-medium">הזמנות</th>
                  <th className="p-2.5 font-medium">מכירות</th>
                  {hasCommission && <th className="p-2.5 font-medium">עמלה</th>}
                </tr>
              </thead>
              <tbody>
                {r.months.map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="p-2.5">{hebrewMonth(m.month)}</td>
                    <td className="p-2.5">{m.orders}</td>
                    <td className="p-2.5 whitespace-nowrap">{formatILS(m.sales)}</td>
                    {hasCommission && (
                      <td className="p-2.5 whitespace-nowrap">{formatILS(m.commission)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hasCommission && r.payouts.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">תשלומים שקיבלת</h2>
          <ul className="divide-y rounded-xl hairline bg-card text-sm">
            {r.payouts.map((p, i) => (
              <li key={`${p.paidAt}-${i}`} className="flex justify-between px-3 py-2.5">
                <span>
                  {new Intl.DateTimeFormat("he-IL").format(new Date(`${p.paidAt}T12:00:00`))}
                </span>
                <span className="font-semibold">{formatILS(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        שאלות על הדוח או על התשלום?{" "}
        <a href={whatsapp} target="_blank" rel="noreferrer" className="text-accent underline">
          כתבו לנו בוואטסאפ
        </a>
      </p>
    </div>
  );
}
