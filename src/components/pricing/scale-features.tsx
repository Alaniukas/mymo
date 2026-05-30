import type { ReactNode } from "react";
import { Play, Sparkles } from "lucide-react";
import { VideoPhone } from "@/components/pricing/video-phone";

const actorVideos = [
  { poster: "/videos/posters/landing-compare-1.jpg", src: "/videos/landing-compare-1.mp4", rotate: "-6deg", height: 170 },
  { poster: "/videos/posters/landing-compare-2.jpg", src: "/videos/landing-compare-2.mp4", rotate: "0deg", height: 195 },
  { poster: "/videos/posters/landing-compare-3.jpg", src: "/videos/landing-compare-3.mp4", rotate: "6deg", height: 170 },
];

const templateVideos = [
  { poster: "/videos/posters/infinite-scroll-1.jpg", src: "/videos/infinite-scroll-1.mp4", label: "Testimonial", color: "bg-blue-50 text-blue-600" },
  { poster: "/videos/posters/infinite-scroll-2.jpg", src: "/videos/infinite-scroll-2.mp4", label: "Product Demo", color: "bg-amber-50 text-amber-700" },
  { poster: "/videos/posters/infinite-scroll-3.jpg", src: "/videos/infinite-scroll-3.mp4", label: "Unboxing", color: "bg-emerald-50 text-emerald-600" },
];

const platforms = [
  { emoji: "🎵", name: "TikTok" },
  { emoji: "📷", name: "Instagram" },
  { emoji: "▶️", name: "YouTube" },
  { emoji: "📘", name: "Meta Ads" },
];

function FeatureCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-300">
      <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-2">
        <h3 className="text-[15px] sm:text-base font-bold text-[#1A1A18] leading-snug mb-2">
          {title}
        </h3>
        <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{description}</p>
      </div>
      <div className="bg-[#F9F8F6] rounded-xl mx-3 sm:mx-4 mb-3 sm:mb-4 overflow-hidden border border-neutral-100/60">
        {children}
      </div>
    </div>
  );
}

export function ScaleFeatures() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-[960px] mx-auto px-6 sm:px-10">
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-2 bg-[#F0EDE8] rounded-md px-2.5 py-1 text-[11px] font-medium text-[#6B6B6B] font-sans mb-3">
            <Sparkles className="w-3 h-3" />
            What makes Mymo different
          </span>
          <h2 className="font-gelica text-3xl sm:text-4xl md:text-[42px] text-[#1A1A18] leading-[1.1]">
            Everything you need to <span className="italic font-semibold">scale ads</span>
          </h2>
          <p className="mt-3 text-sm text-[#8A8680] font-sans max-w-md mx-auto leading-relaxed">
            From script to screen in under 3 minutes. No creators, no editors, no delays.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <FeatureCard
            title="AI actors that sell for you"
            description="Pick from 100+ realistic AI presenters with natural lip sync and expressions. No casting calls, no schedules, no reshoot requests."
          >
            <div className="relative flex items-end justify-center gap-2.5 px-4 pb-0 pt-4 h-[220px]">
              {actorVideos.map((video) => (
                <div
                  key={video.src}
                  className="shrink-0 rounded-[14px] overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.15)]"
                  style={{ width: 82, height: video.height, transform: `rotate(${video.rotate})` }}
                >
                  <video
                    poster={video.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className="w-full h-full object-cover"
                  >
                    <source src={video.src} type="video/mp4" />
                  </video>
                </div>
              ))}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 shadow-md border border-neutral-100">
                <span className="text-[10px] font-semibold text-[#1A1A18]">AI Actor</span>
                <div className="w-6 h-3.5 rounded-full bg-[#C4501A] relative">
                  <div className="absolute right-[2px] top-[2px] w-2.5 h-2.5 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            title="Scripts that convert, written in seconds"
            description="Paste your product URL. AI instantly writes scroll-stopping hooks, scripts, and CTAs based on what works on TikTok, Meta, and Shorts."
          >
            <div className="relative h-[220px] px-4 pt-3 pb-0">
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden h-full">
                <div className="flex border-b border-neutral-100 px-3 pt-2">
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 border-b-2 text-[#C4501A] border-[#C4501A]">
                    Hook
                  </button>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 border-b-2 text-neutral-400 border-transparent">
                    Script
                  </button>
                  <button type="button" className="text-[10px] font-semibold px-3 py-1.5 border-b-2 text-neutral-400 border-transparent">
                    CTA
                  </button>
                  <div className="ml-auto flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#C4501A]" />
                    <span className="text-[9px] font-medium text-[#C4501A]">AI</span>
                  </div>
                </div>
                <div className="p-3 font-mono text-[11px] text-[#1A1A18] leading-relaxed whitespace-pre-wrap min-h-[140px]">
                  {`"You're still paying $500 per UGC video?"
Let me show you what AI can do in
30 seconds flat.

I just uploaded my product photo...`}
                </div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            title="Proven ad templates"
            description="Every template follows a Hook → Story → CTA framework, tested and optimized for conversions across TikTok, Reels, and Shorts."
          >
            <div className="relative h-[220px] px-4 pt-3 pb-0 overflow-hidden">
              <div className="flex gap-2.5 h-full">
                {templateVideos.map((video) => (
                  <div
                    key={video.src}
                    className="flex-1 rounded-xl overflow-hidden bg-neutral-100 relative group"
                  >
                    <video
                      poster={video.poster}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="none"
                      className="w-full h-full object-cover"
                    >
                      <source src={video.src} type="video/mp4" />
                    </video>
                    <div className="absolute bottom-2 left-2 right-2">
                      <span
                        className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-md ${video.color}`}
                      >
                        {video.label}
                      </span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                        <Play className="w-3.5 h-3.5 text-[#1A1A18] ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            title="Export to every platform, instantly"
            description="One video, every format. Optimized for TikTok, Instagram Reels, YouTube Shorts, and Meta — ready to post or run ads immediately."
          >
            <div className="relative h-[220px] px-4 pt-3 pb-0 flex gap-3">
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                {platforms.map((platform) => (
                  <div
                    key={platform.name}
                    className="flex items-center justify-between bg-white rounded-lg border border-neutral-100 px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{platform.emoji}</span>
                      <span className="text-[11px] font-semibold text-[#1A1A18]">
                        {platform.name}
                      </span>
                    </div>
                    <div className="w-7 h-4 rounded-full relative bg-[#C4501A]">
                      <div className="absolute top-[2px] left-[12px] w-3 h-3 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-[90px] shrink-0 flex flex-col items-center justify-end">
                <VideoPhone
                  poster="/videos/posters/gallery-1.jpg"
                  src="/videos/gallery-1.mp4"
                  className="w-full aspect-[9/16]"
                />
              </div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
