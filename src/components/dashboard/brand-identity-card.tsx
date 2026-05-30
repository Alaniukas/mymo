"use client";

import { useEffect, useState } from "react";
import { Dna, X, Pencil } from "lucide-react";
import { type NicheSlug } from "@/lib/carousel/niches";
import {
  BrainProfileEditor,
  type AppIdentityProfile,
} from "./brain-profile-editor";

// Compact entry point to the brand identity. The full field-by-field editor is
// hidden by default — only the generated Brand DNA shows. Clicking it opens the
// complete, editable profile in a modal.
export function BrandIdentityCard({
  identity,
  niche,
}: {
  identity: AppIdentityProfile;
  niche?: NicheSlug | null;
}) {
  // Local copy so edits made inside the modal update the DNA preview live.
  const [current, setCurrent] = useState<AppIdentityProfile>(identity);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dna = current.brand_dna?.trim();

  return (
    <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] space-y-4">
      <div>
        <h2 className="text-lg font-bold">Your Brand Identity</h2>
        <p className="text-sm text-[#666] mt-0.5">
          Generated from your quiz. Your Brand DNA powers every piece of content —
          open it to view and refine the full profile.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-xl border-2 border-[var(--ember)] bg-[var(--ember)]/5 p-4 text-left transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Dna className="h-4 w-4 text-[var(--ember)]" />
            Brand DNA
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--ember)]">
            <Pencil className="h-3 w-3" />
            View & edit identity
          </span>
        </div>
        {dna ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{dna}</p>
        ) : (
          <p className="text-sm italic text-[#999]">
            Take the quiz or crawl your website to generate your Brand DNA — or
            click here to write it yourself.
          </p>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_#000]"
          >
            <div className="flex shrink-0 items-center justify-between border-b-2 border-black px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Your Brand Identity</h2>
                <p className="mt-0.5 text-xs text-[#666]">
                  Edit any field to refine how your content reads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 transition-colors hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <BrainProfileEditor
                initial={current}
                niche={niche}
                embedded
                onChange={setCurrent}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
