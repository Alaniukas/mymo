"use client";

import { useEffect, useState } from "react";
import {
  Check,
  LayoutTemplate,
  Loader2,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportProgressPhase = "url" | "upload";

const URL_STEPS = [
  {
    id: "fetch",
    label: "Reading the post",
    hint: "Fetching carousel from the link",
    icon: ScanSearch,
    weight: 28,
  },
  {
    id: "host",
    label: "Saving slides",
    hint: "Re-hosting images to your library",
    icon: LayoutTemplate,
    weight: 38,
  },
  {
    id: "analyze",
    label: "Analyzing layout",
    hint: "Text zones, composition & structure",
    icon: Sparkles,
    weight: 34,
  },
] as const;

const UPLOAD_STEPS = [
  {
    id: "upload",
    label: "Uploading images",
    hint: "Sending slides to storage",
    icon: LayoutTemplate,
    weight: 55,
  },
  {
    id: "analyze",
    label: "Analyzing layout",
    hint: "Blueprint for carousel generation",
    icon: Sparkles,
    weight: 45,
  },
] as const;

interface TemplateImportProgressProps {
  phase: ImportProgressPhase;
  /** Real progress 0–100 when known (e.g. file upload); omit to simulate during URL import */
  realProgress?: number;
  active: boolean;
  sourceLabel?: string;
}

function stepIndexForProgress(
  progress: number,
  steps: readonly { weight: number }[],
): number {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += steps[i].weight;
    if (progress < acc) return i;
  }
  return steps.length - 1;
}

export function TemplateImportProgress({
  phase,
  realProgress,
  active,
  sourceLabel,
}: TemplateImportProgressProps) {
  const steps = phase === "url" ? URL_STEPS : UPLOAD_STEPS;
  const [simulated, setSimulated] = useState(0);

  useEffect(() => {
    if (!active || realProgress !== undefined) {
      setSimulated(0);
      return;
    }

    setSimulated(4);
    const tick = window.setInterval(() => {
      setSimulated((p) => {
        if (p >= 96) return p;
        const bump = p < 25 ? 2.2 : p < 55 ? 1.4 : p < 82 ? 0.9 : 0.35;
        return Math.min(96, p + bump);
      });
    }, 380);

    return () => window.clearInterval(tick);
  }, [active, realProgress]);

  if (!active) return null;

  const progress =
    realProgress !== undefined
      ? Math.min(100, Math.max(0, realProgress))
      : Math.round(simulated);

  const currentStep = stepIndexForProgress(progress, steps);
  const displayPct = progress >= 100 ? 100 : Math.max(progress, 3);

  return (
    <div
      className="rounded-xl border-2 border-black bg-gradient-to-br from-[#fff8f5] via-white to-[#f5f5ff] p-5 shadow-[4px_4px_0_0_#000] space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">
            {phase === "url" ? "Importing template" : "Creating template"}
          </p>
          {sourceLabel && (
            <p className="text-xs text-[#666] mt-0.5 line-clamp-1">{sourceLabel}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-black tabular-nums text-[var(--ember)]">
            {displayPct}%
          </span>
        </div>
      </div>

      <div className="relative h-2.5 w-full rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--ember)] to-[#ff9a5c] transition-[width] duration-500 ease-out"
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <div className="flex justify-center gap-2 py-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "relative aspect-[9/16] w-11 rounded-lg border-2 border-black overflow-hidden bg-white shadow-[2px_2px_0_0_#000] transition-all duration-500",
              i === 1 && "scale-105 -translate-y-1 z-10",
              i === 0 && "opacity-75 -rotate-6",
              i === 3 && "opacity-75 rotate-6",
            )}
          >
            <div
              className="absolute inset-0 bg-gradient-to-b from-gray-100 via-gray-50 to-gray-200 animate-pulse"
              style={{ animationDelay: `${i * 140}ms` }}
            />
            <div className="absolute inset-x-1.5 bottom-2 space-y-1">
              <div className="h-1 rounded-full bg-black/10" />
              <div className="h-1 w-2/3 rounded-full bg-black/5" />
            </div>
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {steps.map((step, i) => {
          const done = i < currentStep || (progress >= 100 && i === steps.length - 1);
          const current = i === currentStep && progress < 100;
          const Icon = step.icon;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
                current && "bg-[var(--ember)]/8 border border-[var(--ember)]/25",
                done && !current && "opacity-80",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                  done
                    ? "border-green-600 bg-green-50 text-green-700"
                    : current
                      ? "border-[var(--ember)] bg-white text-[var(--ember)]"
                      : "border-gray-200 bg-gray-50 text-[#999]",
                )}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : current ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    current ? "text-black" : done ? "text-[#444]" : "text-[#999]",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-[#666]">{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-xs text-[#888]">
        {progress >= 100
          ? "Done — opening preview…"
          : "This usually takes 30–90 seconds for longer carousels"}
      </p>
    </div>
  );
}
