// Server functions behind the CRM coupons screen (/admin/coupons). Every one
// runs behind requireAdmin with the service-role client. The rules a coupon
// must satisfy live in coupons.ts (couponInputErrors, tested) and again in the
// table's CHECK constraints (supabase/migrations/20261114120000_coupons.sql).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import {
  commissionOwed,
  couponInputErrors,
  couponStatus,
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
};

export const listCoupons = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const [{ data: rows, error }, { data: stats, error: sErr }, { data: payouts, error: pErr }] =
    await Promise.all([
      supabaseAdmin
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.rpc("admin_coupon_stats"),
      supabaseAdmin.from("coupon_payouts").select("coupon_id, amount").limit(10000),
    ]);
  if (error) {
    console.error("[coupons] list:", error);
    throw new Error("שגיאה בטעינת הקופונים.");
  }
  if (sErr) console.error("[coupons] stats:", sErr);
  if (pErr) console.error("[coupons] payouts:", pErr);
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
