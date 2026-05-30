"use server";

// Server Actions for managing projects (workspaces) and the active-project
// cookie. Imported by the client ProjectProvider; each action validates the
// signed-in user, mutates state, updates the `mymo_active_project` cookie, and
// revalidates the dashboard so server components re-resolve the active project.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createProject as createProjectRow } from "@/lib/carousel/brand-identity";
import { ACTIVE_PROJECT_COOKIE, listProjects } from "./active";
import { cleanupProjectStorage } from "./cleanup";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function writeActiveCookie(id: string | null) {
  const cookieStore = await cookies();
  if (id) {
    cookieStore.set(ACTIVE_PROJECT_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  } else {
    cookieStore.delete(ACTIVE_PROJECT_COOKIE);
  }
}

export type ProjectActionResult =
  | { ok: true; activeProjectId: string | null }
  | { ok: false; error: string };

/** Creates a project and makes it the active one. */
export async function createProjectAction(
  name: string,
): Promise<ProjectActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    const created = await createProjectRow(supabase, user.id, { name });
    await writeActiveCookie(created.id);
    revalidatePath("/dashboard", "layout");
    return { ok: true, activeProjectId: created.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project.";
    return { ok: false, error: message };
  }
}

/** Switches the active project after verifying the user owns it. */
export async function selectProjectAction(
  id: string,
): Promise<ProjectActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) return { ok: false, error: "Project not found." };

  await writeActiveCookie(id);
  revalidatePath("/dashboard", "layout");
  return { ok: true, activeProjectId: id };
}

/**
 * Deletes a project. All content cascades via the `workspace_id` foreign keys
 * (on delete cascade). The active project is then repointed at the newest
 * remaining project (or cleared when none are left).
 */
export async function deleteProjectAction(
  id: string,
): Promise<ProjectActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) return { ok: false, error: "Project not found." };

  // Remove storage objects before the row delete cascades their DB rows away
  // (paths would otherwise be unrecoverable). Non-fatal if it fails.
  await cleanupProjectStorage(supabase, id);

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const remaining = await listProjects(supabase, user.id);
  const nextActiveId = remaining[0]?.id ?? null;
  await writeActiveCookie(nextActiveId);
  revalidatePath("/dashboard", "layout");
  return { ok: true, activeProjectId: nextActiveId };
}
