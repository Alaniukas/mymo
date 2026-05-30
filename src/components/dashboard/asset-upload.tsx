"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface AssetUploadProps {
  workspaceId: string;
  /** Asset bucket. Defaults to "hook" — the app now treats assets as one pool. */
  type?: "hook" | "demo";
  onUploadComplete: () => void;
}

export function AssetUpload({
  workspaceId,
  type = "hook",
  onUploadComplete,
}: AssetUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      setUploading(true);
      setProgress(0);

      const supabase = createClient();
      let completed = 0;

      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() || "png";
        const path = `${workspaceId}/${type}s/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(path, file, { contentType: file.type });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("assets").getPublicUrl(path);

          await supabase.from("assets").insert({
            workspace_id: workspaceId,
            type,
            name: file.name,
            storage_path: path,
            public_url: publicUrl,
            mime_type: file.type,
            file_size: file.size,
          });
        }

        completed++;
        setProgress(Math.round((completed / imageFiles.length) * 100));
      }

      setUploading(false);
      setProgress(0);
      onUploadComplete();
    },
    [workspaceId, type, onUploadComplete],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
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
          if (e.target.files) uploadFiles(e.target.files);
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
          <Upload className="w-8 h-8 mx-auto text-[#999]" />
          <p className="text-sm font-medium">Drop images here</p>
          <p className="text-xs text-[#999]">or click to browse</p>
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
  onDelete: (id: string, storagePath: string) => void;
}

export function AssetGrid({ assets, onDelete }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <p className="text-sm text-[#999] text-center py-6">
        No assets uploaded yet
      </p>
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
              onDelete(asset.id, asset.public_url);
            }}
            className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
