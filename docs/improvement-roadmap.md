# תוכנית שיפור האתר — "אור זרוע לצדיק"

> נבנתה מסקירה אוטומטית מרובת־סוכנים (7 ממדים: אבטחה, באגים, ביצועים, SEO, נגישות/RTL, המרה, איכות קוד) + אימות ידני מול הקוד.
> עודכן: 5.7.2026

## ✅ יושם בסבב זה (5.7.2026)

| פריט | מה נעשה | קבצים |
|------|---------|-------|
| 1.1 | מיילים טרנזקציוניים אמיתיים (Resend REST, מאחורי ENV, fallback בטוח) | `order-emails.server.ts` |
| 1.2 | העגלה כבר לא נמחקת לפני התשלום — רק אחרי `paid` | `checkout.tsx`, `order.$id.tsx` |
| 1.3 | חסימת שינוי `is_member` ע"י המשתמש (טריגר DB) | מיגרציה `20260705120000_*` |
| 1.4 | עמוד הזמנה מבחין בין "שולם" ל"ממתין לתשלום" | `order.$id.tsx` |
| 1.5 | הגבלת קצב לפי IP + נרמול אימייל | `rate-limit.server.ts`, `checkout.functions.ts` |
| 2.1 | SSR לעמודי מוצר/קטגוריה (`useLoaderData` → `initialData`) | `product.$slug.tsx`, `category.$slug.tsx` |
| 2.2 | וידאו Hero `preload=metadata` + reels ב-lazy (IntersectionObserver) | `index.tsx` |
| 2.3 | חסימת "אזל מהמלאי" בכרטיס מוצר | `ProductCard.tsx`, `shop.tsx` |
| 2.4 | אותות אמון בקופה | `checkout.tsx` |
| 2.7 | rollback מפצה למניעת הזמנה יתומה | `checkout.functions.ts` |
| 2.8 | `priceValidUntil` ל-Offer | `product.$slug.tsx` |
| 3.1 | קישור "דלג לתוכן" | `__root.tsx` |
| 3.2 | `staleTime`/`refetchOnWindowFocus` ל-QueryClient | `router.tsx` |
| 3.3 | הכנסות אדמין = הזמנות ששולמו בלבד | `admin.index.tsx` |
| SEO | הסרת תגי hreflang שגויים | `__root.tsx` |

## ✅ פריטים גדולים שיושמו (סבב 2)

