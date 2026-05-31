"use client";

import { cn } from "@/lib/utils";

interface ImperfectCopyToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  id?: string;
  label?: string;
  description?: string;
}

export function ImperfectCopyToggle({
  enabled,
  onChange,
  id = "imperfect-toggle",
  label = "Wrong spelling",
  description = "Adds subtle typos and casual wording so copy sounds raw and human — not too polished or obviously AI.",
}: ImperfectCopyToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border-2 border-black/10 bg-white/80 px-4 py-3">
      <div>
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        <p className="mt-0.5 max-w-sm text-xs text-[#666]">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-black transition-colors",
          enabled ? "bg-[var(--ember)]" : "bg-gray-200",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full border border-black bg-white transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
