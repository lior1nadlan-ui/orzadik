import { Link } from "@tanstack/react-router";

/**
 * §11 collection notice — Privacy Protection Law, as expanded by Amendment 13.
 * Must appear wherever personal data is collected (signup, checkout, marketing
 * consent) and state: (1) that provision is voluntary and the consequence of
 * not providing it, (2) the purpose, (3) to whom the data is passed, and
 * (4)+(5) the rights of access (§13) and correction (§14).
 */
export function PrivacyNotice({
  context,
  className = "",
}: {
  context: "checkout" | "signup" | "marketing";
  className?: string;
}) {
  const purpose =
    context === "checkout"
      ? "לצורך ביצוע ההזמנה, התשלום, המשלוח ויצירת קשר בנוגע להזמנה"
      : context === "signup"
        ? "לצורך ניהול חשבון המשתמש שלך, ביצוע הזמנות ומתן שירות"
        : "לצורך משלוח עדכונים ומבצעים — בכפוף להסכמתך, וניתן לביטול בכל עת";

  const consequence =
    context === "marketing"
      ? "מסירת הפרטים לצורך דיוור אינה חובה; ללא הסכמה לא יישלח אליך דיוור שיווקי, וזכותך המלאה להשתמש באתר נשמרת."
      : "מסירת הפרטים תלויה ברצונך ובהסכמתך, אך היא נדרשת להשלמת הפעולה — ללא הפרטים לא נוכל להשלים את ההזמנה/הרישום.";

  return (
    <p className={`text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      {consequence} המידע נאסף {purpose}. הפרטים נמסרים לספקי השירות המעבדים אותם עבורנו — Supabase
      (אחסון וניהול בסיס הנתונים), Cardcom (סליקת התשלום) ו-Resend (משלוח הודעות דוא"ל) — ולא ייעשה
      בהם שימוש למטרה אחרת ללא הסכמתך. זכותך לעיין במידע שנשמר עליך ולבקש את תיקונו או מחיקתו זמינה בעמוד{" "}
      <Link to="/account" className="underline hover:text-accent">
        החשבון שלי
      </Link>{" "}
      או בפנייה אלינו. פרטים מלאים ב
      <Link to="/privacy" className="underline hover:text-accent">
        מדיניות הפרטיות
      </Link>
      .
    </p>
  );
}
