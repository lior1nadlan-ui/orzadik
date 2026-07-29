import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { restoreOrderStock } from "@/lib/admin-crm.functions";

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";

/** Outbound deadline for the pay-click. Without one, a stalled CardCom leaves the
 *  buyer on a spinner with no end — the fetch has no default timeout. */
const CREATE_TIMEOUT_MS = 15_000;

/**
 * Every string field on CardCom's Document / UIDefinition objects is capped at 50
 * chars in the v11 schema (verified against
 * https://secure.cardcom.solutions/swagger/v11/swagger.json — DocumentBase.Name /
 * Email / AddressLine1 / AddressLine2 / City / Mobile / Phone and
 * UIDefinition.CardOwner*Value are all maxLength: 50). A real Israeli address
 * routinely exceeds that, and an over-long value risks the whole Create call being
 * rejected — i.e. the buyer cannot pay at all. Truncate rather than gamble.
 */
const cap = (s: unknown, n = 50): string | undefined => {
  const v = typeof s === "string" ? s.trim() : s == null ? "" : String(s).trim();
  return v ? v.slice(0, n) : undefined;
};

const InputSchema = z.object({
  order_id: z.string().uuid(),
});

type DocProduct = { Description: string; UnitCost: number; Quantity: number };

/**
 * Build the tax-document lines from the order's real items.
 *
 * CardCom issues the buyer's financial document from this array
 * (DocumentTypeToCreate "Auto"), so a single synthetic "הזמנה 260728-1234" line —
 * which is what this sent until 2026-07-28 — produces an invoice with no goods
 * description, no quantity and no unit price, with the ₪37 delivery fee disguised
 * as merchandise. CardCom accepts it, because 1 × total trivially equals Amount,
 * which is exactly why it went unnoticed.
 *
 * The arithmetic closes on integers: placeOrder stores subtotal AFTER the member
 * discount, so lines = Σ(unit_price × quantity) + shipping − memberDiscount
 *                    = rawSubtotal + shipping − (rawSubtotal − subtotal)
 *                    = subtotal + shipping = total.
 * Nothing here imports pricing.ts — every figure is read back off the order row.
 */
function buildDocumentProducts(order: any): DocProduct[] {
  const items: any[] = Array.isArray(order.order_items) ? order.order_items : [];
  if (items.length === 0) return [];

  const lines: DocProduct[] = items.map((it) => ({
    // variant + engraving text belong on the invoice line: they are what the
    // customer actually bought. 250 is the schema cap on Products.Description.
    Description: cap(
      [it.product_name, it.variant_label, it.custom_text].filter(Boolean).join(" — "),
      250,
    ) as string,
    UnitCost: Number(it.unit_price),
    Quantity: Number(it.quantity),
  }));

  const rawSubtotal = items.reduce((s, it) => s + Number(it.line_total), 0);
  const memberDiscount = rawSubtotal - Number(order.subtotal);
  const shipping = Number(order.shipping);

  if (Number.isFinite(shipping) && shipping > 0) {
    lines.push({ Description: "משלוח", UnitCost: shipping, Quantity: 1 });
  }
  // A negative line is legal by design — Products.UnitCost has a negative minimum
  // in the v11 schema — and it is the only way the discount stays visible to the
  // customer on the document instead of silently shrinking a product's price.
  if (Number.isFinite(memberDiscount) && memberDiscount > 0) {
    lines.push({ Description: "הנחת חבר מועדון", UnitCost: -memberDiscount, Quantity: 1 });
  }
  return lines;
}

/**
 * Creates a Cardcom LowProfile payment page for an existing order
 * and returns a redirect URL. The server verifies amount from DB —
 * client-supplied totals are never trusted.
 */
