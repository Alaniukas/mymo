"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AssetUpload, AssetGrid } from "@/components/dashboard/asset-upload";

interface Asset {
  id: string;
  name: string;
  public_url: string;
  storage_path: string;
}

interface BrandImagesPanelProps {
  workspaceId: string;
}

export function BrandImagesPanel({ workspaceId }: BrandImagesPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("assets")
      .select("id, name, public_url, storage_path")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    setAssets((data ?? []) as Asset[]);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    loadAssets();
  }, [loadAssets]);

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Remove this image from your library? It will no longer be available for carousels.",
      )
    ) {
      return;
    }

    const supabase = createClient();
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    await supabase.storage.from("assets").remove([asset.storage_path]);
    await supabase.from("assets").delete().eq("id", id);

    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Your images</h2>
        <p className="text-sm text-[#666] mt-0.5">
          Product shots, lifestyle photos, UGC, or screenshots. Add them here or
          import from your website on the Identity tab — then pick them when you
          create a carousel.
        </p>
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Image library</p>
          <span className="text-sm font-semibold bg-[var(--ember)]/10 text-[var(--ember)] px-2.5 py-1 rounded-full">
            {assets.length}
          </span>
        </div>

        <AssetUpload workspaceId={workspaceId} onUploadComplete={loadAssets} />

        <div className="mt-4">
          {assets.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-[#666] font-medium">
                Add your first images
              </p>
              <p className="text-xs text-[#999] mt-1">
                Drop files above, review the preview, then click Upload.
              </p>
            </div>
          ) : (
            <AssetGrid
              assets={assets}
              onDelete={handleDelete}
              emptyMessage="No images in your library yet"
            />
          )}
        </div>
      </div>
    </div>
  );
}
