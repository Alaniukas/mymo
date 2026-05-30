-- Deep structural analysis of imported carousel templates (layout, composition,
-- text zones, narrative arc). Populated at import time by analyzeTemplateBlueprint().

alter table public.carousel_templates
  add column if not exists blueprint jsonb,
  add column if not exists blueprint_analyzed_at timestamptz;

-- Link generated carousels back to the template they replicated (studio mode).
alter table public.carousels
  add column if not exists template_id uuid references public.carousel_templates(id) on delete set null;
