-- Five reusable "crying with joy" hook templates for the template library.
-- Preview videos are generated via scripts/generate-hook-template-previews.mjs
-- (Nano Banana 2 image + Seedance 1.5 Pro animation).

insert into public.hook_templates (
  title, hook_line, creator_prompt, motion_prompt, kind, sort_order, published
) values
  (
    'Joy cry — dorm breakthrough',
    'i literally sobbed when this finally worked',
    'early-20s Latina woman with natural curly hair and minimal makeup, oversized college hoodie, cozy dorm room with warm string lights, eyes glassy and cheeks flushed, overwhelmed happy tears starting, looking directly at camera',
    'eyes well up with happy tears, she covers her mouth then laughs through joyful sobs, tears roll down her cheeks as she nods with relieved disbelief at the camera, silent emotional reaction',
    'template',
    10,
    true
  ),
  (
    'Joy cry — café moment',
    'wait… i actually cried happy tears over this',
    'mid-20s East Asian woman with a sleek black bob, soft café window light, cream knit sweater, delicate gold earrings, single tear on her cheek, bright grateful smile breaking through, authentic UGC selfie angle',
    'a tear rolls down her cheek, she wipes it and breaks into a radiant smile, more happy tears as she shakes her head in disbelief and laughs quietly with joy at the camera',
    'template',
    11,
    true
  ),
  (
    'Joy cry — couch relief',
    'ok i''m not crying you''re crying (happy tears)',
    'early-20s Black woman with box braids and gold hoops, sunk into a cream couch, golden-hour apartment light, mascara slightly smudged from happy tears, hand on chest, raw relieved expression facing camera',
    'she exhales shakily, tears spill as she smiles through them, she laughs with relief and dabs her eyes while nodding gratefully at the camera, pure joy crying',
    'template',
    12,
    true
  ),
  (
    'Joy cry — post-win',
    'i did NOT expect to cry over an app but here we are',
    'mid-20s redhead woman with freckles and a messy ponytail, post-workout glow, locker-room mirror selfie vibe, green eyes wet with tears, proud overwhelmed grin, athletic zip-up, looking at camera',
    'happy tears stream down as she grins wider, she sniffles and laughs through joyful crying, shoulders relax with relief while she keeps eye contact with the camera',
    'template',
    13,
    true
  ),
  (
    'Joy cry — late-night win',
    'tell me why this made me cry at 2am (good tears)',
    'early-20s South Asian woman with long wavy hair loose over shoulders, fairy lights in bedroom background, oversized tee, no heavy makeup, eyes shining with happy tears, soft disbelieving smile at camera',
    'eyes glisten, tears fall as she smiles bigger, she laughs softly through happy crying and presses a hand to her heart while looking at the camera with grateful joy',
    'template',
    14,
    true
  );

-- Prefer Seedance 1.5 Pro for founder hook animation (realistic faces + silent reactions).
update public.app_settings
set hook_video_model = 'seedance-1.5-pro'
where id = 1 and (hook_video_model is null or hook_video_model = 'seedance-2.0-fast-image-to-video');
