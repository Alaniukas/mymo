"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, BarChart3, RefreshCw, ExternalLink } from "lucide-react";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { cn } from "@/lib/utils";

interface LibraryItem {
  carousel_id: string;
  title: string;
  status: string;
  platform: string;
  created_at: string;
  preview_url: string | null;
  slide_count: number;
  published: boolean;
  publish_platform: string | null;
  published_at: string | null;
  publish_status: string | null;
  metrics: Record<string, unknown> | null;
  metrics_synced_at: string | null;
}

type Tab = "all" | "published" | "ready" | "drafts";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "ready", label: "Ready" },
  { id: "drafts", label: "Drafts" },
];

export default function LibraryPage() {
  const { activeProjectId } = useActiveProject();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/library?tab=${tab}`);
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncMetrics() {
    setSyncing(true);
    try {
      await fetch("/api/social/sync-metrics", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
          <p className="text-sm text-[#666] mt-1">
            Carousels you created, where they were published, and performance
            (when available).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/insights"
            className="px-4 py-2 rounded-lg border-2 border-black text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Insights
          </Link>
          <button
            type="button"
            onClick={() => void syncMetrics()}
            disabled={syncing}
            className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-semibold hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync metrics
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors",
              tab === t.id
                ? "border-black bg-[var(--ember)] text-white"
                : "border-gray-200 bg-white hover:bg-gray-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--ember)]" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[#666] text-sm">
          No content in this view yet.{" "}
          <Link href="/dashboard/create" className="font-semibold underline">
            Create a carousel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.carousel_id}
              href={`/dashboard/carousels/${item.carousel_id}`}
              className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-all"
            >
              <div className="aspect-square bg-gray-100 relative">
                {item.preview_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.preview_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-[#999]">
                    No preview
                  </div>
                )}
                {item.published && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase bg-green-600 text-white px-2 py-0.5 rounded">
                    Published
                  </span>
                )}
              </div>
              <div className="p-4 space-y-1">
                <h2 className="font-bold text-sm truncate">{item.title}</h2>
                <p className="text-xs text-[#666]">
                  {item.slide_count} slides · {item.status}
                  {item.publish_platform ? ` · ${item.publish_platform}` : ""}
                </p>
                {item.published_at && (
                  <p className="text-xs text-[#999]">
                    {new Date(item.published_at).toLocaleDateString()}
                  </p>
                )}
                {item.metrics && (
                  <p className="text-xs text-[#666] flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Metrics pending platform sync
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
