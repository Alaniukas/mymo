-- Viral hook templates for Founder Hook Reels (premade by us + reusable templates).
-- Replaces carousel/community template galleries for the founder-focused product.

create table public.hook_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hook_line text not null,
  creator_prompt text not null,
  motion_prompt text not null,
  preview_image_url text,
  preview_video_url text,
  kind text not null default 'template'
    check (kind in ('premade', 'template')),
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hook_templates_kind_idx on public.hook_templates (kind);
create index hook_templates_published_idx on public.hook_templates (published, sort_order);

alter table public.hook_templates enable row level security;

create policy "Authenticated users can read published hook templates"
  on public.hook_templates for select
  to authenticated
  using (published = true);

create trigger hook_templates_updated_at
  before update on public.hook_templates
  for each row execute function public.set_updated_at();

-- Dedicated image-to-video model for founder hook animation (falls back to video_model in app code).
alter table public.app_settings
  add column if not exists hook_video_model text;

-- Remove legacy carousel/community template rows (tables kept for legacy studio URLs).
delete from public.community_template_votes;
delete from public.community_templates;
delete from public.carousel_templates;

-- Seed starter premade hooks (admin can edit in /admin/hooks).
insert into public.hook_templates (
  title, hook_line, creator_prompt, motion_prompt, kind, sort_order
) values
  (
    'Tears of joy',
    'i literally cried when this finally worked',
    'early-20s woman with natural makeup and messy bun, oversized hoodie, cozy sunlit bedroom, eyes glassy with happy tears, overwhelmed relief',
    'eyes well up, a tear rolls down, then she breaks into a joyful relieved smile and laughs through happy tears while looking at the camera',
    'premade',
    1
  ),
  (
    'Shocked discovery',
    'wait… why did nobody tell me about this',
    'mid-20s woman in athleisure, high ponytail, bright modern kitchen, wide-eyed surprised expression, hand near mouth',
    'jaw drops in genuine surprise, eyebrows lift, then an excited disbelieving grin while talking to the camera',
    'premade',
    2
  ),
  (
    'Relieved grin',
    'ok this actually fixed it for me',
    '20s woman with sleek straight hair, minimal gold jewelry, neutral apartment, soft window light, calm but visibly moved',
    'slow emotional breath, eyes softening and glistening, then a warm grateful smile and nod at the camera',
    'premade',
    3
  );
