"use client";

import { useState } from "react";
import { Check, FolderKanban, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { cn } from "@/lib/utils";

// Project management surface for the Overview tab: list, select, create, and
// delete projects. All state lives in the shared ProjectProvider context.
export function ProjectOverview() {
  const {
    projects,
    activeProjectId,
    selectProject,
    createProject,
    deleteProject,
  } = useActiveProject();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const id = await createProject(name);
    setSubmitting(false);
    if (id) {
      setName("");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteProject(id);
    setDeletingId(null);
    setConfirmId(null);
  }

  const empty = projects.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-[#666]">
            Each project keeps its own brand identity, assets, carousels, and
            connected accounts.
          </p>
        </div>
        {!empty && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-[var(--ember)] px-3.5 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
          >
            <Plus className="h-4 w-4" />
            New project
          </button>
        )}
      </div>

      {(creating || empty) && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="new-project"
              className="mb-1.5 block text-sm font-medium"
            >
              {empty ? "Create your first project" : "Project name"}
            </label>
            <input
              id="new-project"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Store, Personal brand"
              className="w-full rounded-lg border-2 border-black px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg border-2 border-black bg-[var(--ember)] px-5 py-2.5 font-semibold text-white shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create
            </button>
            {!empty && (
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setName("");
                }}
                className="rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {!empty && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const active = p.id === activeProjectId;
            const confirming = confirmId === p.id;
            const deleting = deletingId === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-xl border-2 bg-white p-4 shadow-[3px_3px_0_0_#000] transition-colors",
                  active ? "border-[var(--ember)]" : "border-black",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className="flex items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black text-sm font-bold text-white",
                      active ? "bg-[var(--ember)]" : "bg-[#1a1a1a]",
                    )}
                  >
                    {(p.name?.trim()[0] ?? "P").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ember)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--ember)]">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </span>
                    {p.app_url ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-[#666]">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {p.app_url.replace(/^https?:\/\//, "")}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-[#999]">
                        No website yet
                      </span>
                    )}
                  </span>
                </button>

                <div className="flex items-center justify-between border-t-2 border-black/5 pt-2">
                  {!active ? (
                    <button
                      type="button"
                      onClick={() => selectProject(p.id)}
                      className="text-xs font-semibold text-[var(--ember)] hover:underline"
                    >
                      Switch to project
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#999]">
                      <FolderKanban className="h-3.5 w-3.5" /> Current
                    </span>
                  )}

                  {confirming ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting}
                        className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {deleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Delete"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        disabled={deleting}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(p.id)}
                      title="Delete project"
                      className="rounded-md p-1.5 text-[#999] transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
