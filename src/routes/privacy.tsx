import { createFileRoute } from "@tanstack/react-router";
import { BUSINESS, LEGAL_LAST_UPDATED } from "@/lib/business";

// Stable anchor ids for each section, single-sourced here so the table of
// contents and the section headings can never drift: the TOC renders from this
// list, and <Section> looks its own id up by matching its title against it.
const SECTIONS: { id: string; title: string }[] = [
  { id: "klali", title: "1. כללי ותחולת המדיניות" },
  { id: "hagdarot", title: "2. הגדרות" },
  { id: "meida", title: "3. המידע שאנו אוספים" },
  { id: "matarot", title: "4. מטרות השימוש במידע והבסיס החוקי" },
  { id: "tzad-gimel", title: "5. מסירת מידע לצדדים שלישיים (מחזיקים וספקי שירות)" },
  { id: "haavara", title: "6. העברת מידע אל מחוץ לישראל" },
  { id: "cookies", title: "7. עוגיות (Cookies) וטכנולוגיות דומות" },
  { id: "avtacha", title: "8. אבטחת מידע" },
  { id: "divur", title: "9. דיוור ישיר ותכנים שיווקיים" },
  { id: "shmira", title: "10. תקופות שמירת המידע" },
  { id: "zchuyot", title: "11. זכויותיכם ביחס למידע" },
  { id: "ktinim", title: "12. קטינים" },
  { id: "shinuyim", title: "13. שינויים במדיניות הפרטיות" },
  { id: "din", title: "14. הדין החל, סמכות שיפוט ויצירת קשר" },
];

export const Route = createFileRoute("/privacy")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "מדיניות פרטיות | אור זרוע לצדיק" },
      {
        name: "description",
        content:
          "מדיניות הפרטיות של אור זרוע לצדיק — איסוף, שמירה, שימוש והעברת מידע, וזכויות המשתמש לפי חוק הגנת הפרטיות ותיקון 13.",
      },
      { property: "og:url", content: "https://orzadik.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/privacy" }],
  }),
});

