// Server functions behind the CRM coupons screen (/admin/coupons). Every one
// runs behind requireAdmin with the service-role client. The rules a coupon
// must satisfy live in coupons.ts (couponInputErrors, tested) and again in the
// table's CHECK constraints (supabase/migrations/20261114120000_coupons.sql).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { readWelcomeCouponSettings } from "@/lib/welcome-coupon.server";
import { welcomeCouponErrors, WELCOME_CODE_PREFIX, WELCOME_COUPON_KEY } from "@/lib/welcome-coupon";
import {
  commissionOwed,
  couponInputErrors,
  couponStatus,
  generateCouponCode,
  normalizeCouponCode,
  payoutBalance,
  type CouponRecord,
  type CouponStatus,
} from "@/lib/coupons";

export type CouponListItem = CouponRecord & {
  created_at: string;
  /** Secret of the influencer's report link (/partner/<token>), or null. */
  partner_token: string | null;
  status: CouponStatus;
  /** Paid orders that used the code. */
  paid_orders: number;
  /** Items amount of those orders, after every discount, without shipping. */
  sales: number;
  /** Shekels the code took off them. */
  discount: number;
  /** The influencer's commission on `sales` (commission_percent), 0 when none. */
  commission: number;
  /** Commission payments recorded so far (coupon_payouts). */
  paid_out: number;
  /** commission − paid_out; negative = paid in advance. */
  balance: number;
  /** Distinct customers (by email) among them. */
  customers: number;
  /** Orders with the code that are not (yet) paid. */
  unpaid_orders: number;
  last_order_at: string | null;
  /** Visits that arrived through the code's link (coupon_visits), all time. */
  visits: number;
};

export const listCoupons = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const [
    { data: rows, error },
    { data: stats, error: sErr },
    { data: payouts, error: pErr },
    { data: visitRows, error: vErr },
  ] = await Promise.all([
    supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.rpc("admin_coupon_stats"),
    supabaseAdmin.from("coupon_payouts").select("coupon_id, amount").limit(10000),
    supabaseAdmin.from("coupon_visits").select("coupon_id, visits").limit(20000),
  ]);
  if (error) {
    console.error("[coupons] list:", error);
    throw new Error("שגיאה בטעינת הקופונים.");
  }
  if (sErr) console.error("[coupons] stats:", sErr);
  if (pErr) console.error("[coupons] payouts:", pErr);
  if (vErr) console.error("[coupons] visits:", vErr);
  const visitsBy = new Map<string, number>();
  for (const v of visitRows ?? []) {
    visitsBy.set(v.coupon_id, (visitsBy.get(v.coupon_id) ?? 0) + Number(v.visits));
  }
  const byCoupon = new Map((stats ?? []).map((s) => [s.coupon_id, s]));
  const paidOut = new Map<string, number>();
  for (const p of payouts ?? []) {
    paidOut.set(p.coupon_id, (paidOut.get(p.coupon_id) ?? 0) + Number(p.amount));
  }
  const now = new Date();
  return (rows ?? []).map((r): CouponListItem => {
    const s = byCoupon.get(r.id);
    const paid = Number(s?.paid_orders ?? 0);
    const commission = commissionOwed(Number(s?.sales ?? 0), r.commission_percent);
    const out = Math.round((paidOut.get(r.id) ?? 0) * 100) / 100;
    return {
      ...r,
      discount_value: Number(r.discount_value),
      min_order: r.min_order == null ? null : Number(r.min_order),
      commission_percent: r.commission_percent == null ? null : Number(r.commission_percent),
      commission,
      paid_out: out,
      balance: payoutBalance(commission, out),
      status: couponStatus(r, paid, now),
      paid_orders: paid,
      sales: Number(s?.sales ?? 0),
      discount: Number(s?.discount ?? 0),
      customers: Number(s?.customers ?? 0),
      unpaid_orders: Number(s?.unpaid_orders ?? 0),
      last_order_at: s?.last_order_at ?? null,
      visits: visitsBy.get(r.id) ?? 0,
      max_discount: r.max_discount == null ? null : Number(r.max_discount),
    };
  });
});

const InputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().max(60),
  influencer_name: z.string().max(200).nullable(),
  notes: z.string().max(2000).nullable(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number(),
  free_shipping: z.boolean(),
  min_order: z.number().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  max_uses: z.number().nullable(),
  once_per_customer: z.boolean(),
  commission_percent: z.number().nullable(),
  scope: z.enum(["all", "categories", "products"]),
  category_ids: z.array(z.string().uuid()).max(200),
  product_ids: z.array(z.string().uuid()).max(500),
  apply_to_sale_items: z.boolean(),
  confirm_high: z.boolean(),
  allowed_email: z.string().trim().max(255).nullable().optional(),
  influencer_phone: z.string().trim().max(30).nullable().optional(),
  max_discount: z.number().nullable().optional(),
  new_customers_only: z.boolean().optional(),
});

