import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Email-based rate limiter for order placement.
 * Counts orders created in the last `windowMs` ms.
 * Does NOT require an extra table — reuses the orders table.
 */
export async function checkOrderRateLimit(
  email: string,
  maxPerWindow = 5,
  windowMs = 60 * 60 * 1000, // 1 hour
): Promise<{ limited: boolean }> {
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .ilike("customer_email", email)
      .gt("created_at", since);

    return { limited: (count ?? 0) >= maxPerWindow };
  } catch {
    // On any DB error, fail open (don't block legitimate orders)
    return { limited: false };
  }
}

/**
 * IP-based rate limiter for order placement.
 * Complements the email limiter: the email is client-supplied and trivially
 * rotated, so an attacker can bypass the per-email cap by changing the address.
 * The IP cap makes automated order-spam far more expensive.
 * Uses the rate_limits table via the increment_rate_limit RPC.
 */
export async function checkOrderRateLimitByIp(
  ip: string,
  maxPerWindow = 15,
  windowSeconds = 60 * 60, // 1 hour
): Promise<{ limited: boolean }> {
  if (!ip || ip === "unknown") return { limited: false };
  try {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `order:${ip}:${bucket}`;
    const { data, error } = await supabaseAdmin
      .rpc("increment_rate_limit", { p_key: key, p_ttl_seconds: windowSeconds * 2 });
    if (error) return { limited: false };
    return { limited: (data as number) > maxPerWindow };
  } catch {
    return { limited: false };
  }
}

/**
 * IP-based rate limiter for the CardCom webhook endpoint.
 * Uses the rate_limits table (see migration 20260626040000).
 * Returns { limited: true } if the IP has exceeded the threshold.
 */
export async function checkWebhookRateLimit(
  ip: string,
  maxPerWindow = 60,
  windowSeconds = 60,
): Promise<{ limited: boolean }> {
  try {
    // Window key = IP + truncated timestamp bucket
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `webhook:${ip}:${bucket}`;

    const { data, error } = await supabaseAdmin
      .rpc("increment_rate_limit", { p_key: key, p_ttl_seconds: windowSeconds * 2 });

    if (error) return { limited: false };
    return { limited: (data as number) > maxPerWindow };
  } catch {
    return { limited: false };
  }
}
