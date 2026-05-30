"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Upload, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NICHES, nicheLabel, type NicheSlug } from "@/lib/carousel/niches";
import type { CommunityTemplate } from "@/lib/community/types";

interface ShareCommunityTemplateModalProps {
  onClose: () => void;
  onCreated: (template: CommunityTemplate) => void;
}

export function ShareCommunityTemplateModal({
  onClose,
  onCreated,
}: ShareCommunityTemplateModalProps) {
  const [niche, setNiche] = useState<NicheSlug>(NICHES[0].slug);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
  }, []);

  function addFiles(list: FileList | File[]) {
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleShare() {
    if (!title.trim() || items.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setUploading(false);
      return;
    }

    const tempId = crypto.randomUUID();
    const slides: {
      position: number;
      image_url: string;
      storage_path: string;
      media_type: "image";
    }[] = [];

    for (let i = 0; i < items.length; i++) {
      const file = items[i].file;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `community/${user.id}/${tempId}/${i + 1}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("templates")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (!upErr) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("templates").getPublicUrl(path);
        slides.push({
          position: i + 1,
          image_url: publicUrl,
          storage_path: path,
          media_type: "image",
        });
      }
      setProgress(Math.round(((i + 1) / items.length) * 80));
    }

    if (slides.length === 0) {
      setError("Failed to upload images. Please try again.");
      setUploading(false);
      return;
    }

    try {
      const res = await fetch("/api/community/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          niche,
          slides,
        }),
      });
      const data = await res.json();
      setProgress(100);

      if (!res.ok) {
        setError(data.error || "Failed to publish template");
        setUploading(false);
        return;
      }

      onCreated(data.template);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={uploading ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg bg-white border-2 border-black rounded-xl shadow-[6px_6px_0_0_#000] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
          <div>
            <h2 className="text-lg font-bold">Share with community</h2>
            <p className="text-xs text-[#666] mt-0.5">
              Upload your carousel slides for others to discover and vote on.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#666] mb-1.5">
              Niche
            </label>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => setNiche(n.slug)}
                  disabled={uploading}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors disabled:opacity-50",
                    niche === n.slug
                      ? "bg-[var(--ember)] text-white border-black"
                      : "bg-white text-[#666] border-gray-200 hover:border-black",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Template name (e.g. POV hook carousel)"
            className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] resize-none"
          />

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Upload className="w-7 h-7 mx-auto text-[#999]" />
            <p className="text-sm font-medium mt-2">Drop slide images here</p>
            <p className="text-xs text-[#999]">or click to browse</p>
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {items.map((it, i) => (
                <div
                  key={it.url}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-black"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt={`Slide ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleShare}
            disabled={!title.trim() || items.length === 0 || uploading}
            className="w-full px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading
              ? `Publishing... ${progress}%`
              : `Share template${items.length ? ` (${items.length} slides)` : ""}`}
          </button>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
