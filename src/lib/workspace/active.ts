// Active-project resolution.
//
// A "project" is a `workspaces` row. The app used to assume one workspace per
// user; now a user can have many, and the *active* one is tracked in an
// httpOnly cookie. This module is the single source of truth for resolving the
// active project on the server (layout, Overview page, API routes), validating
// that the cookie still points at a project the user owns and falling back to
// the newest project when it doesn't.
//
// Server-only by construction: it reads cookies via `next/headers`, which
// throws if pulled into a Client Component, so it must only be used from
// layouts, pages, route handlers, and Server Actions.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ProjectSummary } from "./types";

export type { ProjectSummary };

export const ACTIVE_PROJECT_COOKIE = "mymo_active_project";

/**
 * Lists every project (workspace) owned by the user, newest first. Selects the
 * `niche` column but degrades gracefully if migration 012 hasn't run yet.
 */
export async function listProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProjectSummary[]> {
  const withNiche = await supabase
    .from("workspaces")
    .select("id, name, app_url, niche, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!withNiche.error) {
    return (withNiche.data ?? []) as ProjectSummary[];
  }

  const fallback = await supabase
    .from("workspaces")
    .select("id, name, app_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return ((fallback.data ?? []) as Omit<ProjectSummary, "niche">[]).map((w) => ({
    ...w,
    niche: null,
  }));
}

// Pick the active id from the cookie, validating it against the owned set and
// falling back to the newest project. Returns null when the user has none.
function pickActiveId(
  projects: ProjectSummary[],
  cookieId: string | undefined,
): string | null {
  if (projects.length === 0) return null;
  if (cookieId && projects.some((p) => p.id === cookieId)) return cookieId;
  return projects[0].id;
}

/**
 * Resolves the active project id for a user with an existing Supabase client
 * (used by API route handlers). Returns null when the user has no projects.
 */
export async function resolveActiveWorkspaceId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const projects = await listProjects(supabase, userId);
  const cookieStore = await cookies();
  return pickActiveId(projects, cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value);
}

export interface ResolvedActiveWorkspace {
  activeProjectId: string | null;
  projects: ProjectSummary[];
}

/**
 * Resolves the active project id and the full project list for a user, given an
 * existing Supabase client. Lets callers that already have a client + user
 * (e.g. the dashboard layout) avoid an extra auth round-trip.
 */
export async function resolveActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedActiveWorkspace> {
  const projects = await listProjects(supabase, userId);
  const cookieStore = await cookies();
  const activeProjectId = pickActiveId(
    projects,
    cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value,
  );
  return { activeProjectId, projects };
}

export interface ActiveWorkspace extends ResolvedActiveWorkspace {
  userId: string | null;
}

/**
 * Resolves the current user, their projects, and the active project id in one
 * pass. Used by the Overview page, which doesn't otherwise hold a client.
 */
export async function getActiveWorkspace(): Promise<ActiveWorkspace> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, activeProjectId: null, projects: [] };
  }

  const { activeProjectId, projects } = await resolveActiveWorkspace(
    supabase,
    user.id,
  );
  return { userId: user.id, activeProjectId, projects };
}
