-- Community Templates: public template marketplace with votes and downloads.
--
-- Separate from carousel_templates (private style references). Community
-- templates are shared, votable, and downloadable into a user's workspace
-- library via the download API.

create table public.community_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  title text not null,
  description text,
  niche text not null
    check (niche in ('ecomm', 'app', 'personal_brand', 'viral')),
  slides jsonb not null default '[]'::jsonb,
  source_url text,
  source_platform text
    check (source_platform is null or source_platform in ('instagram', 'tiktok')),
  upvote_count int not null default 0,
  downvote_count int not null default 0,
  download_count int not null default 0,
  is_seed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index community_templates_niche_idx
  on public.community_templates (niche);
create index community_templates_created_idx
  on public.community_templates (created_at desc);
create index community_templates_downloads_idx
  on public.community_templates (download_count desc);
create index community_templates_score_idx
  on public.community_templates ((upvote_count - downvote_count) desc);

create table public.community_template_votes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.community_templates(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz default now(),
  unique (template_id, user_id)
);

create index community_template_votes_user_idx
  on public.community_template_votes (user_id);

-- Recalculate denormalized vote counts when votes change (incremental so seed
-- base counts are preserved).
create or replace function public.sync_community_template_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.vote = 1 then
      update public.community_templates
      set upvote_count = upvote_count + 1
      where id = new.template_id;
    else
      update public.community_templates
      set downvote_count = downvote_count + 1
      where id = new.template_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.vote = 1 then
      update public.community_templates
      set upvote_count = greatest(0, upvote_count - 1)
      where id = old.template_id;
    else
      update public.community_templates
      set downvote_count = greatest(0, downvote_count - 1)
      where id = old.template_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.vote = 1 then
      update public.community_templates
      set upvote_count = greatest(0, upvote_count - 1)
      where id = old.template_id;
    else
      update public.community_templates
      set downvote_count = greatest(0, downvote_count - 1)
      where id = old.template_id;
    end if;
    if new.vote = 1 then
      update public.community_templates
      set upvote_count = upvote_count + 1
      where id = new.template_id;
    else
      update public.community_templates
      set downvote_count = downvote_count + 1
      where id = new.template_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

create trigger community_template_votes_sync_insert
  after insert on public.community_template_votes
  for each row execute function public.sync_community_template_vote_counts();

create trigger community_template_votes_sync_update
  after update on public.community_template_votes
  for each row execute function public.sync_community_template_vote_counts();

create trigger community_template_votes_sync_delete
  after delete on public.community_template_votes
  for each row execute function public.sync_community_template_vote_counts();

create trigger community_templates_updated_at
  before update on public.community_templates
  for each row execute function public.set_updated_at();

alter table public.community_templates enable row level security;
alter table public.community_template_votes enable row level security;

-- All authenticated users can browse community templates.
create policy "Authenticated users can view community templates"
  on public.community_templates for select
  to authenticated
  using (true);

create policy "Users can publish community templates"
  on public.community_templates for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_seed = false
  );

create policy "Users can update own community templates"
  on public.community_templates for update
  to authenticated
  using (user_id = auth.uid() and is_seed = false);

create policy "Users can delete own community templates"
  on public.community_templates for delete
  to authenticated
  using (user_id = auth.uid() and is_seed = false);

create policy "Users can view own votes"
  on public.community_template_votes for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own votes"
  on public.community_template_votes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own votes"
  on public.community_template_votes for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own votes"
  on public.community_template_votes for delete
  to authenticated
  using (user_id = auth.uid());

-- Seed templates with placeholder slide URLs (served from /public).
insert into public.community_templates
  (id, user_id, author_name, title, description, niche, slides, upvote_count, downvote_count, download_count, is_seed)
