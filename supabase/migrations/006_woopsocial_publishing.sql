-- WoopSocial unified publishing backend
--
-- Replaces the direct Instagram (Facebook Graph) + TikTok OAuth/publishing code
-- with WoopSocial as the single managed publishing provider. WoopSocial owns the
-- platform OAuth apps and the publishing, so the app only ever holds one API key
-- and stores a reference to each connected social account.
--
-- Supported platforms now: instagram, tiktok, linkedin, linkedin_pages,
-- facebook, x, youtube, pinterest.

-- 1. Map each workspace to a WoopSocial project (isolates accounts/media/posts
--    per tenant). Populated lazily on first social-account connect.
alter table public.workspaces
  add column if not exists woopsocial_project_id text;

-- 2. social_connections: broaden the platform set and attach WoopSocial ids.
alter table public.social_connections
  drop constraint if exists social_connections_platform_check;

alter table public.social_connections
  add constraint social_connections_platform_check
  check (platform in (
    'instagram', 'tiktok', 'linkedin', 'linkedin_pages',
    'facebook', 'x', 'youtube', 'pinterest'
  ));

-- WoopSocial holds the OAuth credentials on its side, so we no longer require a
-- locally stored access token.
alter table public.social_connections
  alter column access_token drop not null;

alter table public.social_connections
  add column if not exists provider text not null default 'woopsocial',
  add column if not exists woopsocial_account_id text,
  add column if not exists woopsocial_project_id text,
  add column if not exists avatar_url text;

-- 3. social_posts: allow the broader platform set.
alter table public.social_posts
  drop constraint if exists social_posts_platform_check;

alter table public.social_posts
  add constraint social_posts_platform_check
  check (platform in (
    'instagram', 'tiktok', 'linkedin', 'linkedin_pages',
    'facebook', 'x', 'youtube', 'pinterest'
  ));

-- 4. carousels: allow new target platforms (keep legacy 'both').
alter table public.carousels
  drop constraint if exists carousels_platform_check;

alter table public.carousels
  add constraint carousels_platform_check
  check (platform in (
    'instagram', 'tiktok', 'both', 'linkedin', 'linkedin_pages',
    'facebook', 'x', 'youtube', 'pinterest'
  ));
