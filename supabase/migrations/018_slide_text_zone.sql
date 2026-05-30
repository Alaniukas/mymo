-- Per-slide text placement/style from template blueprint (studio mode).
alter table public.carousel_slides
  add column if not exists text_zone jsonb;
