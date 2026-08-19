-- Cover the six foreign keys the performance advisor flagged as unindexed.
--
-- Without a covering index every cascade/restrict check on the parent, and every
-- join from the child, degrades to a sequential scan. Nothing hurts today (one
-- order in the table), which is exactly why this is the moment to add them —
-- orders.user_id backs "my orders" on /account and order_items.product_id backs
-- the per-product sales rollups in the admin CRM, so both go hot the day the
-- shop starts taking real traffic.
create index if not exists orders_user_id_idx                 on public.orders (user_id);
create index if not exists order_items_product_id_idx         on public.order_items (product_id);
create index if not exists product_categories_category_id_idx on public.product_categories (category_id);
create index if not exists reviews_order_id_idx               on public.reviews (order_id);
create index if not exists campaigns_created_by_idx           on public.campaigns (created_by);
create index if not exists crm_customer_notes_created_by_idx  on public.crm_customer_notes (created_by);
