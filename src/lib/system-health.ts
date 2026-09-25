// "מצב המערכת" — every automatic part of the shop, and whether it is actually
// doing its job. Pure: it takes configuration flags and a few timestamps and
// returns plain-language rows; the reading lives in system-health.functions.ts.
//
// WHY IT EXISTS. The costly failures in this shop were all SILENT:
//   • one cart reminder had ever been sent, across ten carts — cart reminders
//     need marketing consent, and nobody could see how few qualified;
//   • three paid orders sat unmarked as shipped for weeks — which ALSO meant
//     the tracking email never went out and the review request never could;
//   • instalments are built but dormant, so every buyer of a ₪1,400 tallit is
//     offered exactly one payment.
// None of that is visible on a normal admin screen. Each row here says what a
// part does, whether it is working, and — when it is not — what to do.

const DAY = 24 * 60 * 60 * 1000;

export type HealthStatus = "ok" | "warn" | "error" | "off";

export type HealthRow = {
  id: string;
  title: string;
  status: HealthStatus;
  detail: string;
  /** What to do about it, when there is something to do. */
  fix?: string;
};

export type HealthInput = {
  now: number;
  config: {
    email: boolean;
    ownerInbox: string | null;
    telegram: boolean;
    unsubscribeSecret: boolean;
    cardcom: boolean;
    maxPayments: number;
  };
  activity: {
    lastConfirmationEmail: string | null;
    lastCartReminder: string | null;
    lastPaymentReminder: string | null;
    lastReviewRequest: string | null;
    lastCampaignSent: string | null;
    shippedOrders: number;
    /** Paid orders not marked shipped, and the oldest one's payment date. */
    unshipped: { count: number; oldestPaidAt: string | null };
  };
  catalog: { noImage: number; outOfStock: number };
};

const dateHe = (iso: string) => new Date(iso).toLocaleDateString("he-IL");

function since(iso: string | null, now: number): string {
  if (!iso) return "עדיין לא";
  const days = Math.floor((now - Date.parse(iso)) / DAY);
  if (days <= 0) return `היום (${dateHe(iso)})`;
  if (days === 1) return `אתמול (${dateHe(iso)})`;
  return `לפני ${days} ימים (${dateHe(iso)})`;
}

