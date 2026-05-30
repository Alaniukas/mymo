-- Add caption column to carousel_slides for text overlay on generated images
alter table public.carousel_slides
  add column if not exists caption text;
