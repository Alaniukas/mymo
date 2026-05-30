-- Angle (framework) analytics.
--
-- A lightweight, append-only event log so we can compute which angles/templates
-- actually convert: how many were generated vs. published/exported. Each row is
-- tagged with the framework id + machine `angle` key (e.g. pain_point,
-- social_proof) so the dashboard can show a win-rate by angle.

create table public.content_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  carousel_id uuid references public.carousels(id) on delete set null,
  framework_id text,
  angle text,
  event_type text not null
    check (event_type in ('generated', 'published', 'exported', 'edited')),
  platform text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index content_events_workspace_idx
  on public.content_events (workspace_id, created_at desc);
create index content_events_angle_idx
  on public.content_events (workspace_id, angle);

alter table public.content_events enable row level security;

-- Append-only from the app's perspective: select + insert only (no update/delete
-- policies), scoped to the caller's workspaces.
create policy "Users can view own content events"
  on public.content_events for select
  using (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Users can create own content events"
  on public.content_events for insert
  with check (
    workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );
