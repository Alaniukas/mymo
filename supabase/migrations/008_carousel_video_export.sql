-- Carousel video export: compile a carousel's slide images into a single MP4.
--
-- Separate from the per-slide video clips added in migration 005. This is a
-- built-in FFmpeg "slideshow" render of the finished slide IMAGES into one
-- downloadable MP4 (optionally with the carousel's attached trending sound as
-- the audio track). The export is tracked on the carousel row below; the
-- rendered file lives in the public `carousels` storage bucket.

alter table public.carousels
  add column if not exists export_status text
    check (export_status in ('rendering', 'ready', 'failed')),
  add column if not exists export_video_url text,
  add column if not exists export_video_storage_path text,
  add column if not exists export_options jsonb,
  add column if not exists export_error text;
