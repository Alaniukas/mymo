-- Brand Story + Viral Meme content engines

create table if not exists public.story_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  title text not null,
  theme text,
  goal text not null default 'story'
    check (goal in ('story', 'launch', 'event', 'recap', 'educate')),
  context text,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.story_campaigns enable row level security;

create policy "Users can manage own story campaigns"
  on public.story_campaigns for all
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

create trigger story_campaigns_updated_at
  before update on public.story_campaigns
  for each row execute function public.set_updated_at();

alter table public.carousels
  add column if not exists content_type text not null default 'carousel'
    check (content_type in ('carousel', 'brand_story', 'viral_meme'));

alter table public.carousels
  add column if not exists campaign_id uuid references public.story_campaigns(id) on delete set null;

alter table public.carousels
  add column if not exists engine_meta jsonb;

create index if not exists carousels_content_type_idx
  on public.carousels (workspace_id, content_type);
