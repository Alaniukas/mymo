"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Type, Video } from "lucide-react";

const modes = [
  {
    href: "/dashboard/founder-hooks/new",
    title: "Founder Hook Reels",
    badge: "Video",
    description:
      "Upload your app demo clips. AI generates ultra-realistic UGC creator video hooks (you choose how many), stitched in front of your demo into one reel with minimalist storyline captions — A/B test what stops the scroll.",
    icon: Video,
    accent: "bg-[#1a1a1a] text-white",
  },
  {
    href: "/dashboard/stories/carousel",
    title: "Simple Text Carousel",
    badge: "Text",
    description:
      "Clean black & white text slides, written by AI from your topic and brand. Typography carries the message from hook to CTA — pick your slide count and post.",
    icon: Type,
    accent: "bg-white border-2 border-black text-black",
  },
];

export default function CreateHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-10">
        <p className="text-sm font-medium text-[#666]">Create</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          What are you making?
        </h1>
        <p className="mt-2 max-w-xl text-[#444]">
          Two formats for app founders — a viral video hook reel or a clean text
          carousel. Both powered by your brand brain.
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
        Both formats are powered by your brand brain.{" "}
        <Link
          href="/dashboard/onboarding"
          className="font-semibold text-black underline"
        >
          Brand setup
        </Link>{" "}
        makes them sharper.
      </div>
    </div>
  );
}
