"use client";

import { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Video,
  Save,
  Loader2,
  Check,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  TEXT_MODEL_OPTIONS,
  IMAGE_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  type ModelOption,
  type ModelSettings,
} from "@/lib/settings/models";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ModelSettingsForm({
  initialSettings,
  serviceRoleConfigured,
}: {
  initialSettings: ModelSettings;
  serviceRoleConfigured: boolean;
}) {
  const [textModel, setTextModel] = useState(initialSettings.text_model);
  const [imageModel, setImageModel] = useState(initialSettings.image_model);
  const [videoModel, setVideoModel] = useState(initialSettings.video_model ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const canSave = textModel.trim() !== "" && imageModel.trim() !== "";

  async function handleSave() {
    setState("saving");
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text_model: textModel.trim(),
          image_model: imageModel.trim(),
          video_model: videoModel.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save settings");
        setState("error");
        return;
      }

      if (data.settings) {
        setTextModel(data.settings.text_model);
        setImageModel(data.settings.image_model);
        setVideoModel(data.settings.video_model ?? "");
      }
      setState("saved");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-6">
      {!serviceRoleConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-sm text-amber-800">
          <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Saving is disabled.</span> Set the{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">
              SUPABASE_SECRET_KEY
            </code>{" "}
            environment variable so the server can persist settings.
          </p>
        </div>
      )}

      <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] space-y-6">
        <ModelField
          icon={Type}
          label="Text model"
          description="Powers website crawl analysis and all caption writing."
          options={TEXT_MODEL_OPTIONS}
          value={textModel}
          onChange={(v) => {
            setTextModel(v);
            setState("idle");
          }}
        />

        <div className="border-t-2 border-dashed border-gray-200" />

        <ModelField
          icon={ImageIcon}
          label="Image model"
          description="Generates carousel slide images."
          options={IMAGE_MODEL_OPTIONS}
          value={imageModel}
          onChange={(v) => {
            setImageModel(v);
            setState("idle");
          }}
        />

        <div className="border-t-2 border-dashed border-gray-200" />

        <ModelField
          icon={Video}
          label="Video model"
          description="Animates carousel slide images into short clips (image-to-video). Falls back to the default when set to None."
          options={VIDEO_MODEL_OPTIONS}
          value={videoModel}
          onChange={(v) => {
            setVideoModel(v);
            setState("idle");
          }}
          allowNone
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || !serviceRoleConfigured || state === "saving"}
          className="px-6 py-3 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2"
        >
          {state === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {state === "saving" ? "Saving..." : "Save settings"}
        </button>

        {state === "saved" && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

const CUSTOM = "__custom__";
const NONE = "__none__";

function ModelField({
  icon: Icon,
  label,
  description,
  options,
  value,
  onChange,
  allowNone = false,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  options: ModelOption[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  const presetSlugs = options.map((o) => o.slug);
  const isPreset = value !== "" && presetSlugs.includes(value);
  const [custom, setCustom] = useState(value !== "" && !isPreset);

  const selectValue = custom ? CUSTOM : value === "" ? NONE : value;

  function handleSelect(next: string) {
    if (next === CUSTOM) {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange(next === NONE ? "" : next);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[var(--ember)]/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--ember)]" />
        </div>
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <p className="text-xs text-[#666] mb-3 ml-10">{description}</p>

      <div className="ml-10 space-y-2">
        <select
          value={selectValue}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full px-3 py-2.5 border-2 border-black rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        >
          {allowNone && <option value={NONE}>None</option>}
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
              {o.note ? ` — ${o.note}` : ""}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>

        {custom && (
          <input
            type="text"
            value={value}
            autoFocus
            onChange={(e) => onChange(e.target.value)}
            placeholder="custom-model-slug"
            className="w-full px-3 py-2.5 border-2 border-black rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
          />
        )}
      </div>
    </div>
  );
}
