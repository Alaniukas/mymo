-- Video carousels: animate generated slide images into short video clips.
--
-- A carousel is either an image carousel (default, existing behaviour) or a
-- video carousel. Video carousels still generate slide IMAGES first (the image
-- phase, tracked by the existing status/evolink_task_id/image_url columns) and
-- then animate each finished image into a clip via EvoLink image-to-video (the
-- video phase, tracked by the new video_* columns below).

alter table public.carousels
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));

alter table public.carousel_slides
  add column if not exists video_status text
    check (video_status in ('pending', 'generating', 'completed', 'failed')),
  add column if not exists video_task_id text,
  add column if not exists video_url text,
  add column if not exists video_storage_path text;
