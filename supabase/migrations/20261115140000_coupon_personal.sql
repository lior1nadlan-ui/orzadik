-- Coupons, part 5: personal coupons, the influencer's phone, and the code in
-- abandoned-cart reminders.
--
--   * coupons.allowed_email — a coupon made for ONE customer from their CRM
--     card ("קופון אישי": an apology, a thank-you, a birthday). Only an order
--     with this email can use it; stored lower-case, so the comparison is
--     exact. NULL = anyone (every coupon so far).
--   * coupons.influencer_phone — where "שליחת ערכה בוואטסאפ" sends the
--     influencer their code, shopping link and report link.
--   * abandoned_carts.coupon_code — the code the shopper had applied when
--     they left, so the reminder can say it is still waiting (and link back
--     with it). The reminder names it only if it still works for that email
--     (liveCouponsForCarts); the checkout checks it again either way.
--
-- Rollback:
--   alter table public.abandoned_carts drop column if exists coupon_code;
--   alter table public.coupons drop column if exists influencer_phone,
--     drop column if exists allowed_email;

alter table public.coupons
  add column if not exists allowed_email text
    check (allowed_email is null or (
      allowed_email = lower(btrim(allowed_email))
      and allowed_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )),
  add column if not exists influencer_phone text
    check (influencer_phone is null or char_length(influencer_phone) between 3 and 30);

create index if not exists coupons_allowed_email_idx
  on public.coupons (allowed_email) where allowed_email is not null;

alter table public.abandoned_carts
  add column if not exists coupon_code text
    check (coupon_code is null or char_length(coupon_code) <= 30);
