"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  Download,
  Upload,
  Globe,
  AlertCircle,
  LinkIcon,
  ImagePlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NICHES, nicheLabel, type NicheSlug } from "@/lib/carousel/niches";
import { useActiveProject } from "@/components/dashboard/project-provider";
import type { TemplatePreviewData } from "./template-preview-modal";

interface AddTemplateModalProps {
  /** Pre-selected niche. When omitted, the modal shows a niche picker. */
  niche?: NicheSlug;
  isAdmin: boolean;
  onClose: () => void;
  /** Fires after a template is created; receives it so the parent can preview it. */
  onCreated: (created?: TemplatePreviewData) => void;
}

type Mode = "url" | "upload";

export function AddTemplateModal({
  niche: fixedNiche,
  isAdmin,
  onClose,
  onCreated,
}: AddTemplateModalProps) {
  const { activeProjectId } = useActiveProject();
  const [mode, setMode] = useState<Mode>("url");
  const [error, setError] = useState<string | null>(null);

  // When launched without a fixed niche (from the Templates tab), the user
  // chooses one here; otherwise we lock to the niche they were browsing.
  const [niche, setNiche] = useState<NicheSlug>(fixedNiche ?? NICHES[0].slug);

  // URL import
  const [importUrl, setImportUrl] = useState("");
  const [addGlobal, setAddGlobal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Manual upload — each item pairs a file with its object-URL preview so we
  // can create/revoke the URL in the same handlers that mutate the list.
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep a ref of the latest items so the unmount cleanup can revoke every
  // outstanding preview URL without re-running on each change.
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

  async function handleImport() {
    const trimmed = importUrl.trim();
    if (!trimmed) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          niche,
          scope: isAdmin && addGlobal ? "global" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      const tpl = data.template;
      onCreated(
        tpl
          ? {
              title: tpl.title,
              caption: tpl.caption,
              sourceUrl: tpl.source_url,
              sourcePlatform: tpl.source_platform,
              slides: tpl.slides ?? [],
            }
          : undefined,
      );
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function handleUpload() {
    if (!title.trim() || items.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    if (!activeProjectId) {
      setError("No project selected.");
      setUploading(false);
      return;
    }

    const supabase = createClient();

    // Insert the row first so we have an id for the storage paths, mirroring
    // the server-side importer's layout (`<workspace>/<template>/<n>.<ext>`).
    const { data: tpl, error: insErr } = await supabase
      .from("carousel_templates")
      .insert({
        workspace_id: activeProjectId,
        niche,
        title: title.trim().slice(0, 60),
        slides: [],
      })
      .select("id")
      .single();

    if (insErr || !tpl) {
      setError(insErr?.message ?? "Failed to create template.");
      setUploading(false);
      return;
    }

    const slides: {
      position: number;
      image_url: string;
      storage_path: string;
    }[] = [];
    let position = 1;

    for (let i = 0; i < items.length; i++) {
      const file = items[i].file;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${activeProjectId}/${tpl.id}/${i + 1}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("templates")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (!upErr) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("templates").getPublicUrl(path);
        slides.push({ position, image_url: publicUrl, storage_path: path });
        position++;
      }
      setProgress(Math.round(((i + 1) / items.length) * 100));
    }

    if (slides.length === 0) {
      await supabase.from("carousel_templates").delete().eq("id", tpl.id);
      setError("Failed to upload images. Please try again.");
      setUploading(false);
      return;
    }

    await supabase.from("carousel_templates").update({ slides }).eq("id", tpl.id);
    setUploading(false);
    onCreated({ title: title.trim().slice(0, 60), slides });
    onClose();
  }

  const busy = importing || uploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg bg-white border-2 border-black rounded-xl shadow-[6px_6px_0_0_#000] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
          <div>
            <h2 className="text-lg font-bold">
              {fixedNiche ? `Add a ${nicheLabel(niche)} template` : "Add a template"}
            </h2>
            <p className="text-xs text-[#666] mt-0.5">
              Paste a public post link or upload your own slides.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Niche picker — only when not launched from a specific niche */}
          {!fixedNiche && (
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
                    disabled={busy}
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
          )}

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(
              [
                { id: "url", label: "Paste a link", icon: LinkIcon },
                { id: "upload", label: "Upload images", icon: ImagePlus },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setError(null);
                }}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors",
                  mode === m.id
                    ? "bg-black text-white border-black"
                    : "bg-white text-[#666] border-gray-200 hover:border-black",
                )}
              >
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <div className="space-y-3">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://www.instagram.com/p/..."
                className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
              />
              <p className="text-xs text-[#666]">
                We&apos;ll scrape the public Instagram or TikTok carousel and
                re-host its slides as a reusable style reference.
              </p>

              {isAdmin && (
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addGlobal}
                    onChange={(e) => setAddGlobal(e.target.checked)}
                    className="w-4 h-4 accent-[var(--ember)]"
                  />
                  <Globe className="w-4 h-4" />
                  Add as a global template (visible to everyone)
                </label>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={!importUrl.trim() || importing}
                className="w-full px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {importing ? "Importing template..." : "Import Template"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Template name (e.g. Bold product launch)"
                className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
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
                onClick={handleUpload}
                disabled={!title.trim() || items.length === 0 || uploading}
                className="w-full px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading
                  ? `Uploading... ${progress}%`
                  : `Create template${items.length ? ` (${items.length} slides)` : ""}`}
              </button>
            </div>
          )}

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
