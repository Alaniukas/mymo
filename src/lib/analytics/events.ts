import type { SupabaseClient } from "@supabase/supabase-js";
import { getFramework } from "@/lib/carousel/frameworks";

/**
 * Angle (framework) analytics — a thin, best-effort writer over the
 * `content_events` table (migration 011). Logging must NEVER break content
 * generation or publishing, and an un-migrated database (no table yet) is a
 * silent no-op, so every failure mode is swallowed.
 */

export type ContentEventType = "generated" | "published" | "exported" | "edited";

export interface ContentEventInput {
  workspaceId: string;
  eventType: ContentEventType;
  carouselId?: string | null;
  frameworkId?: string | null;
  angle?: string | null;
  platform?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logContentEvent(
  supabase: SupabaseClient,
  input: ContentEventInput,
): Promise<void> {
  try {
    const angle =
      input.angle ?? getFramework(input.frameworkId ?? undefined)?.angle ?? null;

    await supabase.from("content_events").insert({
      workspace_id: input.workspaceId,
      carousel_id: input.carouselId ?? null,
      framework_id: input.frameworkId ?? null,
      angle,
      event_type: input.eventType,
      platform: input.platform ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.warn(`[content-events] failed to log ${input.eventType}:`, err);
  }
}

export interface AngleStat {
  angle: string;
  label: string;
  generated: number;
  published: number;
  exported: number;
  /** published / generated, 0..1; null when nothing was generated. */
  winRate: number | null;
}

interface RawEvent {
  angle: string | null;
  framework_id: string | null;
  event_type: string;
}

/** Human label for an angle key, preferring the framework's display name. */
function angleLabel(angle: string, frameworkId: string | null): string {
  const fw = getFramework(frameworkId ?? undefined);
  if (fw && fw.angle === angle) return fw.name;
  return angle
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Aggregates raw events into per-angle generated/published/win-rate stats. */
export function aggregateAngleStats(events: RawEvent[]): AngleStat[] {
  const byAngle = new Map<string, AngleStat>();

  for (const e of events) {
    if (!e.angle) continue;
    let stat = byAngle.get(e.angle);
    if (!stat) {
      stat = {
        angle: e.angle,
        label: angleLabel(e.angle, e.framework_id),
        generated: 0,
        published: 0,
        exported: 0,
        winRate: null,
      };
      byAngle.set(e.angle, stat);
    }
    if (e.event_type === "generated") stat.generated += 1;
    else if (e.event_type === "published") stat.published += 1;
    else if (e.event_type === "exported") stat.exported += 1;
  }

  const stats = Array.from(byAngle.values());
  for (const s of stats) {
    s.winRate = s.generated > 0 ? s.published / s.generated : null;
  }

  // Best-performing angles first; ties broken by volume.
  stats.sort((a, b) => {
    const wr = (b.winRate ?? -1) - (a.winRate ?? -1);
    return wr !== 0 ? wr : b.generated - a.generated;
  });
  return stats;
}