function LegalPage() {
  return (
    <article className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <header className="mb-10 md:mb-14 text-center">
        <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">
          מסמך משפטי
        </p>
        <h1 className="font-display text-3xl md:text-5xl tracking-wide text-foreground">
          מדיניות פרטיות
        </h1>
        <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
        <p className="glass mt-5 inline-block px-4 py-1.5 text-xs text-muted-foreground [--glass-radius:9999px]">
          עודכן לאחרונה: {LEGAL_LAST_UPDATED}
        </p>
      </header>

      {/* Compact glass table of contents — pure in-page anchors (no JS), so it
          works server-rendered; each section carries scroll-mt to clear the
          sticky header when jumped to. */}
      <nav
        aria-label="תוכן העניינים"
        className="glass mb-10 md:mb-12 p-5 md:p-6 [--glass-radius:1.25rem]"
      >
        <p className="mb-3 text-[11px] tracking-[0.2em] text-accent">תוכן העניינים</p>
        <ul className="grid list-none gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block py-1.5 text-sm text-muted-foreground transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section title={"1. כללי ותחולת המדיניות"}>
        <p>{`אתר "אור זרוע לצדיק" (להלן: "האתר" או "החנות"), בכתובת orzadik.com, מופעל על ידי ${BUSINESS.name}${BUSINESS.legalId ? ", " + BUSINESS.legalId : ""}${BUSINESS.address ? ", " + BUSINESS.address : ""} (להלן: "בעל האתר", "אנחנו" או "החברה"). האתר משמש לשיווק ולמכירה של תשמישי קדושה ומוצרי יודאיקה, לרבות מוצרים בהתאמה אישית (חריטה, רקמה והזמנה מיוחדת). פירוט מגוון המוצרים מופיע בסעיף 1 לתקנון.`}</p>
        <p>
          {
            'אנו מכבדים את פרטיותכם ומחויבים להגן על המידע האישי הנמסר לנו. מדיניות פרטיות זו מתארת אילו נתונים אנו אוספים, כיצד אנו עושים בהם שימוש, עם מי אנו חולקים אותם, וכן את זכויותיכם ביחס למידע — הכל בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, לרבות תיקון מס\' 13 לחוק (שנכנס לתוקף ביום 14.8.2025), ולתקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017.'
          }
        </p>
        <p>
          {
            "השימוש באתר, לרבות גלישה, הרשמה, ביצוע הזמנה או מסירת מידע, מהווה הסכמה לתנאי מדיניות פרטיות זו. אם אינכם מסכימים לאמור במדיניות זו, כולה או חלקה, אנא הימנעו משימוש באתר וממסירת מידע."
          }
        </p>
        <p>
          {
            "מדיניות זו מנוסחת בלשון זכר מטעמי נוחות בלבד והיא מתייחסת לכל המגדרים כאחד. כל הסעיפים חלים על כל המשתמשים והלקוחות."
          }
        </p>
      </Section>

      <Section title={"2. הגדרות"}>
        <ul>
          <li>
            {
              '"מידע אישי" / "מידע" — כל נתון הנוגע לאדם מזוהה או הניתן לזיהוי, לרבות בהצטרפות לפרטים נוספים, כמשמעותם בחוק הגנת הפרטיות.'
            }
          </li>
          <li>{'"משתמש" — כל מי שגולש באתר, נרשם אליו או מבצע בו פעולה.'}</li>
          <li>{'"מאגר מידע" — מאגר המידע שבו נשמרים הנתונים האישיים של משתמשי האתר ולקוחותיו.'}</li>
          <li>
            {
              '"מחזיק" — נותן שירות חיצוני המעבד מידע אישי עבורנו ומטעמנו (לדוגמה ספק תשתית, סליקה או אחסון), כמשמעותו בחוק.'
            }
          </li>
          <li>
            {
              '"דיוור ישיר" — פנייה אישית אל המשתמש בהתבסס על השתייכותו לקבוצת אוכלוסין, לרבות לצורכי שיווק, כמשמעותו בסעיף 30א לחוק התקשורת (בזק ושידורים), התשמ"ב-1982.'
            }
          </li>
          <li>
            {
              '"איש קשר לענייני פרטיות" — הגורם שמונה אצלנו לטיפול בפניות בנושאי פרטיות ובמימוש זכויות; אין מדובר ב"ממונה על הגנת הפרטיות" (DPO) שאיננו נדרשים למנותו בהיקף פעילותנו.'
            }
          </li>
        </ul>
      </Section>

      <Section title={"3. המידע שאנו אוספים"}>
        <p>
          {
            'א. מידע שאתם מוסרים מרצונכם — בעת הרשמה, ביצוע הזמנה או פנייה אלינו אנו אוספים: שם מלא, כתובת דוא"ל, מספר טלפון, כתובת למשלוח ועיר, פרטי ההזמנה והערות שתצרפו, טקסט חופשי להתאמה אישית (custom_text — לדוגמה נוסח לחריטה או לרקמה), ושם מקבל החשבונית.'
          }
        </p>
        <p>
          {
            "ב. מידע הנאסף באופן אוטומטי — בעת השימוש באתר נאספים נתונים טכניים: כתובת IP ומיקום גאוגרפי משוער, סוג מכשיר ודפדפן, נתוני ניווט ושימוש באתר, מזהי עוגיות (Cookies), ונתוני שגיאות."
          }
        </p>
        <p>
          {
            'ג. עגלה נטושה — אם הוספתם מוצרים לעגלת הקניות ולא השלמתם את ההזמנה, אנו עשויים לשמור את כתובת הדוא"ל, השם ותכולת העגלה, לצורך שליחת תזכורת ושיפור השירות, בכפוף להסכמתכם לדיוור כמפורט בסעיף 9 להלן.'
          }
        </p>
        <p>
          {
            "ד. טקסט להתאמה אישית — אנו מסבים את תשומת לבכם כי בעת הזמנת מוצר בהתאמה אישית, הטקסט שתזינו נשמר ומועבר לצורך הייצור. נא להימנע מהזנת מידע רגיש שאינו דרוש להזמנה."
          }
        </p>
        <p>
          {
            "אנו איננו אוספים: מספרי כרטיס אשראי מלאים (ראו סעיף 4 לעניין הסליקה), מידע ביומטרי, מידע על מצב בריאותי, או מידע על קטינים מתחת לגיל 16 ביודעין."
          }
        </p>
      </Section>

      <Section title={"4. מטרות השימוש במידע והבסיס החוקי"}>
        <p>{"אנו עושים שימוש במידע למטרות הבאות ועל הבסיסים החוקיים המפורטים:"}</p>
        <ul>
          <li>
            {
              "ביצוע הזמנות, אספקת המוצרים, סליקת התשלום ומתן שירות לקוחות — לצורך ביצוע ההתקשרות החוזית עמכם ולפי הסכמתכם בעת ההזמנה."
            }
          </li>
          <li>
            {"הנפקת חשבוניות וקיום חובות מס וניהול חשבונות — לצורך עמידה בחובה חוקית החלה עלינו."}
          </li>
          <li>{"ניהול חשבון המשתמש ואימות זהותכם — לצורך ביצוע ההתקשרות ולפי הסכמתכם."}</li>
          <li>
            {
              "אבטחת האתר, מניעת הונאות ואיתור תקלות — לצורך האינטרס הלגיטימי שלנו בהגנה על המערכת ועל הלקוחות."
            }
          </li>
          <li>
            {
              "שיפור האתר, השירות והחוויה, לרבות ניתוח שימוש סטטיסטי — בכפוף להסכמתכם לעוגיות אנליטיקה (ראו סעיף 7)."
            }
          </li>
          <li>
            {
              "משלוח דיוור ישיר ועדכונים שיווקיים — אך ורק בכפוף להסכמתכם המוקדמת (opt-in) לפי סעיף 30א לחוק התקשורת (ראו סעיף 9)."
            }
          </li>
          <li>{"מענה לפניות, בירורים ותלונות — לצורך מתן השירות ולפי הסכמתכם בעת הפנייה."}</li>
        </ul>
      </Section>

      <Section title={"5. מסירת מידע לצדדים שלישיים (מחזיקים וספקי שירות)"}>
        <p>
          {
            'איננו מוכרים את המידע האישי שלכם. אנו נעזרים בנותני שירות חיצוניים ("מחזיקים") המעבדים מידע מטעמנו ועבור מטרות מדיניות זו בלבד. אלה המחזיקים הפעילים כיום:'
          }
        </p>
        {/* This list is a disclosure under חוק הגנת הפרטיות, so it has to describe
            the deployment as it is now, not as it was. Three corrections, each
            against a verified fact:
            • "Lovable Cloud" removed. That subscription was cancelled and the DB
              moved to the owner's own project (auth.tsx:153-158 documents it);
              src/integrations/lovable/index.ts is imported by nothing, so the
              vendor receives no data at all — naming it points a data-access
              request (§13) at a company that holds nothing.
            • Cloudflare added. wrangler.jsonc routes orzadik.com/www as custom
              domains onto the Worker, so Cloudflare terminates TLS for EVERY
              request including /checkout — live responses carry `Server:
              cloudflare` and a CF-RAY header. It was the single largest holder
              missing from the list.
            • Google added. The live homepage loads
              googletagmanager.com/gtag/js?id=G-SNVN50FGWL plus the AW- config
              (business.ts gaMeasurementId/googleAdsId), and the project's
              /auth/v1/settings reports google:true for the sign-in button at
              auth.tsx:272. §7 already admits analytics/marketing cookies, so
              omitting the recipient here contradicted the same page.
            The courier moved out of "ספקים עתידיים" into the active list: /terms §6
            and /shipping both already tell the buyer the order ships via חברת
            שילוח / דואר, i.e. their address IS handed over — calling that vendor
            "not active" was the one outright false statement in the section.
            Resend was a stray <p> under the list; it is a holder like the rest,
            so it belongs inside the <ul>. */}
        <ul>
          <li>
            {
              "Cardcom — חברת סליקה ישראלית, לצורך עיבוד התשלום. פרטי כרטיס האשראי המלאים נמסרים ישירות ל-Cardcom בסביבה מאובטחת התואמת לתקן PCI-DSS, ואלינו מועבר אסימון (token) בלבד ולא מספרי הכרטיס."
            }
          </li>
          <li>
            {
              "Cloudflare — לצורך אירוח האתר ורשת הפצת התוכן (CDN). כלל תעבורת האתר, לרבות עמודי ההרשמה, הסל והתשלום, עוברת דרך שרתי החברה."
            }
          </li>
          <li>
            {
              "Supabase — לצורך אחסון מסד הנתונים והקבצים (Storage) וניהול שירותי האימות (Auth) וחשבונות המשתמשים."
            }
          </li>
          {/* Phone is in the list because order-emails.server.ts renders
              order.customer_phone into the shop-owner alert, which goes out
              through Resend. Omitting it while the courier bullet below names
              מספר הטלפון explicitly would read as a claim that Resend never
              sees it. */}
          <li>
            {
              'Resend — ספק לשליחת הודעות דוא"ל תפעוליות (כגון אישורי הזמנה ועדכוני משלוח) ודיוור למי שהסכים לכך; המידע המועבר אליו מוגבל לכתובת הדוא"ל ולתוכן ההודעה, הכולל — בהתאם לסוג ההודעה — את שמכם, מספר הטלפון, פרטי ההזמנה וכתובת המשלוח.'
            }
          </li>
          {/* This bullet must separate STORAGE from TRANSFER, because the
              deployment does not gate the two the same way and an earlier draft
              here claimed it did.
              What is actually true: __root.tsx injects gtag.js into the SSR
              <head> on EVERY page, and loads the Google Fonts stylesheet from
              fonts.googleapis.com/fonts.gstatic.com on every page too. Both are
              requests to Google, so the visitor's IP and browser headers reach
              Google BEFORE any consent is given. What consent actually gates is
              Consent Mode v2 storage: analytics_storage / ad_storage default to
              "denied", so no analytics or advertising COOKIE is written and no
              identified measurement happens until the banner choice is granted.
              Saying "these services operate only after your consent" was
              therefore false as written — the same class of inaccuracy the
              Lovable Cloud removal above was made to fix. */}
          <li>
            {
              "Google — שירותי Google Analytics ו-Google Ads, לצורך מדידת השימוש באתר ומדידת אפקטיביות הפרסום, וכן שירות הגופנים Google Fonts. תגי המדידה וקובצי הגופנים נטענים משרתי Google בכל עמוד, ולפיכך כתובת ה-IP ונתוני הדפדפן שלכם נמסרים ל-Google גם בטרם מתן הסכמה. עוגיות אנליטיקה ושיווק ומדידה מזוהה מופעלות רק לאחר קבלת הסכמתכם (Consent Mode), כמפורט בסעיף 7. בנוסף, למשתמשים הבוחרים להתחבר באמצעות חשבון Google, ההתחברות מתבצעת מול Google."
            }
          </li>
          <li>
            {
              "חברת שילוח / דואר — לצורך מסירת ההזמנה ליעדה. מועברים אליה שם המקבל, מספר הטלפון וכתובת המשלוח בלבד, ולא פרטי תשלום."
            }
          </li>
        </ul>
        <p>
          {"ככל שנוסיף, נחליף או נפסיק להשתמש בנותן שירות מהמפורטים לעיל, נעדכן רשימה זו בהתאם."}
        </p>
        <p>
          {
            "בנוסף, אנו עשויים לחשוף מידע אם נידרש לכך על פי דין, צו שיפוטי או דרישה של רשות מוסמכת, וכן לשם הגנה על זכויותינו או על שלום הציבור."
          }
        </p>
      </Section>

      <Section title={"6. העברת מידע אל מחוץ לישראל"}>
        <p>
          {
            "חלק מנותני השירות (המחזיקים) המפורטים בסעיף 5 מאחסנים או מעבדים מידע בשרתים הממוקמים מחוץ לישראל. העברה כאמור עשויה להתבצע למדינות שדיני הגנת המידע בהן עשויים להיות שונים מאלה החלים בישראל."
          }
        </p>
        <p>
          {
            'אנו פועלים לוודא כי העברת מידע אל מחוץ לישראל תיעשה בהתאם לחוק הגנת הפרטיות ולתקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס"א-2001, ובכפוף להתחייבות נותני השירות לרמת הגנה הולמת על המידע. בשימוש באתר ובמסירת מידע אתם מביעים את הסכמתכם להעברה כאמור.'
          }
        </p>
      </Section>

      <Section title={"7. עוגיות (Cookies) וטכנולוגיות דומות"}>
        <p>
          {
            "האתר עושה שימוש בעוגיות ובטכנולוגיות דומות לצורך תפקודו התקין, שמירת העדפות, ניתוח שימוש ושיווק. אנו מציגים באנר עוגיות גרנולרי המאפשר לכם לבחור אילו קטגוריות עוגיות לאשר. ניתן לפתוח מחדש את הגדרות העוגיות ולשנות את בחירתכם בכל עת באמצעות הקישור הייעודי באתר."
          }
        </p>
        <p>{"אנו מסווגים את העוגיות לארבע קטגוריות:"}</p>
        <ul>
          <li>
            {
              "עוגיות הכרחיות (Necessary) — חיוניות לתפקוד הבסיסי של האתר, לרבות ניהול הסל, האימות והאבטחה. עוגיות אלה אינן ניתנות לביטול שכן בלעדיהן האתר לא יתפקד."
            }
          </li>
          <li>{"עוגיות העדפות — לשמירת בחירות והגדרות המשתמש לשיפור הנוחות."}</li>
          <li>
            {
              "עוגיות אנליטיקה (Analytics) — למדידה וניתוח של אופן השימוש באתר, ומופעלות רק לאחר קבלת הסכמתכם."
            }
          </li>
          <li>
            {"עוגיות שיווק (Marketing) — לצורכי פרסום והתאמת תכנים, ומופעלות רק לאחר קבלת הסכמתכם."}
          </li>
        </ul>
        <p>
          {
            "בנוסף ניתן לחסום או למחוק עוגיות באמצעות הגדרות הדפדפן, אולם הדבר עלול לפגוע בחלק מתפקודי האתר."
          }
        </p>
      </Section>

      <Section title={"8. אבטחת מידע"}>
        <p>{"אנו נוקטים אמצעי אבטחה לשם הגנה על המידע. להלן האמצעים המיושמים בפועל:"}</p>
        <ul>
          <li>{"הצפנת התעבורה באתר באמצעות פרוטוקול TLS/HTTPS."}</li>
          <li>{"שמירת סודות ומפתחות גישה במנגנון כספת מאובטח (Vault)."}</li>
          <li>{"הרשאות גישה ברמת השורה (Row-Level Security) על כל הטבלאות הרגישות."}</li>
          <li>{"הגבלת גישת ניהול (Admin) באמצעות מנגנון הרשאות מבוסס תפקיד (has_role)."}</li>
          <li>{"בידוד אסימוני התשלום בצד השרת בלבד."}</li>
          <li>
            {
              "אימות הודעות הסליקה משרת לשרת מול Cardcom, לרבות מנגנון מניעת כפילויות (idempotency)."
            }
          </li>
          <li>{"ולידציה (אימות) של נתוני קלט באמצעות Zod."}</li>
          {/* Named the library, so it has to stay true: the sanitiser is now an
              in-house allowlist (src/lib/sanitize-html.ts) rather than DOMPurify. */}
          <li>{"סינון וניקוי תוכן HTML של עמודי המוצר והמדריכים לפי רשימת תגיות מותרות."}</li>
          <li>{"גיבוי יומי של מסד הנתונים."}</li>
        </ul>
        <p>
          {
            "חשוב להבהיר: על אף מאמצינו, אין באפשרותנו להבטיח חסינות מוחלטת מפני חדירה או שימוש לרעה במידע. אנו פועלים באופן סביר להגנה על המידע, אך לא נוכל לערוב באופן מוחלט מפני כל פגיעה אפשרית."
          }
        </p>
      </Section>

      <Section title={"9. דיוור ישיר ותכנים שיווקיים"}>
        <p>
          {
            'משלוח דברי פרסומת ודיוור ישיר נעשה אך ורק לאחר קבלת הסכמתכם המפורשת מראש (opt-in), בהתאם לסעיף 30א לחוק התקשורת (בזק ושידורים), התשמ"ב-1982. אפשרות ההצטרפות לדיוור מוצגת באתר כשהיא כבויה כברירת מחדל, ומופעלת רק אם תבחרו בכך באופן יזום.'
          }
        </p>
        <p>
          {
            "בכל עת תוכלו להסיר את הסכמתכם ולחדול מקבלת דיוור — באמצעות לחיצה על קישור ההסרה המופיע בכל הודעה, באמצעות שינוי ההגדרה בחשבונכם באתר, או בפנייה אלינו לפי פרטי הקשר שבסעיף 14. הסרה מהדיוור לא תפגע במתן השירות או בביצוע הזמנות קיימות."
          }
        </p>
      </Section>

      <Section title={"10. תקופות שמירת המידע"}>
        <p>
          {
            "אנו שומרים את המידע למשך הזמן הדרוש להגשמת המטרות שלשמן נאסף, או כנדרש על פי דין, לפי המוקדם:"
          }
        </p>
        <ul>
          <li>
            {
              "פרטי חשבון משתמש — כל עוד החשבון פעיל; עם מחיקת החשבון יימחקו או יוסבו לאנונימיים פרטי החשבון, בכפוף לחובות שמירה שבדין."
            }
          </li>
          <li>
            {
              "חשבוניות ומסמכים חשבונאיים — נשמרים כ-7 שנים, בהתאם לדרישות דיני המס וניהול הספרים בישראל."
            }
          </li>
          <li>
            {
              "פניות ותכתובות שירות לקוחות — נשמרות לתקופה סבירה הדרושה לטיפול בפנייה ולמעקב, ובכפוף לחובות שבדין."
            }
          </li>
          <li>
            {
              "נתוני אנליטיקה — נשמרים לתקופה מוגבלת לצורכי ניתוח סטטיסטי ולאחריה נמחקים או הופכים לבלתי מזוהים."
            }
          </li>
          <li>
            {
              "גיבויים — עותקי גיבוי עשויים להישמר לתקופה מוגבלת נוספת מטעמי שחזור ואבטחה, ולאחר מכן נמחקים או נדרסים במחזור הגיבוי."
            }
          </li>
        </ul>
      </Section>

      <Section title={"11. זכויותיכם ביחס למידע"}>
        <p>
          {
            "בהתאם לחוק הגנת הפרטיות עומדות לכם הזכויות הבאות, וחלקן ניתנות למימוש עצמי (Self-Serve) ישירות מתוך חשבונכם באתר:"
          }
        </p>
        <ul>
          <li>
            {
              "זכות עיון (סעיף 13 לחוק) — באמצעות כלי ייצוא נתונים עצמי תוכלו לעיין במידע האישי השמור עליכם ולהורידו."
            }
          </li>
          <li>
            {
              "זכות לתיקון מידע (סעיף 14 לחוק) — תוכלו לערוך באופן עצמי את שמכם ומספר הטלפון שלכם בחשבון; לתיקון פרטים נוספים ניתן לפנות אלינו."
            }
          </li>
          <li>
            {
              "זכות למחיקת מידע (סעיף 14 לחוק) — תוכלו לבצע מחיקת חשבון עצמית. בעת המחיקה ההזמנות הקשורות אליכם יוסבו לאנונימיות, וזאת לצורך שמירה על נתוני החשבוניות למשך 7 שנים כנדרש בדיני המס; פרטים מזהים שאינם נדרשים על פי דין יימחקו."
            }
          </li>
          <li>
            {
              "ניהול הסכמת דיוור — תוכלו להפעיל או לכבות את הסכמת הדיוור (ברירת המחדל כבויה) ולבטל מנוי בכל עת."
            }
          </li>
          <li>
            {
              "ניהול הסכמת עוגיות — תוכלו לפתוח מחדש את באנר העוגיות הגרנולרי ולשנות את העדפותיכם בכל עת."
            }
          </li>
        </ul>
        <p>
          {
            "למימוש זכות שאינה זמינה במנגנון העצמי, או לכל בקשה אחרת, ניתן לפנות לאיש הקשר לענייני פרטיות לפי הפרטים שבסעיף 14. אנו עשויים לבקש לאמת את זהותכם טרם הטיפול בבקשה, ונשיב בתוך פרק הזמן הקבוע בחוק."
          }
        </p>
      </Section>

      <Section title={"12. קטינים"}>
        <p>
          {
            "האתר אינו מיועד לקטינים מתחת לגיל 16, ואיננו אוספים מהם מידע אישי ביודעין. אם אתם מתחת לגיל זה, אנא הימנעו ממסירת מידע אישי. ביצוע רכישה באתר על ידי קטין מותנה בהסכמת האחראי עליו."
          }
        </p>
        <p>
          {
            "אם נודע לנו כי נאסף מידע מקטין מתחת לגיל 16 ללא הסכמת האחראי עליו, נפעל למחוק מידע זה. הורה או אפוטרופוס הסבור כי קטין מסר לנו מידע מוזמן לפנות אלינו לפי פרטי הקשר שבסעיף 14."
          }
        </p>
      </Section>

      <Section title={"13. שינויים במדיניות הפרטיות"}>
        <p>
          {
            "אנו רשאים לעדכן מדיניות פרטיות זו מעת לעת, לרבות בשל שינויים בפעילות, בטכנולוגיה או בדרישות הדין. הנוסח המעודכן יפורסם באתר ויחייב מרגע פרסומו. תאריך העדכון האחרון מצוין בראש המדיניות."
          }
        </p>
        <p>
          {
            "במקרה של שינוי מהותי הנוגע לאופן השימוש במידע, נפעל ליידע אתכם באמצעי סביר. המשך השימוש באתר לאחר עדכון המדיניות מהווה הסכמה לנוסח המעודכן."
          }
        </p>
      </Section>

      <Section title={"14. הדין החל, סמכות שיפוט ויצירת קשר"}>
        {/* Venue must match /terms §14 word for word in substance, because
            /terms §11 declares this policy "חלק בלתי נפרד מתקנון זה" — two
            different exclusive venues inside one agreement leave the buyer
            unable to tell where a dispute is heard. The old text named תל
            אביב-יפו exclusively, which matches no party: BUSINESS.address is
            "דרך עכו 190, קרית ביאליק" (Haifa district). Broadened to the same
            "בתי המשפט המוסמכים בישראל" wording /terms already uses, and carried
            over its consumer carve-out — a bare exclusive-venue clause over a
            buyer's own personal data is exactly what a careful Israeli shopper
            scans for. No new obligation is introduced: this only relaxes venue. */}
        <p>
          {
            "על מדיניות זו ועל כל הנובע ממנה יחולו אך ורק דיני מדינת ישראל. סמכות השיפוט בכל מחלוקת הקשורה למדיניות זו נתונה לבתי המשפט המוסמכים בישראל. אין באמור כדי לגרוע מזכות צרכן לפנות לערכאה המוסמכת לפי כל דין צרכני קוגנטי."
          }
        </p>
        <p>{`לפניות בנושאי פרטיות ומימוש זכויות ניתן לפנות לאיש הקשר לענייני פרטיות בדוא"ל: ${BUSINESS.privacyEmail}.`}</p>
        <p>{`לפניות בנושא נגישות ניתן לפנות בדוא"ל: ${BUSINESS.accessibilityEmail}. הצהרת הנגישות המלאה של האתר זמינה בעמוד הנגישות בכתובת /accessibility.`}</p>
        <p>{`פרטי בעל האתר ליצירת קשר: ${BUSINESS.name}${BUSINESS.legalId ? ", " + BUSINESS.legalId : ""}${BUSINESS.address ? ", כתובת: " + BUSINESS.address : ""}, טלפון: ${BUSINESS.phoneDisplay}.`}</p>
      </Section>
    </article>
  );
}

/* Sections are separated by a glass hairline instead of being boxed — the
   futuristic-white direction wants precision rules and negative space, and a
   page-tall backdrop-blur panel would be an expensive paint on a document
   this long. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Derive the stable anchor id from the single SECTIONS source by title match,
  // so headings and the TOC stay in lockstep without repeating the id at each call.
  const id = SECTIONS.find((s) => s.title === title)?.id;
  return (
    <section
      id={id}
      className="mb-9 border-t border-glass-line pt-8 last:mb-0 scroll-mt-24 lg:scroll-mt-32"
    >
      <h2 className="font-display text-xl md:text-2xl mb-3 text-foreground">{title}</h2>
      <div className="text-[15px] leading-[1.85] text-foreground space-y-4 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-2 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
