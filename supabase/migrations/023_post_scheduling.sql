-- Post scheduling
--
-- WoopSocial natively supports SCHEDULE_FOR_LATER, so a scheduled post is created
-- on WoopSocial up-front (with the target publish time) and WoopSocial publishes it
-- automatically. We mirror the queued post locally with a `scheduled` status and the
-- `scheduled_for` timestamp so the dashboard can show + cancel the queue.

alter table public.social_posts
  add column if not exists scheduled_for timestamptz;

-- Broaden the status set to include the queued + cancelled states.
alter table public.social_posts
  drop constraint if exists social_posts_status_check;

alter table public.social_posts
  add constraint social_posts_status_check
  check (status in (
    'pending', 'publishing', 'published', 'failed', 'scheduled', 'canceled'
  ));

-- Fast lookup of the upcoming queue per workspace/carousel.
create index if not exists social_posts_scheduled_for_idx
  on public.social_posts (scheduled_for)
  where status = 'scheduled';
