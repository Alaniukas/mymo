-- Carousel Templates: reusable, niche-categorized references for "remixing".
--
-- A template is a scraped public IG/TikTok carousel whose slide images are
-- re-hosted in the `templates` bucket. Templates are NOT publishable carousels;
-- they only feed the carousel generator as visual style references.
--
-- Scope:
--   workspace_id NULL -> global template (admin-curated, visible to everyone)
--   workspace_id set  -> private to that workspace (user-imported)

create table public.carousel_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  niche text not null
    check (niche in ('ecomm', 'app', 'personal_brand', 'viral')),
  title text not null,
  source_url text,
  source_platform text
    check (source_platform in ('instagram', 'tiktok')),
  caption text,
  -- Ordered slides. Each: { position, image_url, storage_path, media_type }.
  -- Video slides also carry { video_url, video_storage_path }; image_url is then
  -- the cover/poster still. Example:
  --   [{ "position": 1, "image_url": "...", "storage_path": "...",
  --      "media_type": "video", "video_url": "...", "video_storage_path": "..." }]
  slides jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index carousel_templates_niche_idx
  on public.carousel_templates (niche);
create index carousel_templates_workspace_idx
  on public.carousel_templates (workspace_id);

alter table public.carousel_templates enable row level security;

-- Everyone can read global templates (workspace_id is null) plus their own.
create policy "Users can view global and own templates"
  on public.carousel_templates for select
  using (
    workspace_id is null
    or workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

-- Users can only create/update/delete templates in their own workspace.
-- Global templates (workspace_id null) are managed with the service-role key.
create policy "Users can create own templates"
  on public.carousel_templates for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can update own templates"
  on public.carousel_templates for update
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can delete own templates"
  on public.carousel_templates for delete
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create trigger carousel_templates_updated_at
  before update on public.carousel_templates
  for each row execute function public.set_updated_at();

-- Storage bucket for re-hosted template slide images
insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload template images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'templates');

create policy "Anyone can view template images"
  on storage.objects for select
  using (bucket_id = 'templates');

create policy "Authenticated users can delete template images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'templates');
