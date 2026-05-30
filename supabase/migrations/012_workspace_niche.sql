-- Workspace niche.
--
-- Records the business type the user picks during onboarding (see
-- src/lib/carousel/niches.ts) so the brand crawl and "Brain" profile are
-- interpreted through the right lens. Nullable + `if not exists` so existing
-- workspaces keep working untouched and the crawl upsert can degrade gracefully
-- on a database that hasn't run this migration yet.

alter table public.workspaces
  add column if not exists niche text
    check (niche in ('ecomm', 'app', 'personal_brand', 'viral'));
