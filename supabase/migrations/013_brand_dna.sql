-- Brand DNA.
--
-- A short, vivid narrative of the brand's essence — personality, point of view,
-- and what makes its voice unmistakable. Generated alongside the structured
-- Variable Dictionary during the website crawl (and the brand quiz) and shown at
-- the top of the brand identity card. Nullable so existing identities keep
-- working and the crawl/quiz upsert degrades gracefully on a database that
-- hasn't run this migration yet.

alter table public.app_identities
  add column if not exists brand_dna text;
