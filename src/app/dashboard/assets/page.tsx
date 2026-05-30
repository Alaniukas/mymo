"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AssetUpload, AssetGrid } from "@/components/dashboard/asset-upload";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";

interface Asset {
  id: string;
  name: string;
  public_url: string;
  storage_path: string;
}

export default function AssetsPage() {
  const { activeProjectId } = useActiveProject();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    const { data } = await supabase
      .from("assets")
      .select("id, name, public_url, storage_path")
      .eq("workspace_id", activeProjectId)
      .order("created_at", { ascending: false });

    setAssets((data ?? []) as Asset[]);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  async function handleDelete(id: string) {
    const supabase = createClient();

    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    await supabase.storage.from("assets").remove([asset.storage_path]);
    await supabase.from("assets").delete().eq("id", id);

    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
        <p className="text-[#666] mt-1">
          Upload your brand images — product shots, lifestyle photos, UGC, or
          screenshots. When you create a carousel, you pick from this pool and
          they&apos;re used together as the visual source for your slides.
        </p>
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Your assets</h2>
            <p className="text-xs text-[#666]">
              Product shots, lifestyle photos, UGC-style images, screenshots
            </p>
          </div>
          <span className="text-sm font-semibold bg-[var(--ember)]/10 text-[var(--ember)] px-2.5 py-1 rounded-full">
            {assets.length}
          </span>
        </div>

        <AssetUpload workspaceId={activeProjectId} onUploadComplete={loadAssets} />

        <div className="mt-4">
          <AssetGrid assets={assets} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
}
