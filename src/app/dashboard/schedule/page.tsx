"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import {
  ScheduleQueue,
  type ScheduledPostItem,
} from "@/components/dashboard/schedule-queue";
import {
  platformConfig,
  type ConnectPlatform,
} from "@/components/dashboard/social-connect-card";
import { generateSlots, WEEKDAY_LABELS } from "@/lib/schedule/slots";
import { cn } from "@/lib/utils";

interface Connection {
  id: string;
  platform: string;
  platform_username: string | null;
}

const MAX_SLOTS = 10;

export default function SchedulePage() {
  const { activeProjectId } = useActiveProject();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [readyCount, setReadyCount] = useState(0);
  const [items, setItems] = useState<ScheduledPostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [connectionId, setConnectionId] = useState<string>("");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [filling, setFilling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/schedule");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    const supabase = createClient();

    const [{ data: conns }, { count }] = await Promise.all([
      supabase
        .from("social_connections")
        .select("id, platform, platform_username")
        .eq("workspace_id", activeProjectId),
      supabase
        .from("carousels")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", activeProjectId)
        .eq("status", "ready"),
    ]);

    const publishable = (conns ?? []).filter((c) => c.platform in platformConfig);
    setConnections(publishable);
    setConnectionId((prev) =>
      prev && publishable.some((c) => c.id === prev)
        ? prev
        : publishable[0]?.id ?? "",
    );
    setReadyCount(count ?? 0);
    await loadQueue();
    setLoading(false);
  }, [activeProjectId, loadQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const slots = useMemo(
    () => generateSlots({ days, times }, MAX_SLOTS),
    [days, times],
  );
  const fillCount = Math.min(slots.length, readyCount);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  function updateTime(i: number, value: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  async function fillQueue() {
    if (!connectionId || slots.length === 0) return;
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    setFilling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: connection.platform,
          social_connection_id: connection.id,
          schedule_times: slots.map((d) => d.toISOString()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Could not schedule" });
        return;
      }
      const n = data.scheduled ?? 0;
      setMessage({
        type: n > 0 ? "success" : "error",
        text:
          n > 0
            ? `Scheduled ${n} post${n === 1 ? "" : "s"}. They'll publish automatically.`
            : data.message || "Nothing was scheduled.",
      });
      await load();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setFilling(false);
    }
  }

  if (!activeProjectId) return <NoProjectNotice />;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-[#666]">
          Set a posting cadence and auto-fill your queue from ready carousels.
          Scheduled posts publish automatically — no need to come back.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-black/15 bg-white/60 p-8 text-center">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 text-[#999]" />
          <p className="text-sm font-medium">No accounts connected</p>
          <p className="mb-3 mt-0.5 text-xs text-[#666]">
            Connect a social account to schedule posts.
          </p>
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-[var(--ember)] px-4 py-2 text-sm font-semibold text-white shadow-[2px_2px_0_0_#000]"
          >
            Go to Connections
          </Link>
        </div>
      ) : (
        <section className="space-y-5 rounded-xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--ember)]" />
            <h2 className="font-semibold">Auto-schedule</h2>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666]">
              Account
            </label>
            <div className="flex flex-wrap gap-2">
              {connections.map((conn) => {
                const cfg = platformConfig[conn.platform as ConnectPlatform];
                const selected = connectionId === conn.id;
                return (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => setConnectionId(conn.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-[#444] hover:border-black",
                    )}
                  >
                    <span className="truncate max-w-[160px]">
                      {cfg?.name ?? conn.platform}
                      {conn.platform_username ? ` · ${conn.platform_username}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666]">
              Post on
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-9 w-9 rounded-lg border-2 text-xs font-bold transition-colors",
                    days.includes(d)
                      ? "border-black bg-[var(--ember)] text-white"
                      : "border-gray-200 bg-white text-[#444] hover:border-black",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666]">
              At
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateTime(i, e.target.value)}
                    className="rounded-lg border-2 border-black/15 px-2 py-1.5 text-sm focus:border-black focus:outline-none"
                  />
                  {times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTimes((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-md p-1 text-[#999] hover:bg-gray-100 hover:text-black"
                      aria-label="Remove time"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {times.length < 4 && (
                <button
                  type="button"
                  onClick={() => setTimes((prev) => [...prev, "17:00"])}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-dashed border-black/20 px-2.5 py-1.5 text-xs font-semibold text-[#555] hover:border-black"
                >
                  <Plus className="h-3.5 w-3.5" /> Time
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-black/[0.03] px-3 py-2.5 text-xs text-[#555]">
            {readyCount === 0 ? (
              <>
                No ready carousels to schedule.{" "}
                <Link href="/dashboard/create" className="font-semibold underline">
                  Create one
                </Link>
                .
              </>
            ) : fillCount === 0 ? (
              "Pick at least one day and time to generate slots."
            ) : (
              <>
                Will schedule <span className="font-semibold">{fillCount}</span> of{" "}
                {readyCount} ready carousel{readyCount === 1 ? "" : "s"} into the next{" "}
                {fillCount} slot{fillCount === 1 ? "" : "s"}
                {slots[0] ? `, starting ${slots[0].toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}.
              </>
            )}
          </div>

          {message && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {message.text}
            </div>
          )}

          <button
            type="button"
            onClick={fillQueue}
            disabled={filling || fillCount === 0 || !connectionId}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-[var(--ember)] py-3 font-semibold text-white shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50"
          >
            {filling ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Scheduling…
              </>
            ) : (
              <>
                <CalendarClock className="h-5 w-5" /> Fill queue
              </>
            )}
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#666]">
          Queue
        </h2>
        <ScheduleQueue items={items} onChanged={loadQueue} />
      </section>
    </div>
  );
}
