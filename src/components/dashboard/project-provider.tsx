"use client";

// Client context that mirrors the server-resolved active project. The dashboard
// layout seeds it with `{ activeProjectId, projects }`; every Client Component
// reads the active project from here instead of re-querying "the" workspace.
//
// The Server Actions own the source of truth (the cookie + DB); after each one
// we `router.refresh()` so the layout re-resolves and re-seeds this provider,
// which in turn re-runs any client effects keyed on `activeProjectId`.

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  createProjectAction,
  selectProjectAction,
  deleteProjectAction,
} from "@/lib/workspace/actions";
import type { ProjectSummary } from "@/lib/workspace/types";

interface ProjectContextValue {
  activeProjectId: string | null;
  activeProject: ProjectSummary | null;
  projects: ProjectSummary[];
  /** True while a switch/create/delete is in flight. */
  pending: boolean;
  selectProject: (id: string) => void;
  createProject: (name: string) => Promise<string | null>;
  deleteProject: (id: string) => Promise<boolean>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  activeProjectId,
  projects,
  children,
}: {
  activeProjectId: string | null;
  projects: ProjectSummary[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Optimistic flag for the async (non-transition) create/delete paths.
  const [busy, setBusy] = useState(false);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? null;

  function selectProject(id: string) {
    if (id === activeProjectId) return;
    startTransition(async () => {
      await selectProjectAction(id);
      router.refresh();
    });
  }

  async function createProject(name: string): Promise<string | null> {
    setBusy(true);
    try {
      const res = await createProjectAction(name);
      if (!res.ok) return null;
      router.refresh();
      return res.activeProjectId;
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(id: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await deleteProjectAction(id);
      if (!res.ok) return false;
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProjectContext.Provider
      value={{
        activeProjectId,
        activeProject,
        projects,
        pending: isPending || busy,
        selectProject,
        createProject,
        deleteProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useActiveProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within a ProjectProvider");
  }
  return ctx;
}