export const createCardcomPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const terminal = process.env.CARDCOM_TERMINAL_NUMBER;
    const apiName = process.env.CARDCOM_API_NAME;
    if (!terminal || !apiName) {
      console.error("[cardcom] missing terminal/api name env");
      throw new Error("מערכת התשלום אינה מוגדרת כעת.");
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, order_number, subtotal, shipping, total, customer_name, customer_email, customer_phone, customer_address, customer_city, payment_status, order_items(product_name, variant_label, custom_text, unit_price, quantity, line_total)",
      )
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) {
      console.error("[cardcom] order load:", error);
      throw new Error("ההזמנה לא נמצאה.");
    }
    // A refunded order must not be re-presented as payable: its money already went
    // back to the customer, and charging it again would be a second, unasked-for
    // sale against a cancelled order.
    if (order.payment_status === "paid") {
      throw new Error("ההזמנה כבר שולמה.");
    }
    if (order.payment_status === "refunded") {
      throw new Error("ההזמנה זוכתה ואינה זמינה לתשלום. לפתיחת הזמנה חדשה — צרו איתנו קשר.");
    }

    // Authorization: owned orders require the owner; guest orders (user_id null)
    // remain initiate-able by anyone who holds the order UUID (legitimate guest flow).
    const callerId = await getOptionalUserId();
    if (order.user_id && order.user_id !== callerId) {
      throw new Error("אין הרשאה לבצע פעולה זו.");
    }

    // Derive origin from the request — never trust client-supplied origins
    // (would let an attacker hijack Cardcom webhook + redirect URLs).
    const req = getRequest();
    const appUrl = process.env.APP_URL;
    const origin = (appUrl || new URL(req!.url).origin).replace(/\/+$/, "");
    const operation = "ChargeOnly";

    const genericFailure =
      "מצטערים, אירעה שגיאת שרת. אנא המתינו מעט ונסו שוב. אם הבעיה נמשכת — צרו איתנו קשר.";

    // Itemised document lines, guarded by the arithmetic CardCom enforces:
    // Σ(UnitCost × Quantity) must equal Amount.
    //
    // The guard FALLS BACK, it does not throw. An itemised invoice is the goal, but
    // a formatting concern must never be able to block a sale — if the lines ever
    // fail to sum (a future pricing change, a half-written order_items row), the
    // single-line document still charges the correct Amount and the customer can
    // still pay. The fallback is exactly the behaviour that shipped before
    // 2026-07-28, so the worst case is a regression to a non-itemised invoice, not
    // a dead checkout. The mismatch is logged at HIGH so it surfaces rather than
    // hiding, because silently un-itemising every invoice is its own failure.
    const singleLine: DocProduct[] = [
      { Description: `הזמנה ${order.order_number}`, UnitCost: Number(order.total), Quantity: 1 },
    ];
    let products = buildDocumentProducts(order);
    const lineSum = products.reduce((s, p) => s + p.UnitCost * p.Quantity, 0);
    if (products.length === 0 || Math.abs(lineSum - Number(order.total)) > 0.001) {
      console.error(
        `[cardcom] HIGH: itemised document unusable for order ${order.id} (${order.order_number}) — lines=${products.length} sum=${lineSum} total=${order.total}. Falling back to a single-line document; the charge is unaffected.`,
      );
      products = singleLine;
    }

    const payload = {
      TerminalNumber: Number(terminal),
      ApiName: apiName,
      Operation: operation,
      ReturnValue: order.id,
      Amount: Number(order.total),
      SuccessRedirectUrl: `${origin}/order/${order.id}?paid=1`,
      FailedRedirectUrl: `${origin}/order/${order.id}?paid=0`,
      WebHookUrl: `${origin}/api/public/cardcom-webhook`,
      Language: "he",
      ISOCoinId: 1, // ILS
      UIDefinition: {
        CardOwnerNameValue: cap(order.customer_name),
        CardOwnerPhoneValue: cap(order.customer_phone),
        CardOwnerEmailValue: cap(order.customer_email),
        // CardCom's own Apple Pay guidance: phone and email should be required on
        // the payment page, because those are what lets a transaction be located
        // in their reports later. We prefill both, so requiring them costs the
        // buyer nothing.
        IsCardOwnerPhoneRequired: true,
        IsCardOwnerEmailRequired: true,
      },
      Document: {
        DocumentTypeToCreate: "Auto",
        IsAllowEditDocument: true,
        Name: cap(order.customer_name) ?? "לקוח",
        Email: cap(order.customer_email),
        AddressLine1: cap(order.customer_address),
        City: cap(order.customer_city),
        Mobile: cap(order.customer_phone),
        Language: "he",
        Products: products,
      },
    };

    // Bounded outbound call — see CREATE_TIMEOUT_MS.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      console.error(
        `[cardcom] HIGH: LowProfile/Create transport failure for order ${order.id} (${order.order_number}):`,
        e,
      );
      throw new Error(genericFailure);
    } finally {
      clearTimeout(timer);
    }

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.ResponseCode !== 0 || !json?.Url || !json?.LowProfileId) {
      // Log the provider description for admins; never show it to buyers. The
      // order id + number are included so a support call can be traced to a row.
      console.error(
        `[cardcom] HIGH: LowProfile/Create failed for order ${order.id} (${order.order_number}) — http=${res.status}`,
        JSON.stringify(json),
      );
      throw new Error(genericFailure);
    }

    // The LowProfileId is the ONLY key the webhook can match on. If this write
    // fails and we still send the buyer to pay, the card gets charged and the
    // webhook can never find the order — money taken, order never fulfilled. So
    // the write is checked, and a failure aborts BEFORE the buyer reaches CardCom.
    const { error: persistErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "cardcom",
        payment_txn_id: json.LowProfileId,
        cardcom_low_profile_id: json.LowProfileId,
        cardcom_operation: operation,
      })
      .eq("id", order.id);
    if (persistErr) {
      console.error(
        `[cardcom] CRITICAL: failed to persist LowProfileId ${json.LowProfileId} for order ${order.id} (${order.order_number}) — aborting before redirect so no unmatchable charge can occur:`,
        persistErr,
      );
      throw new Error(genericFailure);
    }

    return { url: json.Url as string };
  });

