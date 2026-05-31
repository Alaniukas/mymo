-- Hook animation model (admin /admin settings). Safe to run alone if 026 was skipped.
alter table public.app_settings
  add column if not exists hook_video_model text;
