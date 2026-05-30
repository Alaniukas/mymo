"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Flame,
  ImagePlus,
  Link2,
  Sparkles,
} from "lucide-react";

const modes = [
  {
    href: "/dashboard/stories/new?source=social",
    title: "Social → Story",
    badge: "Variant 1",
    description:
      "Paste IG / TikTok profile link. We scrape your last 5–20 posts, import the photos, and build a marketing carousel from your real content.",
    icon: Link2,
    accent: "bg-[#1a1a1a] text-white",
  },
  {
    href: "/dashboard/stories/new?source=brand",
    title: "Brand + Photos",
    badge: "Variant 2",
    description:
      "Your brand brain + uploaded photos + optional notes. AI plans on-brand storytelling without needing a social link.",
    icon: ImagePlus,
    accent: "bg-white border-2 border-black text-black",
  },
  {
    href: "/dashboard/stories/carousel",
    title: "Story Carousel",
    badge: "Variant 3",
    description:
      "Serial swipe stories for follower growth — text-only black/white slides or AI images that share one story line. Optional brand experience angle.",
    icon: BookOpen,
    accent: "bg-white border-2 border-black text-black",
  },
  {
    href: "/dashboard/viral/new",
    title: "Brainrot Meme Pump",
    badge: "Variant 4",
    description:
      "For founders who want volume. Pick a meme format — AI ships scroll-stopping hooks with your product on the back slide.",
    icon: Flame,
    accent: "bg-[var(--ember)] text-white",
  },
];

export default function CreateHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-10">
        <p className="text-sm font-medium text-[#666]">Create</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Pick your engine
        </h1>
        <p className="mt-2 max-w-xl text-[#444]">
          Four ways in — all powered by your brand brain. Same export pipeline,
          different growth playbooks.
        </p>
      </div>

      <div className="space-y-4">
        {modes.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="group flex items-start gap-4 rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000]"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${mode.accent}`}
            >
              <mode.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{mode.title}</h2>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#666]">
                  {mode.badge}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#555]">{mode.description}</p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#999] transition group-hover:text-black" />
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-black/20 bg-white/60 p-4 text-sm text-[#555]">
        <Sparkles className="mb-2 h-4 w-4 text-[var(--ember)]" />
        LinkedIn & Facebook profile scrape coming next — IG & TikTok work today
        (needs <code className="text-xs">APIFY_TOKEN</code>).{" "}
        <Link
          href="/dashboard/onboarding"
          className="font-semibold text-black underline"
        >
          Brand setup
        </Link>{" "}
        improves all four modes.
      </div>

      <p className="mt-6 text-center text-xs text-[#888]">
        <Link href="/dashboard/carousels/new" className="underline hover:text-black">
          Template studio (legacy)
        </Link>
      </p>
    </div>
  );
}
