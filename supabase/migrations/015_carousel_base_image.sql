-- Multi-asset carousels: caption-after-generation support.
--
-- When several approved combinations are combined into a single carousel, the
-- slide IMAGES are generated first (clean, text-free) and the captions are
-- written + burned on afterward so they fit the actual generated visuals.
--
-- base_image_url stores the clean, pre-overlay image. The finalize step always
-- composites the caption from this clean base, so re-finalizing after a caption
-- edit re-burns from scratch instead of stacking text on an already-captioned
-- image.

alter table public.carousel_slides
  add column if not exists base_image_url text;
