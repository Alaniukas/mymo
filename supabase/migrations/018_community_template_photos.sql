-- Point seed community template slides at real JPG photos (replaces SVG placeholders).

update public.community_templates
set slides = (
  select jsonb_agg(
    jsonb_set(
      elem,
      '{image_url}',
      to_jsonb(
        regexp_replace(elem->>'image_url', '\.svg$', '.jpg')
      )
    )
    order by (elem->>'position')::int
  )
  from jsonb_array_elements(slides) as elem
)
where is_seed = true
  and slides::text like '%.svg%';
