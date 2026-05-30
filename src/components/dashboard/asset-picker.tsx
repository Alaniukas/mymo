"use client";



import { useState, useEffect, useCallback } from "react";

import Link from "next/link";

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

  /** Hide library grid — upload fresh photos only (auto-select new uploads). */
  uploadOnly?: boolean;

}



/**

 * Wizard asset picker: shows the project's saved asset pool for multi-select

 * and lets the user upload new ones (which persist to the pool after confirm).

 */

export function AssetPicker({

  workspaceId,

  selected,

  onChange,

  uploadOnly = false,

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

    setLoading(true);

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



  function selectAll() {

    onChange(assets.map((a) => a.id));

  }



  function clearSelection() {

    onChange([]);

  }



  const handleUploaded = useCallback(async () => {

    const prevIds = new Set(assets.map((a) => a.id));

    const next = await fetchAssets();

    const newIds = next.filter((a) => !prevIds.has(a.id)).map((a) => a.id);

    setAssets(next);

    if (newIds.length > 0) onChange([...selected, ...newIds]);

  }, [fetchAssets, assets, selected, onChange]);



  return (

    <div className="space-y-3">

      <AssetUpload

        workspaceId={workspaceId}

        onUploadComplete={handleUploaded}

        compact

      />



      {loading && !uploadOnly ? (

        <div className="flex items-center justify-center h-24">

          <Loader2 className="w-5 h-5 animate-spin text-[var(--ember)]" />

        </div>

      ) : uploadOnly ? (
        <p className="text-xs text-[#666]">
          {selected.length > 0
            ? `${selected.length} fresh photo${selected.length === 1 ? "" : "s"} ready — your saved social vibe will style the captions & product slides.`
            : "Upload new photos above. Saved IG/TikTok vibe applies automatically."}
        </p>
      ) : assets.length === 0 ? (

        <div className="text-sm text-center py-4 border-2 border-dashed border-gray-200 rounded-lg space-y-2">

          <p className="text-[#666]">No images in your library yet.</p>

          <Link

            href="/dashboard/onboarding?tab=images"

            className="inline-block text-sm font-semibold text-[var(--ember)] underline hover:no-underline"

          >

            Add images in Brand setup →

          </Link>

        </div>

      ) : (

        <>

          <div className="flex items-center justify-between gap-2">

            <p className="text-xs text-[#666]">

              {selected.length} of {assets.length} selected

            </p>

            <div className="flex gap-2">

              <button

                type="button"

                onClick={selectAll}

                disabled={selected.length === assets.length}

                className="text-xs font-semibold text-[#666] hover:text-black disabled:opacity-40"

              >

                Select all

              </button>

              <span className="text-[#ccc]">|</span>

              <button

                type="button"

                onClick={clearSelection}

                disabled={selected.length === 0}

                className="text-xs font-semibold text-[#666] hover:text-black disabled:opacity-40"

              >

                Clear

              </button>

            </div>

          </div>

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

        </>

      )}



      <p className="text-xs text-[#666]">

        {selected.length > 0

          ? `${selected.length} selected — your photos become the slides; the template only sets layout & captions.`

          : "Optional: select images to weave into slides, or leave empty to use brand + template only."}

      </p>

    </div>

  );

}

