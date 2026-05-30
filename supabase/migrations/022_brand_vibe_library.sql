-- Persistent brand vibe library (scraped from IG/TikTok/video, reused on new uploads)

create table if not exists public.brand_vibe_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  source_type text not null
    check (source_type in ('instagram', 'tiktok', 'video', 'profile', 'manual')),
  source_url text,
  title text not null,
  vibe jsonb not null default '{}'::jsonb,
  asset_ids uuid[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists brand_vibe_snapshots_workspace_idx
  on public.brand_vibe_snapshots (workspace_id, is_active, created_at desc);

alter table public.brand_vibe_snapshots enable row level security;

create policy "Users can manage own brand vibe snapshots"
  on public.brand_vibe_snapshots for all
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create trigger brand_vibe_snapshots_updated_at
  before update on public.brand_vibe_snapshots
  for each row execute function public.set_updated_at();