export const saveCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const errors = couponInputErrors(data);
    if (errors.length) throw new Error(errors.join(" "));

    const row = {
      code: normalizeCouponCode(data.code),
      influencer_name: data.influencer_name?.trim() || null,
      notes: data.notes?.trim() || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      free_shipping: data.free_shipping,
      min_order: data.min_order,
      // No start date = from now (an existing coupon keeps its own start).
      ...(data.starts_at || !data.id
        ? {
            starts_at: data.starts_at
              ? new Date(data.starts_at).toISOString()
              : new Date().toISOString(),
          }
        : {}),
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      max_uses: data.max_uses,
      once_per_customer: data.once_per_customer,
      commission_percent: data.commission_percent,
      scope: data.scope,
      // Only the list the scope uses is kept (like promotions), so a coupon
      // switched to the whole shop does not carry a dead category list.
      category_ids: data.scope === "categories" ? data.category_ids : [],
      product_ids: data.scope === "products" ? data.product_ids : [],
      apply_to_sale_items: data.apply_to_sale_items,
      allowed_email: data.allowed_email ? data.allowed_email.trim().toLowerCase() : null,
      influencer_phone: data.influencer_phone?.trim() || null,
      // A cap only means something on a percent coupon.
      max_discount: data.discount_type === "percent" ? (data.max_discount ?? null) : null,
      new_customers_only: !!data.new_customers_only,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    };
    const duplicate = "הקוד הזה כבר קיים — בחרו קוד אחר.";
    if (!data.id) {
      const { data: created, error } = await supabaseAdmin
        .from("coupons")
        .insert({
          ...row,
          starts_at: row.starts_at ?? new Date().toISOString(),
          is_active: true,
          created_by: adminId,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[coupons] insert:", error);
        throw new Error(error.code === "23505" ? duplicate : "לא ניתן לשמור את הקופון.");
      }
      return { id: created.id as string };
    }
    const { error } = await supabaseAdmin.from("coupons").update(row).eq("id", data.id);
    if (error) {
      console.error("[coupons] update:", error);
      throw new Error(error.code === "23505" ? duplicate : "לא ניתן לשמור את הקופון.");
    }
    return { id: data.id };
  });

/** "כיבוי" / "הפעלה": a disabled code stops working at once; its history stays. */
export const setCouponActive = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ is_active: data.active, updated_at: new Date().toISOString(), updated_by: adminId })
      .eq("id", data.id);
    if (error) {
      console.error("[coupons] toggle:", error);
      throw new Error("לא ניתן לעדכן את הקופון.");
    }
    return { ok: true };
  });

export type CouponOrder = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  total: number;
  coupon_discount: number;
  payment_status: string;
  status: string;
};

/** Who used a code: its orders, newest first (paid and unpaid, marked). */
export const listCouponOrders = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CouponOrder[]> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, created_at, customer_name, customer_email, customer_phone, subtotal, total, coupon_discount, payment_status, status",
      )
      .eq("coupon_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      console.error("[coupons] orders:", error);
      throw new Error("שגיאה בטעינת ההזמנות של הקופון.");
    }
    return (rows ?? []).map((r) => ({
      ...r,
      subtotal: Number(r.subtotal),
      total: Number(r.total),
      coupon_discount: Number(r.coupon_discount),
    }));
  });

// ---- Commission payments ----------------------------------------------------

export type CouponPayout = { id: string; amount: number; paid_at: string; note: string | null };

export const listCouponPayouts = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ coupon_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CouponPayout[]> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("coupon_payouts")
      .select("id, amount, paid_at, note")
      .eq("coupon_id", data.coupon_id)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[coupons] payouts list:", error);
      throw new Error("שגיאה בטעינת התשלומים.");
    }
    return (rows ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  });

/** "רישום תשלום": the shop paid the influencer `amount` on `paid_at`. */
export const addCouponPayout = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        coupon_id: z.string().uuid(),
        amount: z.number().positive().max(1_000_000),
        paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().trim().max(500).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin.from("coupon_payouts").insert({
      coupon_id: data.coupon_id,
      amount: Math.round(data.amount * 100) / 100,
      paid_at: data.paid_at,
      note: data.note || null,
      created_by: adminId,
    });
    if (error) {
      console.error("[coupons] payout insert:", error);
      throw new Error("לא ניתן לרשום את התשלום.");
    }
    return { ok: true };
  });

/** Undo a payment recorded by mistake. */
export const deleteCouponPayout = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("coupon_payouts").delete().eq("id", data.id);
    if (error) {
      console.error("[coupons] payout delete:", error);
      throw new Error("לא ניתן למחוק את התשלום.");
    }
    return { ok: true };
  });

// ---- The influencer's private report link -------------------------------------

/**
 * Create (or replace) the secret behind /partner/<token>. Replacing it turns
 * the old link off at once — for a link that was passed on too far.
 */
export const createPartnerLink = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ coupon_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ partner_token: token, updated_at: new Date().toISOString(), updated_by: adminId })
      .eq("id", data.coupon_id);
    if (error) {
      console.error("[coupons] partner link:", error);
      throw new Error("לא ניתן ליצור את הקישור.");
    }
    return { token };
  });

