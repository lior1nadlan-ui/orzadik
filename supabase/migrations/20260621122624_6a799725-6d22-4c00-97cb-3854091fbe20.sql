INSERT INTO public.categories (id, slug, name, description)
VALUES
  ('b1e55fa1-0000-4000-8000-000000000001', 'birkat-habayit', 'ברכות הבית', 'ברכות הבית מעוצבות'),
  ('b1e55fa1-0000-4000-8000-000000000002', 'wall-art', 'ציורי קיר', 'ציורי קיר מעוצבים')
ON CONFLICT (id) DO NOTHING;