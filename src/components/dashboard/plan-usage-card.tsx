import Link from "next/link";
import { Crown } from "lucide-react";

// Placeholder usage — wire to real plan/limits from Supabase later.
const usage = [
  { label: "Carousels", used: 3, limit: 5 },
  { label: "Exports", used: 2, limit: 5 },
  { label: "Storage", used: 18, limit: 40 },
];

export function PlanUsageCard() {
  return (
    <div className="rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#666]">
          Free Plan
        </span>
        <Crown className="h-3.5 w-3.5 text-[var(--ember)]" />
      </div>

      <div className="mt-2.5 space-y-2">
        {usage.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-[11px] text-[#555]">
              <span>{item.label}</span>
              <span className="font-medium text-[#333]">
                {item.used}/{item.limit}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-[var(--ember)]"
                style={{
                  width: `${Math.min(100, (item.used / item.limit) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/pricing"
        className="mt-3 flex w-full items-center justify-center rounded-lg border-2 border-black bg-[var(--ember)] px-3 py-1.5 text-xs font-semibold text-white shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]"
      >
        Get more credits
      </Link>
    </div>
  );
}
