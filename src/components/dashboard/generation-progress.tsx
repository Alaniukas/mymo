"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type GenerationPhase =
  | "planning"
  | "generating"
  | "finalizing"
  | "done";

interface SlidePreview {
  position: number;
  status: string;
  image_url?: string | null;
}

interface CarouselProgress {
  id: string;
  status: string;
  completed: number;
  total: number;
  failed: number;
  slides: SlidePreview[];
}

interface GenerationProgressProps {
  carouselIds: string[];
  phase: GenerationPhase;
  label?: string;
  batchIndex?: number;
  batchTotal?: number;
  onProgress?: (aggregated: {
    completed: number;
    total: number;
    failed: number;
    allReady: boolean;
  }) => void;
}

async function fetchCarouselProgress(id: string): Promise<CarouselProgress> {
  const res = await fetch(`/api/carousel-status/${id}`);
  const data = await res.json();
  const progress = data.progress ?? { completed: 0, failed: 0, total: 0 };
  return {
    id,
    status: data.status ?? "generating",
    completed: progress.completed ?? 0,
    total: progress.total ?? 0,
    failed: progress.failed ?? 0,
    slides: (data.slides ?? []) as SlidePreview[],
  };
}

const PHASE_STEPS: { id: GenerationPhase; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "generating", label: "Generating slides" },
  { id: "finalizing", label: "Finalizing" },
  { id: "done", label: "Done" },
];

export function GenerationProgressPanel({
  carouselIds,
  phase,
  label = "Creating your carousel",
  batchIndex,
  batchTotal,
  onProgress,
}: GenerationProgressProps) {
  const [rows, setRows] = useState<CarouselProgress[]>([]);

  useEffect(() => {
    if (carouselIds.length === 0) return;
    let cancelled = false;

    async function poll() {
      const next = await Promise.all(carouselIds.map(fetchCarouselProgress));
      if (cancelled) return;
      setRows(next);

      const completed = next.reduce((s, r) => s + r.completed, 0);
      const total = next.reduce((s, r) => s + r.total, 0);
      const failed = next.reduce((s, r) => s + r.failed, 0);
      const allReady = next.every(
        (r) =>
          r.status === "ready" ||
          r.status === "draft" ||
          (r.total > 0 && r.completed + r.failed >= r.total),
      );
      onProgress?.({ completed, total, failed, allReady });
    }

    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [carouselIds, onProgress]);

  const completed = rows.reduce((s, r) => s + r.completed, 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const failed = rows.reduce((s, r) => s + r.failed, 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : phase === "planning" ? 8 : 15;

  const allSlides = rows.flatMap((r) => r.slides).sort((a, b) => a.position - b.position);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_#000]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">{label}</p>
            {batchTotal && batchTotal > 1 && (
              <p className="mt-0.5 text-xs text-[#666]">
                Carousel {(batchIndex ?? 0) + 1} of {batchTotal}
              </p>
            )}
          </div>
          {phase !== "done" && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--ember)]" />
          )}
        </div>

        <div className="mt-5 flex gap-2">
          {PHASE_STEPS.map((step) => {
            const idx = PHASE_STEPS.findIndex((s) => s.id === phase);
            const stepIdx = PHASE_STEPS.findIndex((s) => s.id === step.id);
            const done = stepIdx < idx || phase === "done";
            const active = step.id === phase;
            return (
              <div key={step.id} className="flex-1 text-center">
                <div
                  className={cn(
                    "mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                    done
                      ? "border-green-600 bg-green-50 text-green-700"
                      : active
                        ? "border-[var(--ember)] bg-[var(--ember)]/10 text-[var(--ember)]"
                        : "border-black/15 text-[#999]",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : stepIdx + 1}
                </div>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-medium",
                    active ? "text-black" : "text-[#888]",
                  )}
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs font-medium text-[#555]">
            <span>
              {phase === "planning"
                ? "Writing plan & picking memes…"
                : phase === "finalizing"
                  ? "Burning captions…"
                  : `${completed} of ${total || "…"} slides ready`}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-black/10 bg-[#f0f0f0]">
            <div
              className="h-full rounded-full bg-[var(--ember)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {failed > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {failed} slide{failed === 1 ? "" : "s"} failed — continuing with the rest.
            </p>
          )}
        </div>

        {allSlides.length > 0 && (
          <div className="mt-5 grid grid-cols-4 gap-2">
            {allSlides.slice(0, 8).map((slide) => (
              <div
                key={`${slide.position}-${slide.image_url ?? slide.status}`}
                className="relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-[#fafafa]"
              >
                {slide.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.image_url}
                    alt={`Slide ${slide.position}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    {slide.status === "generating" || slide.status === "pending" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#999]" />
                    ) : (
                      <span className="text-[10px] text-[#aaa]">#{slide.position}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {carouselIds.length > 1 && (
          <p className="mt-4 text-center text-xs text-[#666]">
            Generating {carouselIds.length} carousels in parallel
          </p>
        )}
      </div>
    </div>
  );
}

export async function pollCarouselsUntilReady(
  carouselIds: string[],
  maxAttempts = 120,
  intervalMs = 2500,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const rows = await Promise.all(carouselIds.map(fetchCarouselProgress));
    const allReady = rows.every(
      (r) =>
        r.status === "ready" ||
        r.status === "draft" ||
        (r.total > 0 && r.completed + r.failed >= r.total),
    );
    if (allReady) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
