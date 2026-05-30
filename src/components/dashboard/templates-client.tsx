"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Smartphone,
  UserRound,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { type NicheSlug } from "@/lib/carousel/niches";
import {
  NICHE_CARDS,
  presetsForNiche,
  getPreset,
} from "@/lib/carousel/template-presets";
import { TemplateCard, type TemplateCardItem } from "./template-card";
import { AddTemplateModal } from "./add-template-modal";
import {
  TemplatePreviewModal,
  type TemplatePreviewData,
} from "./template-preview-modal";

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

const NICHE_ICONS: Record<NicheSlug, LucideIcon> = {
  ecomm: ShoppingBag,
  app: Smartphone,
  personal_brand: UserRound,
  viral: Flame,
};

type Selection = { kind: "preset" | "real"; id: string };

export function TemplatesClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNiche, setActiveNiche] = useState<NicheSlug | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<TemplatePreviewData | null>(null);

  const loadTemplates = useCallback(async () => {
    const supabase = createClient();

    // Templates are universal: show global templates plus all of the user's own
    // imports across every project. RLS already scopes rows to "global + owned",
    // so no per-project filter is needed here.
    const { data } = await supabase
      .from("carousel_templates")
      .select(
        "id, workspace_id, niche, title, source_url, source_platform, caption, slides, created_at",
      )
      .order("created_at", { ascending: false });

    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // After import/upload, refresh the list and surface the new carousel so the
  // user can immediately preview it exactly as it was in the source post.
  const handleCreated = useCallback(
    (created?: TemplatePreviewData) => {
      loadTemplates();
      if (created && created.slides.length > 0) setPreview(created);
    },
    [loadTemplates],
  );

  function previewTemplate(t: Template) {
    setPreview({
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

  function applySelection() {
    if (!selected || !activeNiche) return;

    if (selected.kind === "real") {
      router.push(`/dashboard/carousels/new?template=${selected.id}`);
      return;
    }

    const preset = getPreset(selected.id);
    if (!preset) return;
    const params = new URLSearchParams({
      topic: preset.starterTopic,
      slides: String(preset.slideCount),
      niche: preset.niche,
    });
    router.push(`/dashboard/carousels/new?${params.toString()}`);
  }

  function countForNiche(slug: NicheSlug): number {
    const real = templates.filter((t) => t.niche === slug).length;
    return real + presetsForNiche(slug).length;
  }

  // ── Niche selection grid ──
  if (!activeNiche) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
            <p className="text-[#666] mt-1">
              Pick a niche to browse carousel styles. Select a template to apply
              it to your next carousel — or import your own.
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

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {NICHE_CARDS.map((n) => {
              const Icon = NICHE_ICONS[n.slug];
              return (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => {
                    setActiveNiche(n.slug);
                    setSelected(null);
                  }}
                  className="group text-left bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]"
                >
                  <div
                    className={cn(
                      "h-28 bg-gradient-to-br flex items-center justify-center",
                      n.gradient,
                    )}
                  >
                    <Icon className="w-12 h-12 text-white drop-shadow" />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">{n.label}</h2>
                      <span className="text-xs font-semibold text-[#666] bg-gray-100 px-2 py-1 rounded-full">
                        {countForNiche(n.slug)} templates
                      </span>
                    </div>
                    <p className="text-sm text-[#666] mt-1">{n.tagline}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ember)] mt-3 group-hover:gap-2 transition-[gap]">
                      Browse templates
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              );
            })}
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
          <TemplatePreviewModal {...preview} onClose={() => setPreview(null)} />
        )}
      </div>
    );
  }

  // ── Niche detail: template list ──
  const meta = NICHE_CARDS.find((n) => n.slug === activeNiche)!;
  const realItems: TemplateCardItem[] = templates
    .filter((t) => t.niche === activeNiche)
    .map((t) => ({
      kind: "real",
      id: t.id,
      title: t.title,
      slideCount: t.slides?.length ?? 0,
      thumbUrl: t.slides?.[0]?.image_url ?? null,
      isGlobal: t.workspace_id === null,
      canDelete: t.workspace_id !== null || isAdmin,
    }));
  const presetItems: TemplateCardItem[] = presetsForNiche(activeNiche).map((p) => ({
    kind: "preset",
    id: p.id,
    title: p.title,
    description: p.description,
    slideCount: p.slideCount,
    gradient: meta.gradient,
    thumbnail: p.thumbnail,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveNiche(null);
            setSelected(null);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-0.5"
          aria-label="Back to niches"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {meta.label} templates
          </h1>
          <p className="text-[#666] mt-0.5 text-sm">{meta.tagline}</p>
        </div>
      </div>

      {/* Apply bar */}
      <div className="flex items-center justify-between gap-4 bg-white border-2 border-black rounded-xl px-4 py-3 shadow-[3px_3px_0_0_#000]">
        <p className="text-sm text-[#666]">
          {selected
            ? "Template selected — apply it to start a carousel."
            : "Select a template below to use it in the carousel pipeline."}
        </p>
        <button
          type="button"
          onClick={applySelection}
          disabled={!selected}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] disabled:opacity-40 disabled:pointer-events-none"
        >
          <Sparkles className="w-4 h-4" />
          Use selected template
        </button>
      </div>

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
        {presetItems.map((item) => (
          <TemplateCard
            key={`preset-${item.id}`}
            item={item}
            selected={selected?.kind === "preset" && selected.id === item.id}
            onSelect={() => setSelected({ kind: "preset", id: item.id })}
          />
        ))}
      </div>

      {preview && (
        <TemplatePreviewModal {...preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
