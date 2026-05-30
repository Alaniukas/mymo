-- CarouselAI initial schema

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  app_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workspaces enable row level security;

create policy "Users can view own workspaces"
  on public.workspaces for select
  using (auth.uid() = user_id);

create policy "Users can create own workspaces"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workspaces"
  on public.workspaces for update
  using (auth.uid() = user_id);

create policy "Users can delete own workspaces"
  on public.workspaces for delete
  using (auth.uid() = user_id);

-- App Identities (the "Brain" profile)
create table public.app_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  brand_tone text,
  target_audience text,
  value_propositions text[],
  product_terminology jsonb default '{}',
  raw_crawl_text text,
  llm_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.app_identities enable row level security;

create policy "Users can view own app identities"
  on public.app_identities for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own app identities"
  on public.app_identities for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can update own app identities"
  on public.app_identities for update
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own app identities"
  on public.app_identities for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

-- Assets (Hooks & Demos)
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type text not null check (type in ('hook', 'demo')),
  name text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  file_size integer,
  created_at timestamptz default now()
);

alter table public.assets enable row level security;

create policy "Users can view own assets"
  on public.assets for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own assets"
  on public.assets for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own assets"
  on public.assets for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

-- Combinations (Hook x Demo pairs with captions)
create table public.combinations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  hook_id uuid references public.assets(id) on delete cascade not null,
  demo_id uuid references public.assets(id) on delete cascade not null,
  caption text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.combinations enable row level security;

create policy "Users can view own combinations"
  on public.combinations for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own combinations"
  on public.combinations for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can update own combinations"
  on public.combinations for update
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own combinations"
  on public.combinations for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger app_identities_updated_at
  before update on public.app_identities
  for each row execute function public.set_updated_at();

create trigger combinations_updated_at
  before update on public.combinations
  for each row execute function public.set_updated_at();

-- Storage bucket for assets
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Storage policies: authenticated users can upload to their workspace folder
create policy "Authenticated users can upload assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'assets');

create policy "Anyone can view public assets"
  on storage.objects for select
  using (bucket_id = 'assets');

create policy "Authenticated users can delete own assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'assets');
