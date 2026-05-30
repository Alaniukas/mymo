"use client";

import {
  Check,
  ShoppingBag,
  Smartphone,
  UserRound,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type NicheSlug } from "@/lib/carousel/niches";
import { NICHE_CARDS } from "@/lib/carousel/template-presets";

const NICHE_ICONS: Record<NicheSlug, LucideIcon> = {
  ecomm: ShoppingBag,
  app: Smartphone,
  personal_brand: UserRound,
  viral: Flame,
};

// Selectable niche cards for onboarding. Reuses the niche presentation metadata
// (label, tagline, gradient) from template-presets so the cards stay in sync
// with the Templates page.
export function NicheSelect({
  value,
  onChange,
}: {
  value: NicheSlug | null;
  onChange: (slug: NicheSlug) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {NICHE_CARDS.map((n) => {
        const Icon = NICHE_ICONS[n.slug];
        const selected = value === n.slug;
        return (
          <button
            key={n.slug}
            type="button"
            onClick={() => onChange(n.slug)}
            aria-pressed={selected}
            className={cn(
              "group relative text-left bg-white border-2 border-black rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-200",
              selected
                ? "translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_0_#000] ring-2 ring-[var(--ember)]"
                : "shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
            )}
          >
            <div
              className={cn(
                "h-20 bg-gradient-to-br flex items-center justify-center",
                n.gradient,
              )}
            >
              <Icon className="w-9 h-9 text-white drop-shadow" />
            </div>
            {selected && (
              <span className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--ember)] border-2 border-black">
                <Check className="w-3.5 h-3.5 text-white" />
              </span>
            )}
            <div className="p-4">
              <h3 className="text-base font-bold">{n.label}</h3>
              <p className="text-sm text-[#666] mt-0.5">{n.tagline}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
