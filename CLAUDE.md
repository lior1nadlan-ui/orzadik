# אור זרוע לצדיק — הנחיות לעבודה על המאגר

## חשבונות — עובדים רק על orzadik

בכל אחד מהשירותים קיים חשבון/פרויקט בשם **orzadik**, וכל עבודה על האתר נעשית בו בלבד:

| שירות | חשבון / פרויקט | מזהה | תפקיד |
|---|---|---|---|
| GitHub | `lior1nadlan-ui/orzadik` | ענף ברירת מחדל `main` | קוד המקור. CI ב-`.github/workflows/ci.yml` |
| Supabase | פרויקט `orzadik` | ref `whtjslgrrfzehivrknuv` (eu-central-1) | בסיס הנתונים, Auth ו-Storage |
| Cloudflare | Worker `orzarua` | `wrangler.jsonc` | **פרודקשן** — orzadik.com ו-www.orzadik.com. פריסה ב-`.github/workflows/deploy.yml` על push ל-`main` |
| Vercel | צוות `orzadik`, פרויקט `orzadik` | `team_8IribFtDpoIzVklZnZ1CaPTu` / `prj_JLniXygzDf5Y1De2JXDkWXr9A0ZJ` | preview builds בלבד ל-PRs, **לא** האתר החי |

בדיקת Vercel ירוקה על PR לא אומרת שהשינוי עלה לאוויר. האתר החי מתעדכן רק מה-deploy
ל-Cloudflare.

## ⚠️ Supabase — שני פרויקטים, אחד נכון

בחשבון קיימים **שני** פרויקטים באותו ארגון (`htufokqcojovmwwoyxxy`):

| פרויקט | ref | מעמד |
|---|---|---|
| **orzadik** | `whtjslgrrfzehivrknuv` | **הפרויקט של האתר הזה — כל עבודה כאן** |
| SmarPackageAi | `orzitfqmlvopujsoyigr` | עסק אחר. **לא לגעת** |

כל SQL, מיגרציה, edge function או שינוי הגדרות חייבים ללכת ל-`whtjslgrrfzehivrknuv`
בלבד. ה-ref מעוגן גם ב-`supabase/config.toml`; לפני כל פעולה מול Supabase יש לוודא
שה-`project_id` תואם לו.

זיכרון מתמשך לסוכנים נשמר בטבלה `public.agent_memory` בפרויקט orzadik (admin בלבד,
RLS). לקריאה: `select key, content from agent_memory order by key;` — לעדכון: upsert
לפי `key`.

## העסק

"אור זרוע לצדיק" — חנות תשמישי קדושה ויודאיקה, בבעלות ליאור בן עמי, עוסק מורשה
039553623, דרך עכו 190 קרית ביאליק, https://orzadik.com. האתר בעברית RTL.
מקור אמת יחיד לזהות העסק, שעות הפתיחה והפרופילים החברתיים: `src/lib/business.ts`.

## סטאק

TanStack Start + React 19 + Vite + TypeScript, Tailwind v4 ו-shadcn/ui, TanStack
Router (file-based ב-`src/routes`) ו-React Query, Supabase (Postgres 17), פריסה
ל-Cloudflare Workers. בדיקות ב-Vitest.

לפני push: `npm run lint`, `npm run typecheck`, `npm run test`.

## כללים שנצברו

- **אין להריץ `supabase config push`** — הוא שולח את כל בלוק ה-auth ומאפס שדות שלא
  נכתבו במפורש (כבר כיבה אימות מייל וקיצר OTP), והיום גם היה מוחק את ספק Google
  OAuth שמוגדר רק בדשבורד. הפירוט ב-`supabase/config.toml`.
- אין לסמן `aggregateRating` על ביקורות Google — רק ביקורות שהאתר עצמו אוסף.
- עריכות תוכן בכמות נרשמות בטבלאות ה-ledger (`product_copy_runs`,
  `category_copy_runs`, `article_copy_runs`, `product_name_runs`) שמאפשרות rollback.
- טווחי מספרים בטקסט עברי נכתבים עם מקף ASCII בלבד (מקף en מתהפך ב-RTL).

## תיעוד נוסף

`docs/improvement-roadmap.md`, `docs/security-audit.md`, `docs/seo-geo-aeo-plan.md`,
`docs/hebrew-brand-serp.md`, `docs/legal-compliance-implementation.md`.