values
  (
    'a1000001-0000-4000-8000-000000000001',
    null, '@creatorhub', 'POV: You Just Discovered This',
    'Immersive POV hook carousel that puts the viewer in a relatable scenario.',
    'viral',
    '[{"position":1,"image_url":"/community-templates/pov-discovered/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/pov-discovered/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/pov-discovered/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/pov-discovered/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/pov-discovered/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/pov-discovered/slide-6.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    847, 23, 312, true
  ),
  (
    'a1000002-0000-4000-8000-000000000002',
    null, 'Maya K.', '5 Lessons I Wish I Knew Sooner',
    'Personal brand listicle with one lesson per slide.',
    'personal_brand',
    '[{"position":1,"image_url":"/community-templates/five-lessons/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/five-lessons/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/five-lessons/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/five-lessons/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/five-lessons/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/five-lessons/slide-6.jpg","storage_path":"","media_type":"image"},{"position":7,"image_url":"/community-templates/five-lessons/slide-7.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    612, 41, 278, true
  ),
  (
    'a1000003-0000-4000-8000-000000000003',
    null, '@growthlab', 'Myth vs Reality',
    'Side-by-side myth busting format that drives saves.',
    'viral',
    '[{"position":1,"image_url":"/community-templates/myth-vs-reality/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/myth-vs-reality/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/myth-vs-reality/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/myth-vs-reality/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/myth-vs-reality/slide-5.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    534, 67, 201, true
  ),
  (
    'a1000004-0000-4000-8000-000000000004',
    null, '@shopflow', 'Before → After Transformation',
    'E-commerce transformation story across slides.',
    'ecomm',
    '[{"position":1,"image_url":"/community-templates/before-after/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/before-after/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/before-after/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/before-after/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/before-after/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/before-after/slide-6.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    421, 18, 189, true
  ),
  (
    'a1000005-0000-4000-8000-000000000005',
    null, 'DevTips Daily', 'Step-by-Step Tutorial (1/7)',
    'Educational how-to with numbered steps and progress dots.',
    'app',
    '[{"position":1,"image_url":"/community-templates/step-by-step/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/step-by-step/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/step-by-step/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/step-by-step/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/step-by-step/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/step-by-step/slide-6.jpg","storage_path":"","media_type":"image"},{"position":7,"image_url":"/community-templates/step-by-step/slide-7.jpg","storage_path":"","media_type":"image"},{"position":8,"image_url":"/community-templates/step-by-step/slide-8.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    389, 29, 156, true
  ),
  (
    'a1000006-0000-4000-8000-000000000006',
    null, '@viralvault', 'Red Flags / Green Flags',
    'High-engagement comparison format for any niche.',
    'viral',
    '[{"position":1,"image_url":"/community-templates/red-green-flags/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/red-green-flags/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/red-green-flags/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/red-green-flags/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/red-green-flags/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/red-green-flags/slide-6.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    712, 89, 445, true
  ),
  (
    'a1000007-0000-4000-8000-000000000007',
    null, 'Jordan Lee', 'Hot Take Nobody Talks About',
    'Contrarian opener that sparks comments and shares.',
    'personal_brand',
    '[{"position":1,"image_url":"/community-templates/hot-take/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/hot-take/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/hot-take/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/hot-take/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/hot-take/slide-5.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    298, 112, 134, true
  ),
  (
    'a1000008-0000-4000-8000-000000000008',
    null, '@saasstudio', 'The Framework That Changed Everything',
    'Proprietary mental model carousel for thought leadership.',
    'app',
    '[{"position":1,"image_url":"/community-templates/framework/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/framework/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/framework/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/framework/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/framework/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/framework/slide-6.jpg","storage_path":"","media_type":"image"},{"position":7,"image_url":"/community-templates/framework/slide-7.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    445, 31, 198, true
  ),
  (
    'a1000009-0000-4000-8000-000000000009',
    null, '@brandcompare', 'Us vs Them Comparison',
    'Product comparison carousel for DTC and SaaS.',
    'ecomm',
    '[{"position":1,"image_url":"/community-templates/us-vs-them/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/us-vs-them/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/us-vs-them/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/us-vs-them/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/us-vs-them/slide-5.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    267, 22, 98, true
  ),
  (
    'a1000010-0000-4000-8000-000000000010',
    null, '@saveworthy', 'Save This Checklist',
    'Bookmark-bait educational checklist with 8 actionable items.',
    'viral',
    '[{"position":1,"image_url":"/community-templates/save-checklist/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/save-checklist/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/save-checklist/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/save-checklist/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/save-checklist/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/save-checklist/slide-6.jpg","storage_path":"","media_type":"image"},{"position":7,"image_url":"/community-templates/save-checklist/slide-7.jpg","storage_path":"","media_type":"image"},{"position":8,"image_url":"/community-templates/save-checklist/slide-8.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    923, 45, 567, true
  ),
  (
    'a1000011-0000-4000-8000-000000000011',
    null, 'Copy Coach Ana', 'Problem → Agitate → Solution',
    'Classic PAS copywriting arc adapted for carousels.',
    'personal_brand',
    '[{"position":1,"image_url":"/community-templates/pas-framework/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/pas-framework/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/pas-framework/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/pas-framework/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/pas-framework/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/pas-framework/slide-6.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    356, 28, 167, true
  ),
  (
    'a1000012-0000-4000-8000-000000000012',
    null, 'ProductPulse', 'Feature Walkthrough Carousel',
    'App product demo with numbered feature highlights.',
    'app',
    '[{"position":1,"image_url":"/community-templates/feature-walkthrough/slide-1.jpg","storage_path":"","media_type":"image"},{"position":2,"image_url":"/community-templates/feature-walkthrough/slide-2.jpg","storage_path":"","media_type":"image"},{"position":3,"image_url":"/community-templates/feature-walkthrough/slide-3.jpg","storage_path":"","media_type":"image"},{"position":4,"image_url":"/community-templates/feature-walkthrough/slide-4.jpg","storage_path":"","media_type":"image"},{"position":5,"image_url":"/community-templates/feature-walkthrough/slide-5.jpg","storage_path":"","media_type":"image"},{"position":6,"image_url":"/community-templates/feature-walkthrough/slide-6.jpg","storage_path":"","media_type":"image"},{"position":7,"image_url":"/community-templates/feature-walkthrough/slide-7.jpg","storage_path":"","media_type":"image"}]'::jsonb,
    198, 15, 89, true
  );

-- Community uploads use the existing templates bucket under community/{userId}/...
create policy "Authenticated users can upload community template images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] = 'community'
  );

create policy "Authenticated users can delete own community template images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] = 'community'
  );

-- Increment download_count on any template (including seeds) via API.
create or replace function public.increment_community_download(template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_templates
  set download_count = download_count + 1
  where id = template_id;
end;
$$;

grant execute on function public.increment_community_download(uuid) to authenticated;
