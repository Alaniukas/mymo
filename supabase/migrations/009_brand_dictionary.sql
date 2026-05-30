-- Brand "Brain" -> Variable Dictionary.
--
-- Expands app_identities with the structured placeholders that the Content
-- Template Frameworks inject into every [bracket] text slot (see
-- src/lib/carousel/variables.ts). Every column is nullable / defaulted so
-- existing identities keep working untouched and the crawl upsert can degrade
-- gracefully on a database that hasn't run this migration yet.

alter table public.app_identities
  add column if not exists app_name text,
  add column if not exists app_category text,
  add column if not exists app_tagline text,
  add column if not exists social_handle text,
  add column if not exists core_problem text,
  add column if not exists key_outcome text,
  add column if not exists features jsonb default '[]'::jsonb,
  add column if not exists competitor_name text,
  add column if not exists competitor_weakness text,
  add column if not exists user_quotes jsonb default '[]'::jsonb,
  add column if not exists metric_result text,
  add column if not exists cta_text text,
  add column if not exists brand_color text,
  add column if not exists logo_url text;
