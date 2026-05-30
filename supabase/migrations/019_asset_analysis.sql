-- Per-asset vision analysis for smart slide assignment (subject, role hints).

alter table public.assets
  add column if not exists analysis jsonb,
  add column if not exists analyzed_at timestamptz;
