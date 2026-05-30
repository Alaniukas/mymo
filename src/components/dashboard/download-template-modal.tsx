"use client";

import { X, Layers, LayoutTemplate, Loader2 } from "lucide-react";
import type { CommunityTemplate } from "@/lib/community/types";

export type DownloadAction = "create" | "library";

interface DownloadTemplateModalProps {
  template: CommunityTemplate;
  loading?: boolean;
  onClose: () => void;
  onChoose: (action: DownloadAction) => void;
}

export function DownloadTemplateModal({
  template,
  loading,
  onClose,
  onChoose,
}: DownloadTemplateModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="w-full max-w-md bg-white border-2 border-black rounded-xl shadow-[6px_6px_0_0_#000]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
          <div>
            <h2 className="text-lg font-bold">Use this template</h2>
            <p className="text-xs text-[#666] mt-0.5 line-clamp-1">
              {template.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-[#666]">
            How would you like to use this carousel format?
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={() => onChoose("create")}
            className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-black bg-[var(--ember)] text-white text-left shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] disabled:opacity-50"
          >
            <Layers className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Create carousel now</p>
              <p className="text-xs text-white/80 mt-0.5">
                Import the format and start building with your assets right
                away.
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => onChoose("library")}
            className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-black bg-white text-left shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] disabled:opacity-50"
          >
            <LayoutTemplate className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Save to my templates</p>
              <p className="text-xs text-[#666] mt-0.5">
                Add to your private library and create a carousel later.
              </p>
            </div>
          </button>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-[#666]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ember)]" />
              Importing template...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
