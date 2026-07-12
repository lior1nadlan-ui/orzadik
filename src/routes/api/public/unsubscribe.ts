import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyUnsubscribeToken } from "@/lib/email.server";

// One-click unsubscribe endpoint for marketing emails (Spam Law §30א).
// Link format: /api/public/unsubscribe?e=<email>&t=<hmac-token>
// Verifies the signed token, then opts the address out of all marketing.

function page(title: string, body: string, ok: boolean): Response {
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
  <style>body{font:15px/1.6 system-ui,Arial,sans-serif;background:#FAF6E9;color:#2b2b2b;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem}
  .c{max-width:30rem;text-align:center;background:#fff;border:1px solid #EADFBE;border-radius:12px;padding:2rem}
  h1{font-size:1.3rem;margin:0 0 .5rem;color:${ok ? "#A8862A" : "#b00"}}
  a{color:#A8862A}</style></head>
  <body><div class="c"><h1>${title}</h1><p>${body}</p>
  <p><a href="https://orzadik.com/">חזרה לאתר אור זרוע לצדיק</a></p></div></body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") || "").trim().toLowerCase();
  const token = (url.searchParams.get("t") || "").trim();

  if (!email || !token || !(await verifyUnsubscribeToken(email, token))) {
    return page("קישור ההסרה אינו תקין", "ייתכן שהקישור פג תוקף. ניתן לנהל את העדפות הדיוור מתוך עמוד החשבון, או לפנות אלינו.", false);
  }

  try {
    // Stop abandoned-cart / marketing reminders for this address.
    await supabaseAdmin
      .from("abandoned_carts")
      .update({ unsubscribed: true })
      .ilike("email", email);
    // If a registered profile exists, revoke marketing consent too.
    await supabaseAdmin
      .from("profiles")
      .update({ marketing_consent: false })
      .ilike("email", email);
  } catch (e) {
    console.error("[unsubscribe] update failed:", e);
    return page("אירעה שגיאה", "לא הצלחנו להשלים את ההסרה כעת. אנא נסו שוב מאוחר יותר או פנו אלינו.", false);
  }

  return page("הוסרתם מרשימת התפוצה", "לא יישלחו אליכם עוד הודעות פרסומיות. תודה!", true);
}

export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
