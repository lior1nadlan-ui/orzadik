-- Gifts: who receives the parcel, when it is not the buyer.
--
-- 4 of the 11 paid orders by 15.11.2026 were gifts, and the checkout held one
-- name and one phone — the buyer's — so the courier called the buyer instead of
-- the person at the door. A delivered gift can now carry the recipient's name
-- and phone (both optional; rules in src/lib/gift-recipient.ts). They go on the
-- packing slip's "משלוח אל", the CRM order sheet, the owner's alerts and the
-- courier payload; never on the public order page.
--
-- Rollback:
--   alter table public.orders drop column if exists recipient_phone,
--     drop column if exists recipient_name;

alter table public.orders
  add column if not exists recipient_name text
    check (recipient_name is null or char_length(recipient_name) between 1 and 120),
  add column if not exists recipient_phone text
    check (recipient_phone is null or char_length(recipient_phone) between 9 and 30);
