import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getTelegramSetup, sendTelegramTest } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/telegram")({
  component: AdminTelegram,
});

function AdminTelegram() {
  const load = useServerFn(getTelegramSetup);
  const test = useServerFn(sendTelegramTest);
  const [testing, setTesting] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["telegram-setup"],
    queryFn: () => load(),
  });

  const onTest = async (chatId: string) => {
    setTesting(chatId);
    try {
      const r = await test({ data: { chatId } });
      if (r.ok) toast.success("נשלחה הודעת בדיקה — תבדוק בטלגרם");
      else toast.error(r.error ?? "השליחה נכשלה");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-bold">התראות טלגרם</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        על כל הזמנה נשלחת הודעה עם כל הפרטים והתמונות של המוצרים.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}

      {data && (
        <div className="space-y-4">
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
                שלח בדיקה כדי לוודא שזו השיחה הנכונה, ואז העתק את המספר ל-
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
                        העתק
                      </Button>
                      <Button size="sm" disabled={testing === c.id} onClick={() => onTest(c.id)}>
                        {testing === c.id ? "שולח…" : "שלח בדיקה"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="outline" onClick={() => refetch()}>
            רענן
          </Button>
        </div>
      )}
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
