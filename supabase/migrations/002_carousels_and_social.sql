-- Carousels & Social Publishing schema

-- Carousels
create table public.carousels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  combination_id uuid references public.combinations(id) on delete set null,
  title text not null,
  platform text not null default 'instagram'
    check (platform in ('instagram', 'tiktok', 'both')),
  slide_count integer not null default 5,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.carousels enable row level security;

create policy "Users can view own carousels"
  on public.carousels for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own carousels"
  on public.carousels for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can update own carousels"
  on public.carousels for update
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own carousels"
  on public.carousels for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create trigger carousels_updated_at
  before update on public.carousels
  for each row execute function public.set_updated_at();

-- Carousel Slides
create table public.carousel_slides (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid references public.carousels(id) on delete cascade not null,
  position integer not null,
  caption text,
  prompt text,
  image_url text,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'completed', 'failed')),
  evolink_task_id text,
  created_at timestamptz default now()
);

alter table public.carousel_slides enable row level security;

create policy "Users can view own carousel slides"
  on public.carousel_slides for select
  using (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "Users can create own carousel slides"
  on public.carousel_slides for insert
  with check (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "Users can update own carousel slides"
  on public.carousel_slides for update
  using (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "Users can delete own carousel slides"
  on public.carousel_slides for delete
  using (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

-- Social Connections (OAuth tokens per platform per workspace)
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  platform_user_id text,
  platform_username text,
  scopes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, platform)
);

alter table public.social_connections enable row level security;

create policy "Users can view own social connections"
  on public.social_connections for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own social connections"
  on public.social_connections for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can update own social connections"
  on public.social_connections for update
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own social connections"
  on public.social_connections for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create trigger social_connections_updated_at
  before update on public.social_connections
  for each row execute function public.set_updated_at();

-- Social Posts (publishing history)
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid references public.carousels(id) on delete cascade not null,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  platform_post_id text,
  status text not null default 'pending'
    check (status in ('pending', 'publishing', 'published', 'failed')),
  error_message text,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table public.social_posts enable row level security;

create policy "Users can view own social posts"
  on public.social_posts for select
  using (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "Users can create own social posts"
  on public.social_posts for insert
  with check (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "Users can update own social posts"
  on public.social_posts for update
  using (
    carousel_id in (
      select c.id from public.carousels c
      join public.workspaces w on c.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

-- Storage bucket for generated carousel images
insert into storage.buckets (id, name, public)
values ('carousels', 'carousels', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload carousel images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'carousels');

create policy "Anyone can view carousel images"
  on storage.objects for select
  using (bucket_id = 'carousels');

create policy "Authenticated users can delete carousel images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'carousels');
