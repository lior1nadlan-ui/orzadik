import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { restoreOrderStock } from "@/lib/admin-crm.functions";

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";

const InputSchema = z.object({
  order_id: z.string().uuid(),
});


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
        "id, user_id, order_number, total, customer_name, customer_email, customer_phone, customer_address, customer_city, payment_status",
      )
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) {
      console.error("[cardcom] order load:", error);
      throw new Error("ההזמנה לא נמצאה.");
    }
    if (order.payment_status === "paid") {
      throw new Error("ההזמנה כבר שולמה.");
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
        CardOwnerNameValue: order.customer_name ?? undefined,
        CardOwnerPhoneValue: order.customer_phone ?? undefined,
        CardOwnerEmailValue: order.customer_email ?? undefined,
      },
      Document: {
        DocumentTypeToCreate: "Auto",
        IsAllowEditDocument: true,
        Name: order.customer_name,
        Email: order.customer_email ?? undefined,
        AddressLine1: order.customer_address ?? undefined,
        City: order.customer_city ?? undefined,
        Mobile: order.customer_phone ?? undefined,
        Language: "he",
        Products: [
          {
            Description: `הזמנה ${order.order_number}`,
            UnitCost: Number(order.total),
            Quantity: 1,
          },
        ],
      },
    };

    const res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.ResponseCode !== 0 || !json?.Url) {
      // Log the provider description for admins; never show it to buyers.
      console.error("[cardcom] LowProfile/Create failed:", res.status, JSON.stringify(json));
      throw new Error(
        "מצטערים, אירעה שגיאת שרת. אנא המתינו מעט ונסו שוב. אם הבעיה נמשכת — צרו איתנו קשר.",
      );
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "cardcom",
        payment_txn_id: json.LowProfileId ?? null,
        cardcom_low_profile_id: json.LowProfileId ?? null,
        cardcom_operation: operation,
      })
      .eq("id", order.id);

    return { url: json.Url as string };
  });

const RefundSchema = z.object({ order_id: z.string().uuid() });

/**
 * Admin-only full refund via Cardcom Documents/CancelDoc.
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
      .select("id, order_number, payment_status, cardcom_document_number, cardcom_document_type")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("ההזמנה לא נמצאה.");
    if (!order.cardcom_document_number || !order.cardcom_document_type) {
      throw new Error("להזמנה זו אין מסמך קארדקום — לא ניתן לזכות אוטומטית.");
    }

    const res = await fetch(`${CARDCOM_BASE}/Documents/CancelDoc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiName: apiName,
        ApiPassword: apiPassword,
        DocumentNumber: Number(order.cardcom_document_number),
        DocumentType: order.cardcom_document_type,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.ResponseCode !== 0) {
      console.error("[cardcom] CancelDoc failed:", res.status, JSON.stringify(json));
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
      newDocumentNumber: json.NewDocumentNumber ?? null,
      newDocumentType: json.NewDocumentType ?? null,
    };
  });
