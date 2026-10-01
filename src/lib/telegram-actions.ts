// Buttons under the Telegram order alert — close an order from the phone, in
// the chat where the owner already reads it, without opening the CRM.
//
// Until now 4 of 4 paid orders were never marked shipped: the alert arrived on
// the phone, the parcel went out, and the CRM was never opened. Every step that
// hangs off "shipped" — the customer's tracking page, the review request a week
// later — therefore never happened. These buttons put the mark where the owner
// already is.
//
// Pure: builds keyboards and parses callback data. The network and the
// database live in telegram-webhook.server.ts.
//
// callback_data is capped at 64 bytes by Telegram; "y:ship:" + a 36-char UUID
// is 43.

export type OrderAction = "prep" | "ship" | "dlvr" | "ready" | "pick";

/** Actions that tell the customer something or close the order — a stray tap
 *  must not do that, so they ask "בטוח?" first. */
const NEEDS_CONFIRM: ReadonlySet<OrderAction> = new Set(["ship", "dlvr", "ready", "pick"]);

export const ACTION_LABEL: Record<OrderAction, string> = {
  prep: "🛠 בהכנה",
  ship: "📦 נשלח (מייל ללקוח)",
  dlvr: "✅ כבר נמסר",
  ready: "🛍 מוכן לאיסוף (מייל ללקוח)",
  pick: "✅ נאסף",
};

/** What the action did, for the chat reply. */
export const ACTION_DONE: Record<OrderAction, string> = {
  prep: "סומנה כבהכנה",
  ship: "סומנה כנשלחה",
  dlvr: "סומנה כנמסרה",
  ready: "סומנה כמוכנה לאיסוף",
  pick: "סומנה כנאספה",
};

export type OrderState = {
  id: string;
  fulfillment?: string | null;
  payment_status?: string | null;
  status?: string | null;
  shipping_status?: string | null;
  shipped_at?: string | null;
};

type Button = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: Button[][] };

const btn = (a: OrderAction, id: string): Button => ({
  text: ACTION_LABEL[a],
  callback_data: `o:${a}:${id}`,
});

/** The actions that still make sense for an order, in its current state. */
export function availableActions(o: OrderState): OrderAction[] {
  if (o.payment_status !== "paid") return [];
  if (["cancelled", "refunded", "completed"].includes(String(o.status ?? ""))) return [];
  if (o.shipped_at) return [];
  if (o.fulfillment === "pickup") {
    return o.shipping_status === "ready_for_pickup" ? ["pick"] : ["ready", "pick"];
  }
  return o.shipping_status === "preparing" ? ["ship", "dlvr"] : ["prep", "ship", "dlvr"];
}

/** The keyboard under an order alert, or null when nothing is left to do. */
export function orderKeyboard(o: OrderState): InlineKeyboard | null {
  const acts = availableActions(o);
  if (acts.length === 0) return null;
  return { inline_keyboard: acts.map((a) => [btn(a, o.id)]) };
}

/** "בטוח?" step for an action that emails the customer or closes the order. */
export function confirmKeyboard(a: OrderAction, id: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: `כן — ${ACTION_LABEL[a]}`, callback_data: `y:${a}:${id}` },
        { text: "ביטול", callback_data: `n:${a}:${id}` },
      ],
    ],
  };
}

export function needsConfirm(a: OrderAction): boolean {
  return NEEDS_CONFIRM.has(a);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: ReadonlySet<string> = new Set(["prep", "ship", "dlvr", "ready", "pick"]);

/** o = first tap, y = confirmed, n = cancelled. Anything else is not ours. */
export function parseCallback(
  data: unknown,
): { step: "o" | "y" | "n"; action: OrderAction; orderId: string } | null {
  if (typeof data !== "string") return null;
  const [step, action, orderId, ...rest] = data.split(":");
  if (rest.length || !["o", "y", "n"].includes(step)) return null;
  if (!ACTIONS.has(action) || !UUID.test(orderId ?? "")) return null;
  return { step: step as "o" | "y" | "n", action: action as OrderAction, orderId };
}
