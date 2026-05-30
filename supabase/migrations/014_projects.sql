-- Projects = workspaces.
--
-- A user can now own many workspaces, each surfaced in the app as a "project"
-- (see src/lib/workspace/active.ts). Listing a user's projects and resolving the
-- active one both order by newest-first, so this composite index keeps that hot
-- path fast as the number of projects grows. `if not exists` so re-running is
-- safe; no schema/data change is required for the feature itself.

create index if not exists workspaces_user_created_idx
  on public.workspaces (user_id, created_at desc);