export function buildHealthReport(h: HealthInput): HealthRow[] {
  const { now, config: c, activity: a } = h;
  const rows: HealthRow[] = [];

  rows.push(
    c.email
      ? {
          id: "email",
          title: "שליחת מיילים ללקוחות",
          status: "ok",
          detail: `אישורי הזמנה, מיילי משלוח ותזכורות יוצאים. אישור הזמנה אחרון: ${since(a.lastConfirmationEmail, now)}.`,
        }
      : {
          id: "email",
          title: "שליחת מיילים ללקוחות",
          status: "error",
          detail: "לא מוגדר — לקוחות לא מקבלים אישור הזמנה, מייל משלוח או תזכורות.",
          fix: "להגדיר RESEND_API_KEY ו-ORDER_EMAIL_FROM ב-Worker.",
        },
  );

  rows.push({
    id: "telegram",
    title: "התראות לטלפון (טלגרם)",
    status: c.telegram ? "ok" : "warn",
    detail: c.telegram
      ? "הזמנות, פניות, חוות דעת וסיכום הבוקר מגיעים לטלגרם."
      : "לא מוגדר — הכל מגיע רק למייל.",
    ...(c.telegram ? {} : { fix: "לפתוח את מסך ההתראות ולהשלים את ההגדרה." }),
  });

  rows.push(
    c.unsubscribeSecret
      ? {
          id: "unsubscribe",
          title: "קישור הסרה במיילים",
          status: "ok",
          detail: "מוגדר — אפשר לשלוח דיוור, תזכורות עגלה ובקשות חוות דעת כחוק.",
        }
      : {
          id: "unsubscribe",
          title: "קישור הסרה במיילים",
          status: "error",
          detail:
            "חסר UNSUBSCRIBE_SECRET — תזכורות עגלה, בקשות חוות דעת ודיוור לא יוצאים בכלל, כי אסור לשלוח אותם בלי קישור הסרה.",
          fix: "להגדיר UNSUBSCRIBE_SECRET ב-Worker.",
        },
  );

  rows.push(
    c.cardcom
      ? {
          id: "cardcom",
          title: "סליקה (קארדקום)",
          status: "ok",
          detail: "המסוף מוגדר ולקוחות יכולים לשלם באשראי.",
        }
      : {
          id: "cardcom",
          title: "סליקה (קארדקום)",
          status: "error",
          detail: "המסוף לא מוגדר — אי אפשר לשלם באתר.",
          fix: "להגדיר CARDCOM_TERMINAL_NUMBER ו-CARDCOM_API_NAME.",
        },
  );

  rows.push(
    c.maxPayments > 1
      ? {
          id: "installments",
          title: "תשלומים",
          status: "ok",
          detail: `עמוד התשלום מציע עד ${c.maxPayments} תשלומים ללא עמלה ללקוח.`,
        }
      : {
          id: "installments",
          title: "תשלומים",
          status: "off",
          detail:
            'כבוי — כל לקוח יכול לשלם רק בתשלום אחד, גם על טלית של ₪1,400. בקטגוריה הזו "אפשר בתשלומים?" מכריע הרבה קניות. הקוד כבר מוכן.',
          fix: 'לבדוק בקארדקום: (1) תשלומים מאושרים במסוף ועד כמה; (2) "עמלה על חשבון הלקוח" כבויה. אחר כך להפעיל את VITE_CARDCOM_MAX_PAYMENTS עם המספר.',
        },
  );

  // Shipping hygiene first among the jobs: it gates two of them.
  const oldest = a.unshipped.oldestPaidAt;
  const oldestDays = oldest ? Math.floor((now - Date.parse(oldest)) / DAY) : 0;
  rows.push(
    a.unshipped.count === 0
      ? {
          id: "shipping",
          title: "סימון הזמנות כנשלחו",
          status: "ok",
          detail: "אין הזמנות ששולמו ומחכות לסימון.",
        }
      : {
          id: "shipping",
          title: "סימון הזמנות כנשלחו",
          status: oldestDays >= 7 ? "error" : "warn",
          detail: `${a.unshipped.count} הזמנות ששולמו לא סומנו כנשלחו (הוותיקה מ-${since(oldest, now)}). כל עוד לא מסמנים: הלקוח לא מקבל מייל עם מספר מעקב, ובקשת חוות הדעת לא יכולה לצאת.`,
          fix:
            oldestDays >= 7
              ? 'בהזמנות: מה שיוצא עכשיו — "סמן כנשלחה" עם מספר מעקב. מה שכבר אצל הלקוח — "כבר נמסרה ללקוח" עם יום המשלוח: בלי מייל "בדרך", ובקשת חוות הדעת יוצאת לפי אותו יום.'
              : 'בהזמנות: "סמן כנשלחה" עם מספר מעקב.',
        },
  );

  rows.push({
    id: "review-requests",
    title: "בקשות חוות דעת אוטומטיות",
    status: !c.email || !c.unsubscribeSecret ? "error" : a.shippedOrders === 0 ? "warn" : "ok",
    detail:
      a.shippedOrders === 0
        ? "עוד לא יצאה אף בקשה — הן נשלחות 7 ימים אחרי שהזמנה מסומנת כנשלחה, ואף הזמנה עוד לא סומנה."
        : `נשלחות 7 ימים אחרי משלוח. אחרונה: ${since(a.lastReviewRequest, now)}.`,
  });

  rows.push({
    id: "cart-reminders",
    title: "תזכורות עגלה נטושה",
    status: !c.email || !c.unsubscribeSecret ? "error" : "ok",
    detail: `יוצאות רק למי שאישר דיוור (כך מחייב החוק). אחרונה: ${since(a.lastCartReminder, now)}.`,
  });

  rows.push({
    id: "payment-reminders",
    title: "תזכורת להשלמת תשלום",
    status: c.email ? "ok" : "error",
    detail: `מייל אחד להזמנה שלא שולמה, שעתיים עד 3 ימים אחריה. אחרונה: ${since(a.lastPaymentReminder, now)}.`,
  });

  rows.push({
    id: "campaigns",
    title: "דיוור",
    status: "ok",
    detail: `קמפיין אחרון שנשלח: ${since(a.lastCampaignSent, now)}.`,
  });

  const cat = h.catalog;
  rows.push({
    id: "catalog",
    title: "קטלוג",
    status: cat.noImage > 0 ? "warn" : "ok",
    detail:
      cat.noImage > 0
        ? `${cat.noImage} מוצרים פעילים בלי תמונה — מוצר בלי תמונה כמעט לא נמכר. ${cat.outOfStock} מוצרים מסומנים אזל מהמלאי.`
        : `לכל המוצרים הפעילים יש תמונה. ${cat.outOfStock} מוצרים מסומנים אזל מהמלאי.`,
    ...(cat.noImage > 0 ? { fix: "להוסיף תמונות במסך המוצרים, מהנמכרים ביותר." } : {}),
  });

  return rows;
}

/** Worst first, so the screen opens on what needs doing. */
export function sortByUrgency(rows: HealthRow[]): HealthRow[] {
  const rank: Record<HealthStatus, number> = { error: 0, warn: 1, off: 2, ok: 3 };
  return [...rows].sort((x, y) => rank[x.status] - rank[y.status]);
}
