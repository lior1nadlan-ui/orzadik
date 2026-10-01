-- How an order reaches the customer: delivered by courier (the only option
-- until now) or collected from the shop at דרך עכו 190, קרית ביאליק.
--
-- Additive with a default, so every existing order reads 'delivery' — which is
-- what all of them were — and the code that predates this column keeps working.
-- A pickup order is charged no shipping fee (placeOrder decides that, not this
-- column), and is closed with "נאסף" instead of a tracking number.
alter table public.orders
  add column if not exists fulfillment text not null default 'delivery';

alter table public.orders
  drop constraint if exists orders_fulfillment_check;
alter table public.orders
  add constraint orders_fulfillment_check check (fulfillment in ('delivery', 'pickup'));
