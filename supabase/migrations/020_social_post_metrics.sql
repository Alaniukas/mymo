-- Platform engagement metrics synced from WoopSocial (populated by sync-metrics job).

alter table public.social_posts
  add column if not exists metrics jsonb,
  add column if not exists metrics_synced_at timestamptz;
