"use client";

import { useState } from "react";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { formatHashtagsForPublish } from "@/lib/carousel/prompts";

interface EditorSlide {
  id: string;
  position: number;
  image_url: string | null;
}

interface SlideCaptionEditorProps {
  carouselId: string;
  slides: EditorSlide[];
  initialCaptions: { position: number; caption: string }[];
  initialPostCaption?: string;
  initialHashtags?: string[];
  onFinalized: () => void;
}

/**
 * Post-generation caption editor for multi-asset carousels. The slide IMAGES
 * already exist (clean, text-free); here the user reviews/edits the AI-written
 * captions that fit each actual slide, then finalizes — which burns them on via
 * POST /api/carousel/[id]/finalize.
 */
export function SlideCaptionEditor({
  carouselId,
  slides,
  initialCaptions,
  initialPostCaption = "",
  initialHashtags = [],
  onFinalized,
}: SlideCaptionEditorProps) {
  const initialMap: Record<number, string> = {};
  for (const c of initialCaptions) initialMap[c.position] = c.caption;

  const [captions, setCaptions] = useState<Record<number, string>>(initialMap);
  const [postCaption, setPostCaption] = useState(initialPostCaption);
  const [hashtagsText, setHashtagsText] = useState(
    initialHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  );
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...slides].sort((a, b) => a.position - b.position);

  function update(position: number, value: string) {
    setCaptions((prev) => ({ ...prev, [position]: value }));
  }

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);

    try {
      const payload = ordered.map((s) => ({
        id: s.id,
        caption: (captions[s.position] ?? "").trim(),
      }));

      const hashtagList = formatHashtagsForPublish(
        hashtagsText.split(/\s+/).filter(Boolean),
      ).map((t) => t.replace(/^#/, ""));

      const res = await fetch(`/api/carousel/${carouselId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: payload,
          post_caption: postCaption.trim(),
          hashtags: hashtagList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not finalize the carousel");
        setFinalizing(false);
        return;
      }

      onFinalized();
    } catch {
      setError("Network error. Please try again.");
      setFinalizing(false);
    }
  }

  const anyEmpty = ordered.some((s) => !(captions[s.position] ?? "").trim());

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm text-amber-800 font-medium">
          Your slides are generated. Edit on-slide captions and the social post
          caption below, then finalize to burn text onto the images.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ordered.map((s) => (
          <div
            key={s.id}
            className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000]"
          >
            <div className="aspect-square relative bg-gray-50">
              {s.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={s.image_url}
                  alt={`Slide ${s.position}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[#999]">
                  No image
                </div>
              )}
              <span className="absolute top-2 left-2 text-xs font-bold bg-black/70 text-white px-2 py-0.5 rounded">
                {s.position}
              </span>
            </div>
            <div className="p-3">
              <textarea
                value={captions[s.position] ?? ""}
                onChange={(e) => update(s.position, e.target.value)}
                rows={2}
                placeholder="Caption for this slide..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:border-transparent resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[3px_3px_0_0_#000] space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#666]">
          Post caption (Instagram / TikTok)
        </h3>
        <textarea
          value={postCaption}
          onChange={(e) => setPostCaption(e.target.value)}
          rows={4}
          placeholder="Caption for the post when you publish..."
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:border-transparent resize-y"
        />
        <div>
          <label className="block text-xs font-semibold text-[#666] mb-1">
            Hashtags
          </label>
          <input
            type="text"
            value={hashtagsText}
            onChange={(e) => setHashtagsText(e.target.value)}
            placeholder="#brand #niche #tips"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleFinalize}
        disabled={finalizing || anyEmpty}
        className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50 flex items-center gap-2"
      >
        {finalizing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {finalizing ? "Finalizing..." : "Finalize Carousel"}
      </button>
    </div>
  );
}