| פריט | מה נעשה | קבצים |
|------|---------|-------|
| 2.6 | **חיפוש צד־שרת** על כל הקטלוג (שם + תיאורים + מק"ט) עם debounce ו-sanitization | `shop.tsx` |
| 3.4 | **מנגנון ביקורות מלא + כוכבים ב-SERP** — טבלה+RLS, שליחה ממותנת, מודרציה באדמין, תצוגה בעמוד מוצר, `AggregateRating` ב-JSON-LD, כוכבים ליד הכותרת | מיגרציה `reviews`, `reviews.functions.ts`, `ProductReviews.tsx`, `Stars.tsx`, `product.$slug.tsx`, `admin.reviews.tsx`, `admin.tsx` |
| 2.5 | **תזכורות עגלה נטושה** — שולח מייל לעגלות שלא הומרו (1–24ש'), אידמפוטנטי דרך `reminder_1_sent_at`, טריגר cron מאובטח ב-`CRON_SECRET` | `abandoned-cart.functions.ts`, `email.server.ts`, `api/cron/abandoned-cart-reminders.ts` |
| infra | הופרד helper מיילים משותף (Resend) | `email.server.ts` (משמש גם את `order-emails.server.ts`) |

## ✅ נגישות (תקן ישראלי 5568 / חוק שוויון זכויות) — סבב 3

| פריט | מה נעשה | קבצים |
|------|---------|-------|
| כפתור נגישות | **קיים וחוקי** — כפתור צף קבוע + תפריט התאמות (גודל טקסט, ניגודיות, גווני אפור, הדגשת קישורים, גופן קריא, עצירת אנימציות, סמן גדול) + קישור להצהרה | `AccessibilityWidget.tsx` |
| ניהול פוקוס | הוזרם פוקוס לתוך הדיאלוג, לכידת Tab, `aria-modal`, החזרת פוקוס לכפתור בסגירה | `AccessibilityWidget.tsx` |
| מצב ניגודיות | תיקון: המצב מדריס כעת גם את הזהב ה"קשיח" (`#D4AF37`) ל-`#5c4300` שעובר AA | `styles.css` |
| דיאלוג חיפוש | `role=dialog` + `aria-modal` + `label` נסתר | `SiteHeader.tsx` |
| גלריית מוצר | תוויות `aria-label`/`aria-pressed` לכפתורי התמונות הממוזערות | `product.$slug.tsx` |
| עמוד שגיאה | תורגם לעברית + `lang="he" dir="rtl"` | `error-page.ts` |
| הצהרת נגישות | קיימת ומלאה (חוק, ת"י 5568 AA, רכז נגישות, נוהל פניות) | `accessibility.tsx` |

> **חוקית:** האתר עומד בדרישות הליבה בישראל — כפתור/תפריט נגישות בכל עמוד, הצהרת נגישות עם רכז וזמן מענה, והצהרה על ת"י 5568 ברמת AA. יש לוודא שתיבת `accessibility@orzarua.co` פעילה (מופיע כבר ברשימת P0 של הבעלים).

---

## ✅ חוב טכני — סבב 4

| פריט | מה נעשה | קבצים |
|------|---------|-------|
| איחוד תמחור | לוגיקת המחיר (SITE_DISCOUNT/MEMBER/SHIPPING + הפונקציות) רוכזה ל**מקור אמת יחיד** שמשמש גם לקוח וגם שרת — סוף לקבועים כפולים עם "must match" | `pricing.ts` חדש; `cart.tsx`, `checkout.functions.ts` מייבאים ממנו |
| בדיקות אוטומטיות | הוקמה תשתית **Vitest** + 12 בדיקות על מתמטיקת הכסף (מחיר אפקטיבי, הנחת חבר, משלוח, והתאמת סכום לקוח↔שרת) — **`npm test`**. הקוד שמטפל בכסף היה ללא כיסוי | `vitest.config.ts`, `pricing.test.ts`, `package.json` |

> הרצת הבדיקות: `npm test` (12/12 עוברות). דורש `npm install` (נוסף `vitest` ל-devDependencies).

---

## 📋 הגדרות שנותרו לבעלים (Supabase + Resend)

**מיגרציות להריץ (Supabase):**
- `20260705120000_guard_profiles_is_member.sql`
- `20260705130000_create_reviews.sql`

**לאחר המיגרציות:** להריץ מחדש את מחולל ה-types של Supabase (מנקה גם את שגיאות ה-`articles` הישנות). *הערה:* עדכנתי ידנית את `types.ts` עבור `reviews`, `increment_rate_limit` ו-`contact_consent` כדי שהקוד יעבור typecheck — regeneration רשמי יחליף זאת בצורה מדויקת.

**משתני סביבה (ENV):**
- `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (שולח מאומת), `SHOP_OWNER_EMAIL`
- `CARDCOM_ALLOWED_IPS` (רשימת IP של Cardcom)
- `CRON_SECRET` (סוד לטריגר התזכורות)

**Cron לתזכורות עגלה נטושה:** לתזמן קריאה שעתית ל:
`GET https://orzarua.co/api/cron/abandoned-cart-reminders` עם כותרת `Authorization: Bearer $CRON_SECRET` (Cloudflare Cron Trigger / pg_cron+http / cron חיצוני).

**החלטה עסקית:** האם הנחת 5% לכל נרשם היא כוונה.

---

## דירוג לפי גלים

- **גל 1 — מיידי (P0):** סיכון כספי/אמון ישיר, זול לתקן.
- **גל 2 — בקרוב (P1):** השפעה גבוהה על המרה, ביצועים ו־SEO.
- **גל 3 — בהמשך (P2):** חוב טכני, נגישות מלאה, פיצ'רים.

---

## גל 1 — מיידי (P0)

### 1.1 אין מיילים טרנזקציוניים כלל — לקוח לא מקבל אישור הזמנה ⚠️ קריטי
`sendOrderConfirmationEmails` ב-[order-emails.server.ts](src/lib/order-emails.server.ts:15) עושה רק `console.log`. אחרי תשלום מוצלח הלקוח **לא** מקבל אישור, והבעלים לא מקבל התראה על הזמנה חדשה. פוגע קשות באמון ובתפעול.
**תיקון:** לחבר ספק מייל (Resend/SES) + לאמת דומיין `orzarua.co`. להוסיף מייל אישור ללקוch + התראת בעלים. תשתית הקריאה כבר קיימת מה-webhook.
**מאמץ:** בינוני · **קבצים:** `order-emails.server.ts`, ENV.

### 1.2 העגלה נמחקת לפני שהתשלום הושלם
ב-[checkout.tsx:120](src/routes/checkout.tsx:120) קוראים `clear()` מיד אחרי יצירת דף התשלום, **לפני** ה-redirect ל-Cardcom. לקוח שנוטש בעמוד התשלום או נכשל — חוזר לעגלה ריקה ואינו יכול לנסות שוב בקלות. פוגע ישירות בשחזור הכנסה.
**תיקון:** לנקות עגלה רק אחרי אישור תשלום (ב-`order/$id` כשהסטטוס `paid`), לא לפני ה-redirect.
**מאמץ:** קטן · **קבצים:** `checkout.tsx`, `order.$id.tsx`.

### 1.3 משתמש יכול לשנות `is_member` של עצמו (הרשאות)
מדיניות ה-UPDATE ב-[profiles migration](supabase/migrations/20260607092033_f565329c-88fd-4b3f-9498-31063b050342.sql:67) היא `WITH CHECK (auth.uid() = id)` בלבד — מאפשרת עדכון **כל** עמודה בשורה, כולל `is_member`. בנוסף `handle_new_user` מגדיר `is_member=true` לכל נרשם, כך שהנחת ה-5% ניתנת לכולם.
**תיקון:** להגביל את עמודות ה-UPDATE (trigger שמונע שינוי `is_member`, או להעביר את הדגל לטבלה נפרדת מוגנת). להחליט האם 5% לכל נרשם זו כוונה עסקית.
**מאמץ:** קטן · **קבצים:** מיגרציה חדשה.

### 1.4 עמוד "תודה על ההזמנה" מוצג גם כשלא שולם
עמוד `order/$id` מציג הצלחה גם כש-`payment_status` אינו `paid`. יוצר בלבול ותלונות.
**תיקון:** להתנות את הודעת ההצלחה בסטטוס `paid`; אחרת להציג "ממתין לתשלום" + כפתור לנסות שוב.
**מאמץ:** קטן · **קבצים:** `order.$id.tsx`.

### 1.5 עקיפת הגבלת קצב הזמנות ע"י שינוי אימייל
`checkOrderRateLimit` ב-[checkout.functions.ts:52](src/lib/checkout.functions.ts:52) ממופתח לפי `customer_email` שמגיע מהלקוח — קל לעקוף עם אימייל שונה בכל בקשה. גם ההשוואה רגישת רישיות.
**תיקון:** להוסיף מגבלה לפי IP (בנוסף לאימייל), ולנרמל אימייל ל-lowercase.
**מאמץ:** קטן · **קבצים:** `checkout.functions.ts`, `rate-limit.server.ts`.

---

## גל 2 — בקרוב (P1)

### 2.1 עמודי מוצר וקטגוריה לא מרונדרים בשרת — HTML ראשוני "טוען..." 🔴 SEO
ה-loader ב-[product.$slug.tsx:48](src/routes/product.$slug.tsx:48) ו-[category.$slug.tsx:43](src/routes/category.$slug.tsx:43) משמש רק ל-head; הקומפוננטה שולפת שוב ב-`useQuery` (שורה 191), וללא אינטגרציית SSR ל-react-query — ב-SSR העמוד מוגש בלי H1/מחיר/תיאור. גם שליפה כפולה מ-Supabase.
**תיקון:** להשתמש ב-`Route.useLoaderData()` כמקור נתונים (כמו שכבר עובד ב-[articles/$slug.tsx:67](src/routes/articles/$slug.tsx:67)) או להעביר `initialData` ל-useQuery.
**מאמץ:** בינוני.

### 2.2 וידאו Hero ~20MB + 5 סרטוני אינסטגרם ~23MB נטענים אוטומטית 🔴 ביצועים
[index.tsx:229](src/routes/index.tsx:229) עם `preload="auto"` על וידאו כבד, ועוד 5 reels שמתנגנים אוטומטית. הורס LCP ומובייל.
**תיקון:** `preload="none"` + poster, טעינת reels ב-lazy (IntersectionObserver), דחיסה/המרה ל-WebM, `playsinline muted`.
**מאמץ:** בינוני · **קבצים:** `index.tsx`.

### 2.3 מוצר שאזל מהמלאי ניתן להוספה לעגלה
[ProductCard.tsx:78](src/components/ProductCard.tsx:78) מוסיף לעגלה ללא בדיקת `stock_status`. השרת חוסם רק בקופה ([checkout.functions.ts:81](src/lib/checkout.functions.ts:81)) — הלקוח מגלה מאוחר מדי.
**תיקון:** להעביר `stock_status` ל-ProductCard, לחסום/להסתיר "הוסף לעגלה", תג "אזל".
**מאמץ:** קטן.

### 2.4 חוסר אותות אמון בקופה
אין בקופה סמלי אבטחת תשלום, מדיניות החזרות/משלוח נראית לעין, או פרטי יצירת קשר. פוגע בהמרה.
**תיקון:** בלוק אמון בקופה (תשלום מאובטח Cardcom, מדיניות החזרות, זמני משלוח, ווטסאפ).
**מאמץ:** קטן · **קבצים:** `checkout.tsx`.

### 2.5 עגלה נטושה נשמרת אך לא נשלח מייל שחזור
[abandoned-cart.functions.ts](src/lib/abandoned-cart.functions.ts) שומר עגלות אך אין תהליך ששולח תזכורת (תלוי גם ב-1.1). זו הכנסה שנשארת על השולחן.
**תיקון:** אחרי חיבור המייל — cron/edge function ששולח תזכורת אחרי X שעות לעגלות `converted_order_id IS NULL`.
**מאמץ:** בינוני.

### 2.6 חיפוש חלש — התאמת שם בצד לקוח בלבד
החיפוש מוגבל להתאמת שם על התוצאות הטעונות בלבד; לא מחפש בכל הקטלוג/תיאורים.
**תיקון:** חיפוש צד־שרת (Postgres `ilike`/full-text עברי) עם דיבאונס.
**מאמץ:** בינוני.

### 2.7 `placeOrder` אינו אטומי
ב-[checkout.functions.ts:131-155](src/lib/checkout.functions.ts:131) ההזמנה נכנסת, ואז ה-`order_items` בנפרד — כשל בשלב השני משאיר הזמנה יתומה בלי פריטים.
**תיקון:** RPC/טרנזקציה אחת (Postgres function) ליצירת הזמנה+פריטים; לגלגל אחורה בכשל.
**מאמץ:** בינוני.

### 2.8 שיפורי Schema.org
`Article` חסר `publisher`/`dateModified`, `Offer` חסר `priceValidUntil`, ו-breadcrumb מופיע כפול (JSON-LD + microdata). סכמת `FAQPage` כבר קיימת ב-[index.tsx:112](src/routes/index.tsx:112) — לא לשכפל בעמודי מוצר.
**תיקון:** להשלים שדות חסרים, להסיר כפילות breadcrumb.
**מאמץ:** קטן.

---

## גל 3 — בהמשך (P2)

### 3.1 נגישות (תקן ישראלי 5568 / WCAG 2.0 AA)
- **ניגודיות:** טקסט לבן על זהב `#D4AF37` ([ProductCard.tsx:24](src/components/ProductCard.tsx:24)) נכשל ביחס ניגודיות — להכהות ל-`#A8862A` או טקסט כהה.
- קישור "דילוג לתוכן" + מקשי גישה.
- ווידג'ט נגישות: ניהול פוקוס בדיאלוג, מצב ניגודיות גבוהה תקין.
- אוברליי החיפוש כדיאלוג נגיש (focus trap, Esc, aria).
- תוויות (`aria-label`) לכפתורי תמונות ממוזערות בגלריית המוצר.
- עמוד שגיאה גלובלי — לתרגם לעברית + `lang="he" dir="rtl"`.
- מרחבי Tailwind לוגיים (`ps/pe/ms/me`) במקום פיזיים (`pl/pr`).
**מאמץ:** בינוני (מצטבר).

### 3.2 ביצועי נתונים ו-caching
- `QueryClient` ללא `staleTime` — רה-פetch בכל focus. להגדיר `staleTime` סביר ([router.tsx](src/router.tsx)).
- מפל שאילתות בדף מוצר (~5 round-trips) — לאחד.
- `Cache-Control` על דפי SSR ונכסים סטטיים.
- `/shop` שולף את כל המוצרים ללא עימוד — pagination/infinite scroll.
- תמונות קטגוריה כבדות (PNG בשם JPG) — להמיר ל-WebP + `srcset`.
**מאמץ:** בינוני.

### 3.3 חוב טכני / איכות קוד
- **אפס בדיקות** — כולל על קוד שמטפל בכסף. להוסיף בדיקות ל-`placeOrder`, חישובי מחיר, ו-webhook.
- כפילות לוגיקת תמחור בין לקוח ([cart.tsx](src/lib/cart.tsx)) לשרת ([checkout.functions.ts](src/lib/checkout.functions.ts)) — מקור אמת יחיד משותף.
- `sale_price` נערך באדמין אך לא בשימוש בתצוגה — לחבר או להסיר.
- ~50 שימושי `any`; ESLint/TS מוקלים — להחמיר בהדרגה.
- דשבורד אדמין: ההכנסות כוללות הזמנות שלא שולמו — לסנן `payment_status='paid'`.
- [product.$slug.tsx](src/routes/product.$slug.tsx) בן ~819 שורות — לפצל לקומפוננטות.
**מאמץ:** גדול (מצטבר).

### 3.4 הוכחה חברתית וביקורות (הזדמנות SEO+המרה)
אין מנגנון ביקורות → אין כוכבים ב-SERP ואין אמון. פיצ'ר שלם: טבלת `reviews` + RLS, איסוף במייל אחרי אספקה, תצוגה בעמוד מוצר, ו-`aggregateRating`/`review` ב-Product JSON-LD.
**מאמץ:** גדול.

### 3.5 קשיחות webhook (הידוק)
ה-webhook ([cardcom-webhook.ts](src/routes/api/public/cardcom-webhook.ts)) בנוי טוב (idempotency, אימות S2S, בדיקת ReturnValue וסכום). לחיזוק: להגדיר בפועל `CARDCOM_ALLOWED_IPS` (כרגע fail-open), ולסגור מרוץ תאורטי ב-idempotency (שני webhooks במקביל) עם lock/עדכון מותנה.
**מאמץ:** קטן.

---

## סיכום עדיפות מהיר

| # | פריט | גל | מאמץ |
|---|------|----|----|
| 1.1 | חיבור מיילים טרנזקציוניים | P0 | בינוני |
| 1.2 | לא לנקות עגלה לפני תשלום | P0 | קטן |
| 1.3 | נעילת `is_member` (RLS) | P0 | קטן |
| 1.4 | "תודה" רק כששולם | P0 | קטן |
| 1.5 | rate-limit לפי IP + נרמול אימייל | P0 | קטן |
| 2.1 | SSR לעמודי מוצר/קטגוריה | P1 | בינוני |
| 2.2 | דחיית וידאו/reels כבדים | P1 | בינוני |
| 2.3 | חסימת "אזל" בכרטיס מוצר | P1 | קטן |
| 2.7 | `placeOrder` אטומי | P1 | בינוני |