/** Turn the influencer's report link off. */
export const removePartnerLink = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ coupon_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ partner_token: null, updated_at: new Date().toISOString(), updated_by: adminId })
      .eq("id", data.coupon_id);
    if (error) {
      console.error("[coupons] partner link off:", error);
      throw new Error("לא ניתן לבטל את הקישור.");
    }
    return { ok: true };
  });

/**
 * Delete a coupon that was never used. One with orders or commission payments
 * is history the CRM reports on — those are turned off ("כיבוי"), not deleted.
 */
export const deleteCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const [{ count: orders, error: oErr }, { count: payouts, error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", data.id),
      supabaseAdmin
        .from("coupon_payouts")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", data.id),
    ]);
    if (oErr || pErr) {
      console.error("[coupons] delete check:", oErr ?? pErr);
      throw new Error("לא ניתן למחוק את הקופון כרגע.");
    }
    if ((orders ?? 0) > 0 || (payouts ?? 0) > 0) {
      throw new Error("לקופון יש הזמנות או תשלומים — אפשר לכבות אותו, אבל לא למחוק.");
    }
    const { error } = await supabaseAdmin.from("coupons").delete().eq("id", data.id);
    if (error) {
      console.error("[coupons] delete:", error);
      throw new Error("לא ניתן למחוק את הקופון.");
    }
    return { ok: true };
  });

// ---- The shop-wide switch ("קופונים באתר") -----------------------------------

export const getCouponSettings = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", "coupons_enabled")
    .maybeSingle();
  if (error) {
    console.error("[coupons] settings read:", error);
    throw new Error("שגיאה בטעינת הגדרות הקופונים.");
  }
  return { enabled: data?.value !== false, updatedAt: data?.updated_at ?? null };
});

/** Turn every coupon off on the site (box hidden, codes refused) — or back on. */
export const setCouponsEnabled = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "coupons_enabled",
      value: data.enabled,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
    if (error) {
      console.error("[coupons] settings write:", error);
      throw new Error("לא ניתן לעדכן את ההגדרה.");
    }
    return { enabled: data.enabled };
  });

// ---- The newsletter's welcome coupon ("קופון הצטרפות") ---------------------

/** The setting, plus how many welcome codes went out and how many were used. */
export const getWelcomeCouponAdmin = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const [settings, issuedRes, redeemedRes] = await Promise.all([
    readWelcomeCouponSettings(),
    supabaseAdmin
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .like("code", `${WELCOME_CODE_PREFIX}-%`),
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .like("coupon_code", `${WELCOME_CODE_PREFIX}-%`),
  ]);
  return {
    ...settings,
    issued: issuedRes.count ?? 0,
    redeemed: redeemedRes.count ?? 0,
  };
});

/** Turn the welcome gift on or off, and size it (caps in welcome-coupon.ts). */
export const setWelcomeCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ enabled: z.boolean(), percent: z.number(), days: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const errors = welcomeCouponErrors(data);
    if (errors.length) throw new Error(errors.join(" "));
    const value = { enabled: data.enabled, percent: data.percent, days: data.days };
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: WELCOME_COUPON_KEY,
      value,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
    if (error) {
      console.error("[coupons] welcome settings write:", error);
      throw new Error("לא ניתן לשמור את ההגדרה.");
    }
    return value;
  });

/**
 * "קופון אישי" from a customer's CRM card: a one-time code only that
 * customer's email can use — an apology, a thank-you, a birthday. The code is
 * generated (retried on the rare clash) and comes back for the owner to send.
 */
export const createPersonalCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        name: z.string().trim().max(120).nullable(),
        discount_type: z.enum(["percent", "fixed"]),
        discount_value: z.number(),
        free_shipping: z.boolean(),
        days: z.number().int().min(1).max(365),
        confirm_high: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const email = data.email.toLowerCase();
    const endsAt = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000);
    const base = {
      influencer_name: data.name?.trim() || email,
      notes: "קופון אישי — נוצר מכרטיס הלקוח",
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      free_shipping: data.free_shipping,
      min_order: null,
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      max_uses: 1,
      once_per_customer: true,
      commission_percent: null,
      scope: "all" as const,
      category_ids: [],
      product_ids: [],
      apply_to_sale_items: true,
      allowed_email: email,
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCouponCode("GIFT");
      const errors = couponInputErrors({
        ...base,
        code,
        confirm_high: data.confirm_high,
        influencer_phone: null,
      });
      if (errors.length) throw new Error(errors.join(" "));
      const { error } = await supabaseAdmin.from("coupons").insert({
        ...base,
        code,
        is_active: true,
        created_by: adminId,
        updated_by: adminId,
      });
      if (!error) {
        // On the customer's timeline, like a phone order.
        await supabaseAdmin.from("crm_customer_notes").insert({
          customer_email: email,
          note: `נוצר קופון אישי ${code}`,
          created_by: adminId,
        });
        return { code, ends_at: endsAt.toISOString() };
      }
      if (error.code !== "23505") {
        console.error("[coupons] personal:", error);
        throw new Error("לא ניתן ליצור את הקופון.");
      }
    }
    throw new Error("לא ניתן ליצור קוד ייחודי — נסו שוב.");
  });
