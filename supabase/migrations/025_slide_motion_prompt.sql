-- Per-slide motion prompt for the image->video animation phase.
--
-- The Founder Hook Reels engine plans a specific emotional performance for each
-- AI creator hook (e.g. "tears up, then breaks into a joyful smile"). Storing it
-- per slide lets the video phase animate that exact motion instead of the
-- generic cinematic push-in. NULL keeps the existing default behavior, so this
-- is backward-compatible for every other video carousel.

alter table public.carousel_slides
  add column if not exists motion_prompt text;
