"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle, Layers, Play } from "lucide-react";
import {
  HEADER_MENU_VIDEO,
  resourceHighlight,
  resourceLinks,
  resourceTestimonial,
  templateChoices,
  useCaseCards,
  type UseCaseCard,
} from "@/lib/nav-menus";
import { cn } from "@/lib/utils";

const starRotations = [-9, 4, -3, 7, -5];

function ReviewStars() {
  return (
    <div className="flex items-end gap-[3px] text-[#F4A63D] text-[26px] leading-none mb-1">
      {starRotations.map((deg, i) => (
        <span key={i} className="inline-block" style={{ transform: `rotate(${deg}deg)` }}>
          ★
        </span>
      ))}
    </div>
  );
}

function UseCaseReview({ card }: { card: UseCaseCard }) {
  return (
    <div
      className="mt-auto pt-5 -rotate-[3deg] origin-bottom-left"
      style={{ fontFamily: "var(--font-caveat), cursive" }}
    >
      <ReviewStars />
      <p className="text-[22px] leading-[1.15] text-[#3C2E25]">“{card.review.quote}”</p>
      <p className="text-[16px] text-[#3C2E25]/60 mt-1">{card.review.author}</p>
    </div>
  );
}

export function UseCasesDropdown({
  activeIndex,
  onActiveIndexChange,
  onClose,
}: {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const card = useCaseCards[activeIndex] ?? useCaseCards[0];

  return (
    <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 p-4 flex gap-5">
      <div className="flex flex-col gap-2">
        {useCaseCards.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={onClose}
              className={cn(
                "relative rounded-xl w-[210px] h-[126px] overflow-hidden bg-[#FAFAF9] transition-all duration-200",
                !isActive && "grayscale",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <h4 className="relative px-3 pt-2.5 font-gambarino text-[22px] text-white leading-tight z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                {item.label}
              </h4>
            </Link>
          );
        })}
      </div>

      <div className="w-[220px] border-l border-black/[0.06] pl-5 flex flex-col min-h-[410px]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]/50 mb-3">
          {card.rightTitle}
        </span>
        <div className="flex flex-col gap-0.5">
          {card.rightLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={onClose}
              className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-[#FAFAF9] transition-colors group"
            >
              <span className="text-[14px] text-[#0A0A0A] font-medium">{link.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0A0A0A]/40 group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
        <UseCaseReview card={card} />
      </div>
    </div>
  );
}

export function TemplatesDropdown({
  activeIndex,
  onActiveIndexChange,
  onClose,
}: {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const choice = templateChoices[activeIndex] ?? templateChoices[0];

  return (
    <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 p-4 flex gap-4">
      <div className="w-[240px] flex flex-col gap-1">
        {templateChoices.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors group",
                isActive ? "bg-[#FAFAF9]" : "hover:bg-[#FAFAF9]",
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                  isActive
                    ? "bg-[var(--ember)] text-white"
                    : "bg-[#F2F0ED] text-[#3C2E25]",
                )}
              >
                <Play className="w-4 h-4 fill-current" />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold text-[#0A0A0A] leading-tight">
                  {item.label}
                </span>
                <span className="text-[12px] text-[#0A0A0A]/60 leading-tight mt-0.5">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="w-[200px] rounded-xl overflow-hidden bg-[#0A0A0A] shrink-0">
        <video
          key={choice.label}
          src={HEADER_MENU_VIDEO}
          className="w-full h-full object-cover aspect-[9/16] min-h-[280px]"
          autoPlay
          loop
          muted
          playsInline
          preload="none"
        />
      </div>
    </div>
  );
}

const resourceIcons = [BookOpen, Layers, HelpCircle] as const;

export function ResourcesDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 p-4 flex gap-3 w-[calc(100vw-1.5rem)] max-w-[880px]">
      <div className="flex-1 space-y-1">
        {resourceLinks.map((item, index) => {
          const Icon = resourceIcons[index] ?? BookOpen;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#FAFAF9] transition-colors group"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F2F0ED] text-[#3C2E25] flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold text-[#0A0A0A] leading-tight">
                  {item.label}
                </span>
                <span className="text-[12px] text-[#0A0A0A]/60 leading-tight mt-0.5">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href={resourceHighlight.href}
        onClick={onClose}
        className="w-[240px] rounded-xl p-4 flex flex-col justify-between hover:scale-[0.99] transition-transform shrink-0"
        style={{ backgroundColor: resourceHighlight.accent }}
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]/60">
            {resourceHighlight.eyebrow}
          </span>
          <h4 className="mt-2 text-[16px] font-semibold text-[#0A0A0A] leading-tight">
            {resourceHighlight.title}
          </h4>
          <p className="mt-2 text-[13px] text-[#0A0A0A]/70 leading-relaxed">
            {resourceHighlight.body}
          </p>
        </div>
        <span className="text-[13px] font-semibold text-[#0A0A0A] mt-4 inline-flex items-center gap-1">
          Browse guides
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>

      <div
        className="w-[200px] rounded-xl bg-[#FAFAF9] border border-black/[0.06] p-4 flex flex-col justify-end shrink-0"
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        <p className="text-[20px] leading-snug text-[#3C2E25]">“{resourceTestimonial.quote}”</p>
        <p className="text-[15px] font-semibold text-[#3C2E25] mt-2">{resourceTestimonial.author}</p>
        <p className="text-[13px] text-[#3C2E25]/60">{resourceTestimonial.role}</p>
      </div>
    </div>
  );
}
