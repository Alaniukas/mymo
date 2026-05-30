"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  FolderKanban,
  Loader2,
  Plus,
} from "lucide-react";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { cn } from "@/lib/utils";

// Always-visible project selector for the sidebar. Shows the active project,
// lets the user switch between projects, and create a new one inline.
export function ProjectSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { projects, activeProject, activeProjectId, selectProject, createProject, pending } =
    useActiveProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const id = await createProject(name);
    setSubmitting(false);
    if (id) {
      setName("");
      setCreating(false);
      setOpen(false);
    }
  }

  const label = activeProject?.name ?? "Select project";
  const initial = (activeProject?.name?.trim()[0] ?? "P").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border-2 border-black bg-white px-2.5 py-2 text-left shadow-[2px_2px_0_0_#000] transition-colors hover:bg-white/80",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-black bg-[var(--ember)] text-xs font-bold text-white">
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#0a0a0a]/45">
                Project
              </span>
              <span className="block truncate text-sm font-semibold text-[#1a1a1a]">
                {label}
              </span>
            </span>
            {pending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#999]" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#999]" />
            )}
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 mt-2 rounded-xl border-2 border-black bg-white p-1 shadow-[3px_3px_0_0_#000]",
            collapsed ? "left-0 w-56" : "inset-x-0",
          )}
        >
          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 && (
              <p className="px-3 py-2 text-xs text-[#999]">No projects yet</p>
            )}
            {projects.map((p) => {
              const active = p.id === activeProjectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    selectProject(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100",
                    active && "font-semibold",
                  )}
                >
                  <FolderKanban className="h-4 w-4 shrink-0 text-[#666]" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 text-[var(--ember)]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-1 border-t-2 border-black/10 pt-1">
            {creating ? (
              <form onSubmit={handleCreate} className="flex items-center gap-1.5 p-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  className="min-w-0 flex-1 rounded-lg border-2 border-black px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[var(--ember)] text-white disabled:opacity-60"
                  aria-label="Create project"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#333] transition-colors hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                <span>New project</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
