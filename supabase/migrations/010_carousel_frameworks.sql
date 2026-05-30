-- Content Template Framework wiring.
--
-- Tags each carousel with the angle framework it was generated from, stores the
-- resolved per-angle post caption + hashtags (so publishing uses the angle's
-- caption template), and records each slide's named layout + role so the
-- renderer can lay out text deterministically without recomputing the role.
-- All columns are nullable so generation keeps working on an un-migrated DB.

alter table public.carousels
  add column if not exists framework_id text,
  add column if not exists post_caption text,
  add column if not exists hashtags text[];

alter table public.carousel_slides
  add column if not exists layout text,
  add column if not exists role text;
