-- Trending sound applied to a carousel.
--
-- Carousels can ride a trending TikTok sound chosen in the Create flow before
-- generation. We persist the chosen sound (id, title, author, cover/preview/
-- TikTok URLs) as JSON so it's available at publish time and for display.

alter table public.carousels
  add column if not exists music jsonb;
