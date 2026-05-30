"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AssetUpload } from "@/components/dashboard/asset-upload";

interface PickerAsset {
  id: string;
  name: string;
  public_url: string;
}

interface AssetPickerProps {
  workspaceId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Wizard asset picker: shows the project's saved asset pool for multi-select
 * and lets the user upload new ones (which persist to the pool and are
 * auto-selected). Assets are a single unified pool — never split — and the
 * selected set is used together across all slides.
 */
export function AssetPicker({
  workspaceId,
  selected,
  onChange,
}: AssetPickerProps) {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async (): Promise<PickerAsset[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("assets")
      .select("id, name, public_url")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    return (data ?? []) as PickerAsset[];
  }, [workspaceId]);

  useEffect(() => {
    fetchAssets().then((rows) => {
      setAssets(rows);
      setLoading(false);
    });
  }, [fetchAssets]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  // After an upload, refresh and auto-select the new assets so they're included.
  const handleUploaded = useCallback(async () => {
    const next = await fetchAssets();
    const known = new Set(assets.map((a) => a.id));
    const newIds = next.filter((a) => !known.has(a.id)).map((a) => a.id);
    setAssets(next);
    if (newIds.length > 0) onChange([...selected, ...newIds]);
  }, [fetchAssets, assets, selected, onChange]);

  return (
    <div className="space-y-3">
      <AssetUpload workspaceId={workspaceId} onUploadComplete={handleUploaded} />

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ember)]" />
        </div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-[#999] text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
          No assets yet — upload some above.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {assets.map((a) => {
            const isSel = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                title={a.name}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-colors",
                  isSel
                    ? "border-[var(--ember)] ring-2 ring-[var(--ember)]"
                    : "border-black",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.public_url}
                  alt={a.name}
                  className="w-full h-full object-cover"
                />
                <span
                  className={cn(
                    "absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    isSel
                      ? "bg-[var(--ember)] border-[var(--ember)] text-white"
                      : "bg-white/80 border-gray-300 text-transparent",
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#666]">
        {selected.length > 0
          ? `${selected.length} selected — used together as the visual source across every slide.`
          : "Optional: select assets to weave into the slides. The template and your brand still drive the look."}
      </p>
    </div>
  );
}
