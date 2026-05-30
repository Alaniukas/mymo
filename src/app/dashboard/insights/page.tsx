"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, BarChart3, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { aggregateAngleStats, type AngleStat } from "@/lib/analytics/events";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";

interface RawEvent {
  angle: string | null;
  framework_id: string | null;
  event_type: string;
}

export default function InsightsPage() {
  const { activeProjectId } = useActiveProject();
  const [stats, setStats] = useState<AngleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    // content_events arrives in migration 011; tolerate its absence.
    const { data, error } = await supabase
      .from("content_events")
      .select("angle, framework_id, event_type")
      .eq("workspace_id", activeProjectId);

    if (error) {
      setNeedsMigration(true);
      setLoading(false);
      return;
    }

    setStats(aggregateAngleStats((data ?? []) as RawEvent[]));
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = stats.reduce(
    (acc, s) => {
      acc.generated += s.generated;
      acc.published += s.published;
      acc.exported += s.exported;
      return acc;
    },
    { generated: 0, published: 0, exported: 0 },
  );

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Angle Insights</h1>
        <p className="text-[#666] mt-1">
          Which content angles actually convert. Win rate is the share of
          generated posts for an angle that made it all the way to published.
        </p>
      </div>

      {needsMigration ? (
        <Note>
          Analytics tracking isn&apos;t set up yet. Apply migration{" "}
          <code className="font-mono">011_content_events.sql</code> to start
          recording angle performance.
        </Note>
      ) : stats.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 mx-auto text-[#999] mb-4" />
          <h2 className="text-xl font-bold mb-2">No angle data yet</h2>
          <p className="text-[#666] mb-6">
            Generate a few carousels from different angles and your win rates
            will show up here.
          </p>
          <Link
            href="/dashboard/carousels/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--ember)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
          >
            <Sparkles className="w-4 h-4" />
            Create a carousel
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Generated" value={totals.generated} />
            <SummaryCard label="Published" value={totals.published} />
            <SummaryCard label="Exported" value={totals.exported} />
          </div>

          <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50 text-left">
                  <th className="px-4 py-3 font-bold">Angle</th>
                  <th className="px-4 py-3 font-bold text-center">Generated</th>
                  <th className="px-4 py-3 font-bold text-center">Published</th>
                  <th className="px-4 py-3 font-bold text-center">Exported</th>
                  <th className="px-4 py-3 font-bold w-[28%]">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.angle} className="border-b border-black/10 last:border-0">
                    <td className="px-4 py-3 font-semibold">{s.label}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {s.generated}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {s.published}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {s.exported}
                    </td>
                    <td className="px-4 py-3">
                      <WinRate rate={s.winRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0_0_#000]">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#666]">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function WinRate({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span className="text-xs text-[#999]">—</span>;
  }
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 rounded-full bg-gray-100 border border-black/10 overflow-hidden">
        <div
          className="h-full bg-[var(--ember)]"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-9 text-right">
        {pct}%
      </span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-2 border-black rounded-xl p-4 text-sm text-[#444] shadow-[3px_3px_0_0_#000]">
      {children}
    </div>
  );
}
