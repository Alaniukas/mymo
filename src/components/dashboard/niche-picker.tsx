"use client";

import { cn } from "@/lib/utils";
import { NICHES, type NicheSlug } from "@/lib/carousel/niches";
import { NICHE_META } from "@/lib/carousel/template-presets";

interface NichePickerProps {
  value: NicheSlug | null;
  onChange: (niche: NicheSlug) => void;
  disabled?: boolean;
  /** Compact pills (default) or stacked cards for onboarding-style pickers. */
  variant?: "pills" | "cards";
}

export function NichePicker({
  value,
  onChange,
  disabled = false,
  variant = "pills",
}: NichePickerProps) {
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {NICHES.map((n) => {
          const meta = NICHE_META[n.slug];
          const selected = value === n.slug;
          return (
            <button
              key={n.slug}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n.slug)}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-50",
                selected
                  ? "border-[var(--ember)] bg-[var(--ember)]/5 ring-2 ring-[var(--ember)]"
                  : "border-gray-200 hover:border-black",
              )}
            >
              <span className="block text-sm font-semibold">{meta.label}</span>
              <span className="mt-0.5 block text-xs text-[#666]">{meta.tagline}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {NICHES.map((n) => (
        <button
          key={n.slug}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n.slug)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors disabled:opacity-50",
            value === n.slug
              ? "bg-[var(--ember)] text-white border-black"
              : "bg-white text-[#666] border-gray-200 hover:border-black",
          )}
        >
          {NICHE_META[n.slug].label}
        </button>
      ))}
    </div>
  );
}
