"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_FILES_PER_BATCH = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 3;

interface StagedItem {
  file: File;
  url: string;
}

interface AssetUploadProps {
  workspaceId: string;
  /** Asset bucket. Defaults to "hook" — the app now treats assets as one pool. */
  type?: "hook" | "demo";
  onUploadComplete: () => void;
  /** Compact layout for embedded pickers (e.g. Create wizard). */
  compact?: boolean;
}

async function uploadOneFile(
  workspaceId: string,
  type: "hook" | "demo",
  file: File,
): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${workspaceId}/${type}s/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, file, { contentType: file.type });

  if (uploadError) return uploadError.message;

  const {
    data: { publicUrl },
  } = supabase.storage.from("assets").getPublicUrl(path);

  const { error: insertError } = await supabase.from("assets").insert({
    workspace_id: workspaceId,
    type,
    name: file.name,
    storage_path: path,
    public_url: publicUrl,
    mime_type: file.type,
    file_size: file.size,
  });

  return insertError?.message ?? null;
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onProgress: (done: number, total: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
      done++;
      onProgress(done, tasks.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export function AssetUpload({
  workspaceId,
  type = "hook",
  onUploadComplete,
  compact = false,
}: AssetUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState<StagedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
  }, []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    const nonImages = incoming.filter((f) => !f.type.startsWith("image/"));
    const images = incoming.filter((f) => f.type.startsWith("image/"));

    if (images.length === 0) {
      setError("Only image files are supported.");
      return;
    }

    const tooLarge = images.filter((f) => f.size > MAX_FILE_BYTES);
    const valid = images.filter((f) => f.size <= MAX_FILE_BYTES);

    const messages: string[] = [];
    if (nonImages.length > 0) {
      messages.push(
        `${nonImages.length} file${nonImages.length === 1 ? "" : "s"} skipped (not images).`,
      );
    }
    if (tooLarge.length > 0) {
      messages.push(
        `${tooLarge.length} file${tooLarge.length === 1 ? "" : "s"} skipped (max 10 MB each).`,
      );
    }

    setItems((prev) => {
      const room = MAX_FILES_PER_BATCH - prev.length;
      if (room <= 0) {
        setError(`You can stage up to ${MAX_FILES_PER_BATCH} images at a time.`);
        return prev;
      }
      const toAdd = valid.slice(0, room);
      if (valid.length > room) {
        messages.push(
          `Only ${room} more image${room === 1 ? "" : "s"} added (batch limit ${MAX_FILES_PER_BATCH}).`,
        );
      }
      if (toAdd.length === 0) return prev;
      return [
        ...prev,
        ...toAdd.map((file) => ({
          file,
          url: URL.createObjectURL(file),
        })),
      ];
    });

    if (messages.length > 0) setNotice(messages.join(" "));
    else setNotice(null);
    if (valid.length > 0) setError(null);
  }, []);

  function removeItem(index: number) {
    setItems((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearStage() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
    setError(null);
    setNotice(null);
  }

  const confirmUpload = useCallback(async () => {
    if (items.length === 0) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const tasks = items.map(
      (it) => () => uploadOneFile(workspaceId, type, it.file),
    );

    const totalCount = items.length;
    const errors = await runWithConcurrency(
      tasks,
      UPLOAD_CONCURRENCY,
      (done, total) => setProgress(Math.round((done / total) * 100)),
    );

    const failed = errors.filter((e): e is string => e !== null);
    clearStage();
    setUploading(false);
    setProgress(0);

    if (failed.length > 0) {
      const succeeded = totalCount - failed.length;
      if (succeeded > 0) {
        onUploadComplete();
        setError(
          `${succeeded} uploaded, ${failed.length} failed. ${failed[0]}`,
        );
      } else {
        setError(`Upload failed: ${failed[0]}`);
      }
    } else {
      onUploadComplete();
    }
  }, [items, workspaceId, type, onUploadComplete]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors",
          compact ? "p-5" : "p-8",
          dragging
            ? "border-[var(--ember)] bg-[var(--ember)]/5"
            : "border-gray-300 hover:border-gray-400",
          uploading && "pointer-events-none opacity-70",
        )}
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

        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto text-[var(--ember)] animate-spin" />
            <p className="text-sm font-medium">Uploading... {progress}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className={cn("mx-auto text-[#999]", compact ? "w-6 h-6" : "w-8 h-8")} />
            <p className="text-sm font-medium">Drop images here</p>
            <p className="text-xs text-[#999]">
              or click to browse — review below, then confirm upload
            </p>
          </div>
        )}
      </div>

      {items.length > 0 && !uploading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Ready to upload ({items.length})
            </p>
            <button
              type="button"
              onClick={clearStage}
              className="text-xs font-medium text-[#666] hover:text-black underline"
            >
              Clear all
            </button>
          </div>
          <div
            className={cn(
              "grid gap-2",
              compact
                ? "grid-cols-4"
                : "grid-cols-3 sm:grid-cols-4",
            )}
          >
            {items.map((it, i) => (
              <div
                key={it.url}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.url}
                  alt={it.file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(i);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  aria-label="Remove from queue"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={confirmUpload}
            className="w-full px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload {items.length} image{items.length === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {notice && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

interface AssetGridProps {
  assets: Array<{
    id: string;
    name: string;
    public_url: string;
  }>;
  onDelete: (id: string) => void;
  emptyMessage?: string;
}

export function AssetGrid({
  assets,
  onDelete,
  emptyMessage = "No images in your library yet",
}: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <p className="text-sm text-[#999] text-center py-6">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="relative group aspect-square rounded-lg overflow-hidden border-2 border-black shadow-[2px_2px_0_0_#000]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.public_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset.id);
            }}
            className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-xs text-white truncate">{asset.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
