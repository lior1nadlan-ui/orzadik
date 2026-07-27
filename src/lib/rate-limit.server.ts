import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Client IP for SECURITY decisions (rate limiting + IP allowlists).
 *
 * Reads ONLY `cf-connecting-ip` — the single header Cloudflare sets from the
 * real TCP peer and overwrites at the edge, so a client cannot forge it. The
 * spoofable `x-forwarded-for` is deliberately NOT consulted here: it is
 * attacker-controlled and must never feed a trusted-IP decision (an attacker
 * could otherwise set it to a rate-limit-dodging value, or to a CardCom source
 * IP to slip past the webhook allowlist).
 *
 * Absence is treated as untrusted → `"unknown"`. The IP rate limiters skip on
 * `"unknown"` (fail-open, so a missing header never blocks a legitimate order);
 * the CardCom allowlist treats it as non-matching (an unknown IP is not on the
 * list). On Cloudflare Workers this header is always present for external
 * requests, so production behaviour is unchanged.
 */
export function getClientIp(req: Request | null | undefined): string {
  return req?.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

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
 * IP-based rate limiter for guest order tracking (/track).
 *
 * Deliberately a SEPARATE key namespace from `order:`. The tracking form is an
 * unauthenticated lookup by (order number + email), so it needs a tight cap to
 * make enumeration expensive — but sharing the order bucket would mean a
 * customer who refreshes their tracking page a few times can no longer place an
 * order. Different risk, different counter.
 */
export async function checkTrackRateLimitByIp(
  ip: string,
  maxPerWindow = 10,
  windowSeconds = 10 * 60,
): Promise<{ limited: boolean }> {
  if (!ip || ip === "unknown") return { limited: false };
  try {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `track:${ip}:${bucket}`;
    const { data, error } = await supabaseAdmin
      .rpc("increment_rate_limit", { p_key: key, p_ttl_seconds: windowSeconds * 2 });
    if (error) return { limited: false };
    return { limited: (data as number) > maxPerWindow };
  } catch {
    return { limited: false };
  }
}

/**
 * IP-based rate limiter for newsletter signups.
 *
 * Deliberately a SEPARATE key namespace from `order:` (mirroring `track:`). A
 * newsletter signup is a cheap, unauthenticated write, so it needs its own cap
 * — but sharing the order bucket would let a burst of signups from a shared
 * NAT/office IP lock legitimate customers out of placing orders. Different
 * risk, different counter.
 */
export async function checkNewsletterRateLimitByIp(
  ip: string,
  maxPerWindow = 10,
  windowSeconds = 60 * 60, // 1 hour
): Promise<{ limited: boolean }> {
  if (!ip || ip === "unknown") return { limited: false };
  try {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `newsletter:${ip}:${bucket}`;
    const { data, error } = await supabaseAdmin
      .rpc("increment_rate_limit", { p_key: key, p_ttl_seconds: windowSeconds * 2 });
    if (error) return { limited: false };
    return { limited: (data as number) > maxPerWindow };
  } catch {
    return { limited: false };
  }
}

/**
 * IP-based rate limiter for the public contact form.
 *
 * Its own key namespace, for the same reason as `track:`/`newsletter:`: every
 * submission sends a real email to the owner's inbox, so it needs a tight cap —
 * but sharing the `order:` bucket would mean a shopper who asks two questions
 * before buying can no longer place an order. A low cap is safe here because a
 * genuine customer sends one message, not five.
 */
export async function checkContactRateLimitByIp(
  ip: string,
  maxPerWindow = 5,
  windowSeconds = 60 * 60, // 1 hour
): Promise<{ limited: boolean }> {
  if (!ip || ip === "unknown") return { limited: false };
  try {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `contact:${ip}:${bucket}`;
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
