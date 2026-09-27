-- A how-to guide for adding a personal name — the store's one real
-- differentiator, offered on about 690 active products (the categories in
-- src/lib/personalization.ts), with no page that explained how it works.
--
-- WHY THIS TOPIC. First in the backlog of docs/improvement-workflow.md after
-- the covers fix (#140) and the siddur label fix (#141), both found while
-- measuring it.
--
-- GROUNDED IN THE SITE AND THE CATALOGUE (live, 2026-09-27):
--   * gated shelves: 229 tallit/tefillin sets, 138 tallit bags, 128 challah
--     covers, 79 siddurim, 55 tallit/tefillin covers (15 named laser-only),
--     40 chalaka sets (some already include the child's name, embroidered or
--     engraved on the scissors), plus tefillin bags, groom packages, atarot;
--     431 of the gated products are faux leather, 35 velvet;
--   * the card markers, the PDP field ("הוספת שם אישי על המוצר", 60
--     characters, Hebrew), the simulation, the method toggle and the
--     WhatsApp link are quoted from src/components/ProductCard.tsx and
--     src/routes/product.$slug.tsx;
--   * "coordinated after the order, preparation starts after approval" is
--     /shipping §זמני אספקה; the cancellation exception is /returns §חריג
--     (Consumer Protection Law 14ג(ד)); the notes field is "הערות להזמנה".
--
-- ON ACCURACY. One store policy is restated — "ללא תוספת תשלום", as the PDP
-- states it; if that changes, this body changes with it. Delivery times are
-- linked to /shipping rather than copied, so they cannot drift here. No
-- prices, no turnaround promises.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'personalization-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'personalization-guide',
  'שם אישי על תיק טלית, כיסוי חלה וסידור: רקמה, הטבעה או חריטת לייזר — ואיך מזמינים',
  'מדריך להזמנת מוצר עם שם אישי: על אילו מוצרים אפשר, ההבדל בין רקמה, הטבעה וחריטת לייזר, מה לכתוב לבר מצווה, לחתונה ולחלאקה, איך לבדוק את הכיתוב, מה קורה אחרי ההזמנה, אירוע עם תאריך וביטול.',
  '<h2>מתנה שנושאת שם</h2>
<p>תיק טלית ותפילין עם שמו של חתן בר המצווה, כיסוי חלה עם שם המשפחה, סידור עם שם בעליו — כיתוב אישי הופך תשמיש קדושה לחפץ שמלווה את בעליו שנים. באור זרוע לצדיק אפשר להוסיף שם לכ-690 מוצרים, וההתאמה האישית ללא תוספת תשלום. המדריך מסביר על אילו מוצרים, באיזו שיטה, מה לכתוב ומה קורה מהרגע שמוסיפים לסל.</p>

<h2>על אילו מוצרים אפשר להוסיף שם</h2>
<p>בכרטיס של מוצר כזה מופיע סימון קטן — &quot;ניתן לרקום שם&quot;, &quot;ניתן להטביע שם&quot;, &quot;ניתן לחרוט שם&quot; או &quot;ניתן לרקום או לחרוט&quot; — ובעמוד המוצר יש שדה &quot;הוספת שם אישי על המוצר&quot;. את כולם ריכזנו גם בעמוד <a href="/collection/personalized">רקמה וחריטה אישית</a>. עיקר המבחר:</p>
<ul>
  <li><strong>תיקי טלית ותפילין:</strong> סטים של תיק טלית ותיק תפילין (229), תיקי טלית (138), תיקי תפילין וכיסויים לטלית ותפילין. רובם מדמוי עור, חלקם מקטיפה.</li>
  <li><strong>כיסויי חלה</strong> (128) לשולחן השבת.</li>
  <li><strong>סידורים</strong> (79).</li>
  <li><strong>סטים לחלאקה</strong> (40). בחלקם שם הילד כבר כלול — רקום על הכיסוי או חרוט על המספריים.</li>
  <li><strong>מארזים לחתן, עטרות לטלית ומוצרים לחתונה.</strong></li>
</ul>

<h2>רקמה, הטבעה או חריטת לייזר</h2>
<ul>
  <li><strong>רקמה:</strong> האותיות נתפרות בחוט על הבד או על דמוי העור. זו השיטה בתיקי הטלית והתפילין, בסטים ובכיסויים, ובהרבה מהם היא משתלבת ברקמה שכבר מעטרת את המוצר.</li>
  <li><strong>הטבעה:</strong> בסידורים השם מוטבע על הכריכה. אפשר לבחור בהם גם בחריטת לייזר.</li>
  <li><strong>חריטת לייזר:</strong> קרן לייזר חורטת את האותיות על פני החומר, בקו חד ומדויק. חלק מהכיסויים לטלית ותפילין נמכרים לחריטת לייזר בלבד, ובמוצרים אחרים אפשר לבחור בין רקמה לחריטה.</li>
</ul>
<p>אין צורך לנחש: בעמוד המוצר מופיעות רק השיטות שהמוצר מקבל, וכשיש שתיים — בוחרים ביניהן בלחיצה.</p>

<h2>מה לכתוב</h2>
<ul>
  <li><strong>לבר מצווה:</strong> שם פרטי ושם משפחה של חתן בר המצווה. יש המוסיפים את תאריך העלייה לתורה.</li>
  <li><strong>לחתונה:</strong> שם החתן על סט הטלית והתפילין; על כיסוי חלה — &quot;משפחת&quot; ושם המשפחה של הזוג.</li>
  <li><strong>לחלאקה:</strong> שם הילד.</li>
  <li><strong>לסידור:</strong> שם הבעלים — כך הסידור לא מתחלף בבית הכנסת.</li>
</ul>
<p>הכיתוב בעברית, עד 60 תווים. כיתוב קצר קל יותר לקריאה, בייחוד על פריט קטן כמו תיק תפילין או עטרה.</p>

<h2>לבדוק את הכיתוב לפני ההזמנה</h2>
<p>מוצר עם שם אישי נעשה במיוחד בשבילכם, ולכן כדאי לעבור על כל אות לפני ההזמנה:</p>
<ul>
  <li><strong>איות:</strong> כתיב מלא או חסר — &quot;אהרן&quot; או &quot;אהרון&quot; — ושם המשפחה כפי שהמשפחה כותבת אותו.</li>
  <li><strong>ההדמיה:</strong> בזמן ההקלדה מופיעה הדמיה של הכיתוב על החומר. היא להמחשה בלבד; הפונט, הגוון והמיקום הסופיים מתואמים איתכם אחרי ההזמנה.</li>
  <li><strong>בקשות מיוחדות</strong> — מיקום מסוים, או כיתוב שונה לכל פריט בסט — כתבו בשדה &quot;הערות להזמנה&quot; בקופה, או אמרו לנו בשיחת התיאום.</li>
</ul>

<h2>מה קורה אחרי ההזמנה</h2>
<ol>
  <li>הכיתוב והשיטה שבחרתם מופיעים בסל ובסיכום ההזמנה, ליד המוצר.</li>
  <li>אחרי ההזמנה ניצור איתכם קשר לתיאום הפונט, הגוון והמיקום.</li>
  <li>ההכנה מתחילה רק אחרי שאישרתם את הפרטים — כך אין הפתעות.</li>
  <li>בסיום ההכנה המוצר נשלח אליכם. זמני האספקה מפורטים בעמוד <a href="/shipping">משלוחים ואספקה</a>.</li>
</ol>

<h2>יש תאריך? דברו איתנו לפני</h2>
<p>בר מצווה, חתונה וחלאקה הם אירועים עם תאריך, וההכנה מתחילה רק אחרי תיאום הפרטים. אם המוצר צריך להגיע עד יום מסוים, פנו אלינו בוואטסאפ לפני ההזמנה — בעמוד המוצר יש קישור ישיר, ממש מעל שדה השם — ונגיד לכם אם זה אפשרי.</p>

<h2>ביטול והחזרה</h2>
<p>לפי חוק הגנת הצרכן, זכות הביטול אינה חלה על טובין שיוצרו במיוחד עבור הצרכן. לכן מוצר עם רקמה, הטבעה או חריטה אישית אינו ניתן לביטול או להחזרה אחרי שהתחלנו בהתאמה. זה אינו גורע מזכותכם במקרה של פגם או אי-התאמה. הפירוט המלא בעמוד <a href="/returns">ביטול עסקה והחזרות</a>.</p>

<p data-guide-cat-link="1">להתרשמות ולרכישה: כל <a href="/collection/personalized">המוצרים שאפשר להוסיף להם שם אישי</a>, וביניהם <a href="/category/setim-talit-tefilin">סטים לטלית ותפילין</a>, <a href="/category/tikei-talit">תיקי טלית</a> ו<a href="/category/challah-covers">כיסויי חלה</a> של אור זרוע לצדיק.</p>',
  6,
  'רקמת שם, שם אישי, רקמה על תיק טלית, תיק טלית עם שם, תיק תפילין עם שם, כיסוי חלה עם שם, הטבעת שם על סידור, חריטת לייזר, מתנה לבר מצווה עם שם, סט חלאקה עם שם, מתנה אישית לחתן',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T00:20:00Z'
)
ON CONFLICT (slug) DO NOTHING;
