import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#666]">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-[var(--ember)]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--ember)]" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
