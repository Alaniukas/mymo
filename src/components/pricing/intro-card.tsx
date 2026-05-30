import Link from "next/link";
import { Logo } from "@/components/logo";
import { VideoPhone } from "@/components/pricing/video-phone";

const features = [
  {
    emoji: "🎬",
    title: "Done-for-you video ads",
    description:
      "Generate scroll-stopping UGC ads on demand, fully branded and ready to launch.",
  },
  {
    emoji: "🧑‍🎤",
    title: "100s of realistic AI presenters",
    description:
      "Natural lip sync, expressions, and body language that viewers can't distinguish from real creators.",
  },
  {
    emoji: "✍️",
    title: "AI-powered converting scripts",
    description:
      "Based on what actually works on TikTok, Meta, and YouTube Shorts.",
  },
  {
    emoji: "📦",
    title: "Works with your products",
    description:
      "Upload your product photos and footage. Mymo combines them seamlessly with AI presenters.",
  },
];

const previewVideos = [
  { poster: "/videos/posters/landing-compare-1.jpg", src: "/videos/landing-compare-1.mp4" },
  { poster: "/videos/posters/infinite-scroll-1.jpg", src: "/videos/infinite-scroll-1.mp4" },
  { poster: "/videos/posters/landing-compare-2.jpg", src: "/videos/landing-compare-2.mp4" },
  { poster: "/videos/posters/infinite-scroll-2.jpg", src: "/videos/infinite-scroll-2.mp4", hidden: "sm" },
  { poster: "/videos/posters/landing-compare-3.jpg", src: "/videos/landing-compare-3.mp4", hidden: "sm" },
];

export function IntroCard() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-10">
      <div className="relative rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 sm:px-14 pt-8 sm:pt-12 pb-8">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <Logo className="h-8 w-8 sm:h-9 sm:w-9 text-neutral-900" />
            <span className="font-gambarino font-bold text-2xl sm:text-3xl text-neutral-900">
              Mymo
            </span>
          </div>
          <p className="text-neutral-500 text-base sm:text-lg mb-1 font-sans">Try it for</p>
          <p className="font-sans font-bold text-4xl sm:text-5xl text-neutral-900">
            $19 / 7 days
          </p>
          <p className="text-neutral-500 text-sm sm:text-base mt-2 font-sans">
            Then $49/month — cancel anytime
          </p>
        </div>

        <div className="px-6 sm:px-14 pb-12 sm:pb-14 relative">
          <div className="flex gap-5 overflow-hidden">
            {previewVideos.map((video) => (
              <VideoPhone
                key={video.src}
                poster={video.poster}
                src={video.src}
                className={`w-[90px] h-[160px] sm:w-[120px] sm:h-[213px] ${video.hidden === "sm" ? "hidden sm:block" : ""}`}
              />
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>

        <div className="border-t border-dashed border-neutral-200" />

        <div className="px-6 sm:px-14 py-8 sm:py-10 space-y-6 sm:space-y-8">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-5">
              <span className="text-2xl shrink-0 mt-0.5">{feature.emoji}</span>
              <div>
                <p className="text-lg font-semibold text-neutral-900">{feature.title}</p>
                <p className="text-base text-neutral-500 mt-1 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 sm:px-14 pb-8 sm:pb-10">
          <Link
            href="/checkout?type=intro"
            className="flex w-full items-center justify-center rounded-xl bg-[var(--primary)] text-white py-4 text-lg font-bold btn-3d"
          >
            Start for $19
          </Link>
        </div>
      </div>
    </div>
  );
}
