import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getTelegramSetup,
  sendDailyDigestNow,
  sendTelegramTest,
  setTelegramButtons,
  getMyAlertPrefs,
  setMyAlertPrefs,
  type MyAlertPrefs,
} from "@/lib/telegram.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/telegram")({
  component: AdminTelegram,
});

function AdminTelegram() {
  const load = useServerFn(getTelegramSetup);
  const test = useServerFn(sendTelegramTest);
  const digestNow = useServerFn(sendDailyDigestNow);
  const buttonsFn = useServerFn(setTelegramButtons);
  const [switching, setSwitching] = useState(false);
  const onButtons = async (on: boolean) => {
    setSwitching(true);
    try {
      const r = await buttonsFn({ data: { on } });
      if (r.ok) toast.success(on ? "הכפתורים הופעלו — יופיעו בהזמנה הבאה ששולמה" : "הכפתורים כובו");
      else toast.error(r.error ?? "השינוי נכשל");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally {
      setSwitching(false);
    }
  };
  const [testing, setTesting] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["telegram-setup"],
    queryFn: () => load(),
  });

  const onTest = async (chatId: string) => {
    setTesting(chatId);
    try {
      const r = await test({ data: { chatId } });
      if (r.ok) toast.success("נשלחה הודעת בדיקה — אפשר לבדוק בטלגרם");
      else toast.error(r.error ?? "השליחה נכשלה");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally {
      setTesting(null);
    }
  };

  const onDigest = async () => {
    setSendingDigest(true);
    try {
      const r = await digestNow();
      if (r.skipped === "no-channel") toast.error("לא הוגדרו טלגרם או מייל ב-Worker.");
      else if (r.telegram && r.email) toast.success("הסיכום נשלח לטלגרם ולמייל");
      else if (r.telegram) toast.success("הסיכום נשלח לטלגרם (המייל לא נשלח)");
      else if (r.email) toast.success("הסיכום נשלח למייל (הטלגרם לא נשלח)");
      else toast.error("השליחה נכשלה בשני הערוצים");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally {
      setSendingDigest(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-bold">התראות</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        על כל הזמנה נשלחת הודעה עם כל הפרטים והתמונות של המוצרים, ובכל בוקר סיכום של מה שמחכה
        לטיפול.
      </p>

      <MyEmailAlerts />

      {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}

      {data && (
        <div className="space-y-4">
          {/* Setup details for whoever configures the bot — folded away
              once it works, open while something is missing. */}
          <details
            className="rounded-lg border bg-card p-4 text-sm"
            open={!data.hasToken || !data.hasChatId}
          >
            <summary className="cursor-pointer font-semibold">
              הגדרות טכניות של טלגרם {data.hasToken && data.hasChatId ? "✓" : "— חסר משהו"}
            </summary>
            <div className="mt-3 space-y-4">
              <div className="rounded-lg border bg-card p-4 text-sm">
                <Row label="טוקן ב-Worker" ok={data.hasToken} />
                <Row label="מזהה שיחה (CHAT ID)" ok={data.hasChatId} />
                {data.botUsername && (
                  <p className="mt-2 text-muted-foreground">בוט: @{data.botUsername}</p>
                )}
                {data.configuredChatId && (
                  <p className="mt-1 text-muted-foreground">
                    מוגדר כרגע: <code>{data.configuredChatId}</code>
                  </p>
                )}
              </div>

              {data.note && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  {data.note}
                </div>
              )}

              {data.candidates.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h2 className="mb-1 font-semibold">שיחות שדיברו עם הבוט</h2>
                  <p className="mb-3 text-sm text-muted-foreground">
                    שולחים בדיקה כדי לוודא שזו השיחה הנכונה, ואז מעתיקים את המספר ל-
                    <code>TELEGRAM_CHAT_ID</code> ב-Cloudflare.
                  </p>
                  <ul className="space-y-2">
                    {data.candidates.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                      >
                        <div>
                          <div className="font-mono text-base font-bold">{c.id}</div>
                          <div className="text-sm text-muted-foreground">{c.label}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard?.writeText(c.id);
                              toast.success("הועתק");
                            }}
                          >
                            העתקה
                          </Button>
                          <Button
                            size="sm"
                            disabled={testing === c.id}
                            onClick={() => onTest(c.id)}
                          >
                            {testing === c.id ? "שולח…" : "שליחת בדיקה"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-1 font-semibold">כפתורים בהתראת הזמנה</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              מתחת לכל הזמנה ששולמה יופיעו כפתורים: "בהכנה", "נשלח", "כבר נמסר" — ובאיסוף עצמי "מוכן
              לאיסוף" ו"נאסף". לחיצה מעדכנת את ההזמנה ישר מהטלגרם, בלי להיכנס לניהול. כל פעולה
              ששולחת מייל ללקוח או סוגרת הזמנה מבקשת אישור נוסף.
            </p>
            <div className="flex items-center gap-3">
              <span
                className={
                  data.buttonsOn
                    ? "font-semibold text-green-700"
                    : "font-semibold text-muted-foreground"
                }
              >
                {data.buttonsOn ? "פעילים ✓" : "כבויים"}
              </span>
              <Button
                size="sm"
                variant={data.buttonsOn ? "outline" : "default"}
                disabled={switching || !data.hasChatId}
                aria-describedby={!data.hasChatId ? "buttons-need-chat" : undefined}
                onClick={() => onButtons(!data.buttonsOn)}
              >
                {switching ? "מעדכן…" : data.buttonsOn ? "כיבוי" : "הפעלת הכפתורים"}
              </Button>
            </div>
            {!data.hasChatId && (
              <p id="buttons-need-chat" className="mt-2 text-xs text-amber-800">
                צריך קודם לחבר שיחת טלגרם (בהגדרות הטכניות למעלה).
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-1 font-semibold">סיכום בוקר יומי</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              כל בוקר בסביבות 10:00 (9:00 בחורף) נשלח לטלגרם ולמייל של החנות סיכום של מה שמחכה
              לטיפול: הזמנות ששולמו ועוד לא סומנו כנשלחו, תשלומים שלא הושלמו, עגלות פתוחות וחוות דעת
              לאישור. ביום בלי משימות פתוחות לא נשלח כלום.
            </p>
            <Button size="sm" disabled={sendingDigest} onClick={onDigest}>
              {sendingDigest ? "שולח…" : "שליחת סיכום עכשיו"}
            </Button>
          </div>

          <Button variant="outline" onClick={() => refetch()}>
            רענן
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Each admin's own owner emails. Every admin gets them by default
 * (staff-recipients.server.ts); the shop inbox always does, whatever is set here.
 */
function MyEmailAlerts() {
  const load = useServerFn(getMyAlertPrefs);
  const save = useServerFn(setMyAlertPrefs);
  const { data, refetch, isLoading, error } = useQuery({
    queryKey: ["my-alert-prefs"],
    queryFn: () => load(),
  });
  const [busy, setBusy] = useState(false);
  if (!data) {
    // Never vanish silently: the section is the only place to change these.
    return (
      <div className="mb-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        {isLoading
          ? "טוען את הגדרות המיילים…"
          : error
            ? "טעינת הגדרות המיילים נכשלה. נסו לרענן."
            : null}
      </div>
    );
  }
  const toggle = async (k: keyof MyAlertPrefs, v: boolean) => {
    setBusy(true);
    try {
      await save({ data: { ...data, [k]: v } });
      await refetch();
      toast.success("נשמר");
    } catch (e: any) {
      toast.error(e?.message ?? "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };
  const rows: Array<[keyof MyAlertPrefs, string]> = [
    ["orders", "הזמנות חדשות (שולמו וממתינות לתשלום)"],
    ["contacts", "פניות מטופס יצירת הקשר"],
    ["digest", "סיכום בוקר יומי"],
  ];
  return (
    <div className="mb-6 rounded-lg border bg-card p-4 text-sm">
      <h2 className="mb-1 font-semibold">המיילים שלי</h2>
      <p className="mb-3 text-muted-foreground">
        כל מנהל מקבל את המיילים האלה לתיבה שלו. אפשר לכבות כאן מה שלא צריך — זה משפיע רק עליך, ותיבת
        המייל של החנות ממשיכה לקבל הכול.
      </p>
      {rows.map(([k, label]) => (
        <label key={k} className="flex items-center justify-between border-b py-2 last:border-0">
          <span>{label}</span>
          <Switch checked={data[k]} disabled={busy} onCheckedChange={(v) => toggle(k, v)} />
        </label>
      ))}
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span>{label}</span>
      <span className={ok ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
        {ok ? "מוגדר ✓" : "חסר ✗"}
      </span>
    </div>
  );
}
