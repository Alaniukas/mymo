"use client";



import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import {

  Loader2,

  Plus,

  Users,

  TrendingUp,

  Download,

  ThumbsUp,

} from "lucide-react";

import { cn } from "@/lib/utils";

import { NICHES, type NicheSlug } from "@/lib/carousel/niches";

import {

  type CommunitySort,

  type CommunityTemplate,

} from "@/lib/community/types";

import { CommunityTemplateCard } from "./community-template-card";

import { CommunityHighlightCard } from "./community-highlight-card";

import { ShareCommunityTemplateModal } from "./share-community-template-modal";

import {

  DownloadTemplateModal,

  type DownloadAction,

} from "./download-template-modal";

import {

  TemplatePreviewModal,

  type TemplatePreviewData,

} from "./template-preview-modal";



interface CommunityStatHighlight {

  template: CommunityTemplate;

  metric: string;

}



interface CommunityStats {

  mostUpvoted: CommunityStatHighlight | null;

  mostDownloaded: CommunityStatHighlight | null;

  rising: CommunityStatHighlight | null;

}



export function CommunityTemplatesClient() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);

  const [stats, setStats] = useState<CommunityStats | null>(null);

  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState<CommunitySort>("trending");

  const [nicheFilter, setNicheFilter] = useState<NicheSlug | "all">("all");

  const [modalOpen, setModalOpen] = useState(false);

  const [preview, setPreview] = useState<TemplatePreviewData | null>(null);

  const [votingId, setVotingId] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [downloadChoice, setDownloadChoice] =

    useState<CommunityTemplate | null>(null);

  const [toast, setToast] = useState<string | null>(null);



  const loadTemplates = useCallback(async () => {

    const params = new URLSearchParams({ sort });

    if (nicheFilter !== "all") params.set("niche", nicheFilter);



    const res = await fetch(`/api/community/templates?${params}`);

    if (!res.ok) {

      setLoading(false);

      return;

    }



    const data = await res.json();

    setTemplates(data.templates ?? []);

    setStats(data.stats ?? null);

    setLoading(false);

  }, [sort, nicheFilter]);



  useEffect(() => {

    const nicheParam = searchParams.get("niche");

    if (nicheParam && NICHES.some((n) => n.slug === nicheParam)) {

      setNicheFilter(nicheParam as NicheSlug);

    }

  }, [searchParams]);



  useEffect(() => {

    setLoading(true);

    loadTemplates();

  }, [loadTemplates]);



  useEffect(() => {

    if (!toast) return;

    const t = setTimeout(() => setToast(null), 4000);

    return () => clearTimeout(t);

  }, [toast]);



  async function handleVote(id: string, vote: 1 | -1) {

    const current = templates.find((t) => t.id === id);

    if (!current) return;



    const nextVote = current.user_vote === vote ? 0 : vote;



    setVotingId(id);

    setTemplates((prev) =>

      prev.map((t) => {

        if (t.id !== id) return t;

        let up = t.upvote_count;

        let down = t.downvote_count;

        if (t.user_vote === 1) up--;

        if (t.user_vote === -1) down--;

        if (nextVote === 1) up++;

        if (nextVote === -1) down++;

        return {

          ...t,

          upvote_count: up,

          downvote_count: down,

          user_vote: nextVote === 0 ? null : (nextVote as 1 | -1),

        };

      }),

    );



    try {

      const res = await fetch(`/api/community/templates/${id}/vote`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          vote: nextVote,

          current_upvote_count: current.upvote_count,

          current_downvote_count: current.downvote_count,

          current_user_vote: current.user_vote ?? null,

        }),

      });

      const data = await res.json();

      if (res.ok) {

        setTemplates((prev) =>

          prev.map((t) =>

            t.id === id

              ? {

                  ...t,

                  upvote_count: data.upvote_count,

                  downvote_count: data.downvote_count,

                  user_vote: data.user_vote,

                }

              : t,

          ),

        );

      } else {

        loadTemplates();

      }

    } catch {

      loadTemplates();

    } finally {

      setVotingId(null);

    }

  }



  function handleDownloadClick(id: string) {

    const template = templates.find((t) => t.id === id);

    if (template) setDownloadChoice(template);

  }



  async function executeDownload(action: DownloadAction) {

    if (!downloadChoice) return;



    const id = downloadChoice.id;

    setDownloadingId(id);



    try {

      const res = await fetch(`/api/community/templates/${id}/download`, {

        method: "POST",

      });

      const data = await res.json();

      if (!res.ok) {

        setToast(data.error || "Download failed");

        return;

      }



      setTemplates((prev) =>

        prev.map((t) =>

          t.id === id ? { ...t, download_count: t.download_count + 1 } : t,

        ),

      );

      setDownloadChoice(null);



      if (action === "create" && data.templateId) {

        router.push(`/dashboard/carousels/new?template=${data.templateId}`);

      } else {

        setToast("Added to your template library!");

      }

    } catch {

      setToast("Network error. Please try again.");

    } finally {

      setDownloadingId(null);

    }

  }



  function openPreview(t: CommunityTemplate) {

    setPreview({

      title: t.title,

      caption: t.description,

      slides: t.slides ?? [],

    });

  }



  if (loading) {

    return (

      <div className="flex items-center justify-center py-24">

        <Loader2 className="w-8 h-8 animate-spin text-[var(--ember)]" />

      </div>

    );

  }



  return (

    <div className="max-w-5xl mx-auto space-y-8">

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div>

          <div className="inline-flex items-center gap-2 text-[var(--ember)] mb-2">

            <Users className="w-5 h-5" />

            <span className="text-sm font-semibold">Community</span>

          </div>

          <h1 className="text-2xl font-bold tracking-tight">

            Community Templates

          </h1>

          <p className="text-[#666] mt-1">

            Discover trending carousel formats, vote on what goes viral, and

            import winners into your library.

          </p>

        </div>

        <button

          type="button"

          onClick={() => setModalOpen(true)}

          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white text-sm font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] shrink-0"

        >

          <Plus className="w-4 h-4" />

          Share template

        </button>

      </div>



      {stats &&

        (stats.mostUpvoted || stats.mostDownloaded || stats.rising) && (

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {stats.mostUpvoted && (

              <CommunityHighlightCard

                label="Most upvoted"

                template={stats.mostUpvoted.template}

                metric={stats.mostUpvoted.metric}

                icon={ThumbsUp}

                onSelect={() => openPreview(stats.mostUpvoted!.template)}

              />

            )}

            {stats.mostDownloaded && (

              <CommunityHighlightCard

                label="Most downloaded"

                template={stats.mostDownloaded.template}

                metric={stats.mostDownloaded.metric}

                icon={Download}

                onSelect={() => openPreview(stats.mostDownloaded!.template)}

              />

            )}

            {stats.rising && (

              <CommunityHighlightCard

                label="Rising"

                template={stats.rising.template}

                metric={stats.rising.metric}

                icon={TrendingUp}

                onSelect={() => openPreview(stats.rising!.template)}

              />

            )}

          </div>

        )}



      <div className="bg-white border-2 border-black rounded-xl px-4 py-3 shadow-[3px_3px_0_0_#000] space-y-3">

        <div className="flex flex-wrap gap-2">

          <button

            type="button"

            onClick={() => setNicheFilter("all")}

            className={cn(

              "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors",

              nicheFilter === "all"

                ? "bg-[var(--ember)] text-white border-black"

                : "bg-white text-[#666] border-gray-200 hover:border-black",

            )}

          >

            All

          </button>

          {NICHES.map((n) => (

            <button

              key={n.slug}

              type="button"

              onClick={() => setNicheFilter(n.slug)}

              className={cn(

                "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors",

                nicheFilter === n.slug

                  ? "bg-[var(--ember)] text-white border-black"

                  : "bg-white text-[#666] border-gray-200 hover:border-black",

              )}

            >

              {n.label}

            </button>

          ))}

        </div>



        <div className="flex gap-2">

          {(

            [

              { id: "trending", label: "Trending" },

              { id: "new", label: "New" },

              { id: "top", label: "Top voted" },

            ] as const

          ).map((s) => (

            <button

              key={s.id}

              type="button"

              onClick={() => setSort(s.id)}

              className={cn(

                "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors",

                sort === s.id

                  ? "bg-black text-white border-black"

                  : "bg-white text-[#666] border-gray-200 hover:border-black",

              )}

            >

              {s.label}

            </button>

          ))}

        </div>

      </div>



      {templates.length === 0 ? (

        <div className="text-center py-16 space-y-3">

          <Users className="w-12 h-12 mx-auto text-[#ccc]" />

          <h2 className="text-lg font-bold">No templates yet</h2>

          <p className="text-[#666] text-sm">

            Be the first to share a carousel format with the community.

          </p>

          <button

            type="button"

            onClick={() => setModalOpen(true)}

            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ember)] text-white text-sm font-semibold"

          >

            <Plus className="w-4 h-4" />

            Share template

          </button>

        </div>

      ) : (

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

          {templates.map((t) => (

            <CommunityTemplateCard

              key={t.id}

              template={t}

              onVote={handleVote}

              onDownload={handleDownloadClick}

              onPreview={openPreview}

              voting={votingId === t.id}

              downloading={downloadingId === t.id}

            />

          ))}

        </div>

      )}



      {toast && (

        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-black text-white rounded-xl border-2 border-black shadow-[4px_4px_0_0_var(--ember)] text-sm font-medium">

          {toast}

          {toast.includes("library") && (

            <Link

              href="/dashboard/templates"

              className="underline text-[var(--ember)] hover:text-white"

            >

              View library

            </Link>

          )}

        </div>

      )}



      {downloadChoice && (

        <DownloadTemplateModal

          template={downloadChoice}

          loading={downloadingId === downloadChoice.id}

          onClose={() => {

            if (!downloadingId) setDownloadChoice(null);

          }}

          onChoose={executeDownload}

        />

      )}



      {modalOpen && (

        <ShareCommunityTemplateModal

          onClose={() => setModalOpen(false)}

          onCreated={(t) => {

            setTemplates((prev) => [t, ...prev]);

            setToast("Template published to community!");

          }}

        />

      )}



      {preview && (

        <TemplatePreviewModal {...preview} onClose={() => setPreview(null)} />

      )}

    </div>

  );

}


