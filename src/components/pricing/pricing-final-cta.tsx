import Link from "next/link";
import { VideoPhone } from "@/components/pricing/video-phone";

const benefits = [
  "10x cheaper than creators",
  "20 min from idea to ad",
  "40% average ROAS lift",
];

const fanVideos = [
  {
    poster: "/videos/posters/landing-compare-1.jpg",
    src: "/videos/landing-compare-1.mp4",
    rotate: "-6deg",
    desktop: { w: 130, h: 220, mb: 40 },
    mobile: { w: 85, h: 150, mb: 20 },
    show: "always",
  },
  {
    poster: "/videos/posters/infinite-scroll-1.jpg",
    src: "/videos/infinite-scroll-1.mp4",
    rotate: "3deg",
    desktop: { w: 155, h: 300, mb: -10 },
    mobile: { w: 100, h: 200, mb: -5 },
    show: "always",
  },
  {
    poster: "/videos/posters/landing-compare-2.jpg",
    src: "/videos/landing-compare-2.mp4",
    rotate: "-2deg",
    desktop: { w: 140, h: 250, mb: 20 },
    mobile: { w: 90, h: 170, mb: 10 },
    show: "always",
  },
  {
    poster: "/videos/posters/infinite-scroll-2.jpg",
    src: "/videos/infinite-scroll-2.mp4",
    rotate: "0deg",
    desktop: { w: 170, h: 320, mb: -20 },
    mobile: { w: 85, h: 150, mb: 20 },
    show: "sm",
  },
  {
    poster: "/videos/posters/landing-compare-3.jpg",
    src: "/videos/landing-compare-3.mp4",
    rotate: "4deg",
    desktop: { w: 135, h: 240, mb: 30 },
    mobile: { w: 0, h: 0, mb: 0 },
    show: "md",
  },
  {
    poster: "/videos/posters/infinite-scroll-3.jpg",
    src: "/videos/infinite-scroll-3.mp4",
    rotate: "-4deg",
    desktop: { w: 150, h: 280, mb: 0 },
    mobile: { w: 0, h: 0, mb: 0 },
    show: "lg",
  },
  {
    poster: "/videos/posters/gallery-1.jpg",
    src: "/videos/gallery-1.mp4",
    rotate: "5deg",
    desktop: { w: 125, h: 210, mb: 50 },
    mobile: { w: 0, h: 0, mb: 0 },
    show: "lg",
  },
];

const showClass: Record<string, string> = {
  always: "",
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
};

export function PricingFinalCTA() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20">
      <div
        className="relative rounded-3xl border border-neutral-200 overflow-hidden shadow-sm"
        style={{
          background: "linear-gradient(rgb(255, 255, 255) 0%, rgb(252, 252, 252) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(235, 81, 43) 1.5px, transparent 1.5px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative text-center px-5 sm:px-16 pt-14 sm:pt-24 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] font-semibold text-[#eb512b] mb-5">
            Start today
          </p>
          <h2 className="font-gambarino font-medium text-3xl sm:text-[3.25rem] text-neutral-900 leading-[1.1] tracking-tight">
            Your next winning ad
            <br />
            is 20 minutes away.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-neutral-700 max-w-md mx-auto leading-relaxed">
            Join thousands of brands creating scroll-stopping UGC ads with AI.
          </p>

          <Link
            href="/checkout?type=intro"
            className="mt-10 inline-flex items-center gap-3 sm:gap-3.5 rounded-xl bg-[var(--primary)] text-white px-4 sm:px-4.5 py-2.5 sm:py-3 btn-3d"
          >
            <span className="font-bold text-base sm:text-lg tracking-[-0.01em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              Get Started Now
            </span>
            <span className="inline-flex items-center rounded-[9px] bg-white/15 backdrop-blur-sm border border-white/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15),0_1px_0_rgba(255,255,255,0.1)] px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
              get 50% off
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#eb512b] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-neutral-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 sm:mt-14 pb-0 overflow-hidden h-[220px] sm:h-[340px]">
          <div className="flex justify-center items-end gap-4 sm:gap-6 px-4 sm:px-8">
            {fanVideos.map((video) => (
              <div
                key={video.src}
                className={`rounded-[10px] overflow-hidden bg-[#0A0A0A] phone-shadow shrink-0 relative ${showClass[video.show]}`}
                style={{ transform: `rotate(${video.rotate})` }}
              >
                <div
                  className="hidden sm:block"
                  style={{
                    width: video.desktop.w,
                    height: video.desktop.h,
                    marginBottom: video.desktop.mb,
                  }}
                >
                  <VideoPhone poster={video.poster} src={video.src} className="w-full h-full" />
                </div>
                {video.mobile.w > 0 && (
                  <div
                    className="sm:hidden"
                    style={{
                      width: video.mobile.w,
                      height: video.mobile.h,
                      marginBottom: video.mobile.mb,
                    }}
                  >
                    <VideoPhone poster={video.poster} src={video.src} className="w-full h-full" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FCFCFC] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#FCFCFC]/80 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FCFCFC]/80 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
