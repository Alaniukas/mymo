"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import {
  platformConfig,
  type ConnectPlatform,
} from "@/components/dashboard/social-connect-card";
import { cn } from "@/lib/utils";

export interface ScheduledPostItem {
  id: string;
  carousel_id: string;
  title: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  preview_url: string | null;
}

function platformName(platform: string): string {
  return platformConfig[platform as ConnectPlatform]?.name ?? platform;
}

function statusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return { label: "Scheduled", icon: CalendarClock, cls: "bg-[var(--ember)] text-white" };
    case "published":
      return { label: "Published", icon: CheckCircle2, cls: "bg-green-600 text-white" };
    case "failed":
      return { label: "Failed", icon: XCircle, cls: "bg-red-600 text-white" };
    case "publishing":
      return { label: "Publishing", icon: Loader2, cls: "bg-gray-700 text-white" };
    default:
      return { label: status, icon: CalendarClock, cls: "bg-gray-400 text-white" };
  }
}

function formatWhen(item: ScheduledPostItem): string {
  const iso = item.scheduled_for ?? item.published_at;
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ScheduleQueueProps {
  items: ScheduledPostItem[];
  onChanged: () => void;
}

export function ScheduleQueue({ items, onChanged }: ScheduleQueueProps) {
  const [canceling, setCanceling] = useState<string | null>(null);

  async function cancel(id: string) {
    setCanceling(id);
    try {
      await fetch(`/api/schedule/${id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setCanceling(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-black/15 bg-white/60 p-8 text-center text-sm text-[#666]">
        Nothing scheduled yet. Set a cadence above and fill your queue.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const badge = statusBadge(item.status);
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]"
          >
            <Link
              href={`/dashboard/carousels/${item.carousel_id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-[#f5f5f5]">
                {item.preview_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.preview_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-[#666]">
                  {platformName(item.platform)}
                  {formatWhen(item) ? ` · ${formatWhen(item)}` : ""}
                </p>
              </div>
            </Link>

            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                badge.cls,
              )}
            >
              <badge.icon
                className={cn("h-3 w-3", item.status === "publishing" && "animate-spin")}
              />
              {badge.label}
            </span>

            {item.status === "scheduled" && (
              <button
                type="button"
                onClick={() => cancel(item.id)}
                disabled={canceling === item.id}
                title="Cancel"
                className="shrink-0 rounded-md p-1.5 text-[#999] transition-colors hover:bg-gray-100 hover:text-black disabled:opacity-50"
              >
                {canceling === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