const RefundSchema = z.object({ order_id: z.string().uuid() });

/**
 * Admin-only full refund.
 *
 * Uses Transactions/RefundByTransactionId, NOT Documents/CancelDoc. CancelDoc
 * declares `DocumentType` as **int32**, but every CardCom response hands the
 * document type back as a STRING enum ("TaxInvoiceAndReceipt", …) — which is what
 * the webhook stores in cardcom_document_type. Posting that string where an
 * integer is required meant every refund attempt failed, and the integer mapping
 * is documented nowhere we can rely on. RefundByTransactionId keys off
 * cardcom_tranzaction_id, which the webhook already records on every paid order,
 * so there is no enum to translate and nothing to guess. It also supports partial
 * refunds via PartialSum if that is ever wanted (this call stays full-refund).
 */
export const refundCardcomOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RefundSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("אין הרשאה לבצע פעולה זו.");

    const apiName = process.env.CARDCOM_API_NAME;
    const apiPassword = process.env.CARDCOM_API_PASSWORD;
    if (!apiName || !apiPassword) {
      throw new Error("פרטי ה-API של קארדקום אינם מוגדרים.");
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, payment_status, cardcom_tranzaction_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("ההזמנה לא נמצאה.");
    if (order.payment_status === "refunded") {
      throw new Error("ההזמנה כבר זוכתה.");
    }
    const txnId = Number(order.cardcom_tranzaction_id);
    // 0 is the sentinel the webhook writes for a CreateTokenOnly (authorised but
    // not charged) order — there is no captured transaction to refund.
    if (!Number.isFinite(txnId) || txnId <= 0) {
      throw new Error("להזמנה זו אין עסקה מחויבת בקארדקום — לא ניתן לזכות אוטומטית.");
    }

    const res = await fetch(`${CARDCOM_BASE}/Transactions/RefundByTransactionId`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiName: apiName,
        ApiPassword: apiPassword,
        TransactionId: txnId,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.ResponseCode !== 0) {
      console.error(
        `[cardcom] RefundByTransactionId failed for order ${order.id} (${order.order_number}) txn=${txnId} http=${res.status}:`,
        JSON.stringify(json),
      );
      throw new Error(`הזיכוי נכשל: ${json?.Description ?? "שגיאה לא ידועה"}`);
    }

    await supabaseAdmin
      .from("orders")
      .update({ status: "refunded", payment_status: "refunded" })
      .eq("id", order.id);

    // Data-integrity: return reserved stock now that the refund has succeeded.
    // Additive and wrapped — a restore failure must NEVER fail a refund the
    // customer's money already reflects. Idempotent via the stock_decremented_at
    // latch inside the helper, so a re-run restores nothing.
    try {
      await restoreOrderStock(order.id);
    } catch (e) {
      console.error(
        "[refundCardcomOrder] stock restore failed (refund still succeeded) for order:",
        order.id,
        e,
      );
    }

    return {
      success: true,
      newTransactionId: json.NewTranzactionId ?? null,
    };
  });
