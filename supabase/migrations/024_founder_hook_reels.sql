-- Founder Hook Reels engine
--
-- A 5th content engine for app founders: AI generates ultra-realistic UGC
-- creator video hooks (Nano Banana image -> Seedance animation) stitched in
-- front of the founder's uploaded app demo clips, with minimalist TikTok-style
-- storyline text overlays. Each generated reel is a video carousel
-- (media_type = 'video') tagged content_type = 'founder_hook'.

-- Broaden the content_type set to include the founder hook reels engine.
alter table public.carousels
  drop constraint if exists carousels_content_type_check;

alter table public.carousels
  add constraint carousels_content_type_check
  check (content_type in (
    'carousel', 'brand_story', 'viral_meme', 'founder_hook'
  ));
