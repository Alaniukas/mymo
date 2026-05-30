"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Plus,
  Sparkles,
  LayoutTemplate,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isNiche, nicheLabel, type NicheSlug } from "@/lib/carousel/niches";
import {
  NICHE_META,
  presetsForNiche,
} from "@/lib/carousel/template-presets";
import { TemplateCard, type TemplateCardItem } from "./template-card";
import { AddTemplateModal } from "./add-template-modal";
import {
  TemplatePreviewModal,
  type TemplatePreviewData,
} from "./template-preview-modal";
import { fetchCarouselTemplates } from "@/lib/carousel/fetch-templates";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";

interface TemplateSlide {
  position: number;
  image_url: string;
  storage_path: string;
  media_type?: "image" | "video";
  video_url?: string | null;
  video_storage_path?: string | null;
}

interface Template {
  id: string;
  workspace_id: string | null;
  niche: string;
  title: string;
  source_url: string | null;
  source_platform: string | null;
  caption: string | null;
  slides: TemplateSlide[];
  created_at: string;
}

type Selection = { kind: "preset" | "real"; id: string };

export function TemplatesClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId, activeProject } = useActiveProject();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<TemplatePreviewData | null>(null);
  const returnToCreate = searchParams.get("return") === "create";

  const projectNiche: NicheSlug | null =
    activeProject?.niche && isNiche(activeProject.niche)
      ? activeProject.niche
      : null;

  const loadTemplates = useCallback(async () => {
    if (!activeProjectId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const rows = await fetchCarouselTemplates(supabase, {
      workspaceId: activeProjectId,
    });
    setTemplates(rows as Template[]);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreated = useCallback(
    (created?: TemplatePreviewData) => {
      loadTemplates();
      if (created?.id && returnToCreate) {
        router.push(`/dashboard/carousels/new?template=${created.id}`);
        return;
      }
      if (created && created.slides.length > 0) setPreview(created);
    },
    [loadTemplates, returnToCreate, router],
  );

  function previewTemplate(t: Template) {
    setPreview({
      id: t.id,
      title: t.title,
      caption: t.caption,
      sourceUrl: t.source_url,
      sourcePlatform: t.source_platform,
      slides: t.slides ?? [],
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete template");
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSelected((s) => (s?.kind === "real" && s.id === id ? null : s));
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function applySelection() {
    if (!selected || applying) return;

    if (selected.kind === "preset") {
      setApplying(true);
      try {
        const res = await fetch("/api/templates/from-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset_id: selected.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Failed to prepare template");
          return;
        }
        const topic = data.starterTopic
          ? `&topic=${encodeURIComponent(data.starterTopic)}`
          : "";
        router.push(
          `/dashboard/carousels/new?template=${data.templateId}${topic}`,
        );
      } catch {
        alert("Network error");
      } finally {
        setApplying(false);
      }
      return;
    }

    router.push(`/dashboard/carousels/new?template=${selected.id}`);
  }

  if (!activeProjectId) {
    return (
      <NoProjectNotice
        title="No project selected"
        description="Create or select a project to manage its template library."
      />
    );
  }

  const nicheMeta = projectNiche ? NICHE_META[projectNiche] : null;
  const realItems: TemplateCardItem[] = templates.map((t) => ({
    kind: "real",
    id: t.id,
    title: t.title,
    slideCount: t.slides?.length ?? 0,
    thumbUrl: t.slides?.[0]?.image_url ?? null,
    isGlobal: t.workspace_id === null,
    canDelete: t.workspace_id !== null || isAdmin,
  }));
  const presetItems: TemplateCardItem[] = projectNiche
    ? presetsForNiche(projectNiche).map((p) => ({
        kind: "preset",
        id: p.id,
        title: p.title,
        description: p.description,
        slideCount: p.slideCount,
        gradient: nicheMeta!.gradient,
        thumbnail: p.thumbnail,
      }))
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-[#666] mt-1 text-sm">
            {activeProject?.name ? (
              <>
                Library for{" "}
                <span className="font-semibold text-[#333]">
                  {activeProject.name}
                </span>
                {projectNiche && <> · {nicheLabel(projectNiche)}</>}
              </>
            ) : (
              "Your imported templates live here — one library per project."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white text-sm font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
        >
          <Plus className="w-4 h-4" />
          Add template
        </button>
      </div>

      {!projectNiche && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This project has no type set. Create a new project and pick ecommerce,
          branding, app, or viral so we can suggest the right starters.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 bg-white border-2 border-black rounded-xl px-4 py-3 shadow-[3px_3px_0_0_#000]">
        <p className="text-sm text-[#666]">
          {selected
            ? "Template selected — use it to start a carousel."
            : "Pick an imported template, a starter, or add a new URL."}
        </p>
        <button
          type="button"
          onClick={applySelection}
          disabled={!selected || applying}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] disabled:opacity-40 disabled:pointer-events-none"
        >
          {applying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {applying ? "Preparing..." : "Use selected template"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" />
              Your templates
            </h2>
            {realItems.length === 0 ? (
              <p className="text-sm text-[#666] border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                No templates yet — paste an Instagram or TikTok URL to import
                one into this project.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {realItems.map((item) => (
                  <TemplateCard
                    key={`real-${item.id}`}
                    item={item}
                    selected={selected?.kind === "real" && selected.id === item.id}
                    onSelect={() => setSelected({ kind: "real", id: item.id })}
                    onPreview={() => {
                      const full = templates.find((t) => t.id === item.id);
                      if (full) previewTemplate(full);
                    }}
                    onDelete={() => handleDelete(item.id)}
                    deleting={deletingId === item.id}
                  />
                ))}
              </div>
            )}
          </section>

          {presetItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                Suggested {nicheLabel(projectNiche!)} starters
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {presetItems.map((item) => (
                  <TemplateCard
                    key={`preset-${item.id}`}
                    item={item}
                    selected={
                      selected?.kind === "preset" && selected.id === item.id
                    }
                    onSelect={() => setSelected({ kind: "preset", id: item.id })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {modalOpen && (
        <AddTemplateModal
          isAdmin={isAdmin}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {preview && (
        <TemplatePreviewModal
          {...preview}
          onClose={() => setPreview(null)}
          onUseInCarousel={
            preview.id
              ? (templateId) => {
                  setPreview(null);
                  router.push(
                    `/dashboard/carousels/new?template=${templateId}`,
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
