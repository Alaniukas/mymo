"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Marquee } from "@/components/ui/marquee";

const videos = [
  { poster: "/videos/posters/infinite-scroll-1.jpg", src: "/videos/infinite-scroll-1.mp4" },
  { poster: "/videos/posters/infinite-scroll-2.jpg", src: "/videos/infinite-scroll-2.mp4" },
  { poster: "/videos/posters/infinite-scroll-3.jpg", src: "/videos/infinite-scroll-3.mp4" },
  { poster: "/videos/posters/Test1_b34b030d.jpg", src: "/videos/Test1_b34b030d.mp4" },
  { poster: "/videos/posters/Test1_b7df713f.jpg", src: "/videos/Test1_b7df713f.mp4" },
  { poster: "/videos/posters/Test1_fd46c377.jpg", src: "/videos/Test1_fd46c377.mp4" },
  { poster: "/videos/posters/coca_cola_150e474b.jpg", src: "/videos/coca_cola_150e474b.mp4" },
  {
    poster: "/videos/posters/lynxmonadas_winter_edition_c84a10a8.jpg",
    src: "/videos/lynxmonadas_winter_edition_c84a10a8.mp4",
  },
];

const underlineSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 14' preserveAspectRatio='none'%3E%3Cpath d='M3,8 Q20,2 38,7 Q56,12 78,6 Q98,3 122,8 Q142,11 162,5 Q182,4 197,7' stroke='%230A0A0A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E`;

function VideoCard({ poster, src }: { poster: string; src: string }) {
  return (
    <div className="relative aspect-[9/16] w-[120px] sm:w-[140px] md:w-[160px] shrink-0 overflow-hidden rounded-[10px] bg-[#0A0A0A] border-2 border-black shadow-[4px_4px_0_0_#000] sm:shadow-[5px_5px_0_0_#000] transition-[transform,box-shadow] duration-[225ms] ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] sm:hover:shadow-[3px_3px_0_0_#000]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={poster}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative isolate overflow-visible">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[420px] -z-10">
        <div
          className="absolute inset-0 bg-cover bg-top bg-no-repeat opacity-80"
          style={{
            backgroundImage: "url('/assets/landing/Background/background-example.jpg')",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 12%, transparent 65%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 12%, transparent 65%)",
          }}
        />
        <div className="absolute inset-0 bg-[var(--surface)] -z-10" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.22] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
            backgroundSize: "220px 220px",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 top-[80px] w-[min(1100px,98vw)] h-[280px] sm:h-[360px] md:h-[400px] -z-[5] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(252,252,252,0.97) 0%, rgba(252,252,252,0.85) 30%, rgba(252,252,252,0.5) 55%, rgba(252,252,252,0) 80%)",
        }}
      />

      <div
        className="relative mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10 text-center"
        style={{ maxWidth: 1280 }}
      >
        <h1 className="font-gambarino text-[48px] sm:text-[60px] md:text-[78px] leading-[0.9] tracking-[-0.06em] sm:tracking-[-0.08em] text-black">
          Get <span className="text-[color:var(--ember)]">1000+</span> UGC ads
          <br />
          and product videos{" "}
          <span
            className="italic font-[family-name:var(--font-instrument-serif)] text-[color:var(--ember)] bg-no-repeat box-decoration-clone pb-3"
            style={{
              backgroundImage: `url("${underlineSvg}")`,
              backgroundSize: "100% 0.5em",
              backgroundPosition: "left bottom 0.02em",
            }}
          >
            for just $19.
          </span>
        </h1>

        <p className="mt-5 sm:mt-6 mx-auto max-w-2xl text-[16px] sm:text-[20px] md:text-[22px] text-[#1C1C1C] font-medium leading-[1.5] tracking-[-0.4px] font-inter-display px-2">
          Add your product. Pick your winners.
          <br className="sm:hidden" /> Done in 2 minutes. Scale.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/checkout?type=intro"
            className="inline-flex items-center justify-center min-w-[260px] sm:min-w-[300px] px-8 sm:px-10 py-4 sm:py-5 rounded-[12px] bg-[var(--ember)] text-white text-xl sm:text-2xl font-bold uppercase tracking-wide border-2 border-black shadow-[5px_5px_0_0_#000] transition-[transform,box-shadow,opacity] duration-[225ms] ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_#000]"
          >
            Try for only $19
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center gap-1.5">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-emerald-500 text-emerald-500" />
              <span className="text-base sm:text-lg font-bold text-[#0A0A0A] tracking-tight">
                Trustpilot
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 sm:w-7 sm:h-7 bg-emerald-500 flex items-center justify-center"
                >
                  <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white text-white" />
                </div>
              ))}
            </div>
            <p className="text-xs sm:text-sm text-[#0A0A0A]/70">
              TrustScore <span className="font-semibold text-[#0A0A0A]">4.8</span> ·{" "}
              <span className="font-semibold text-[#0A0A0A]">147 reviews</span>
            </p>
          </div>
          <span className="text-sm italic text-[#0A0A0A]/70 font-medium">
            Join 1,000+ brands & creators
          </span>
        </div>

        <div className="relative w-screen left-1/2 -translate-x-1/2 mt-8">
          <div
            className="hidden md:flex pointer-events-none absolute z-10 left-1/2 -top-[95px] lg:-top-[105px] -translate-x-[320px] lg:-translate-x-[440px] flex-col items-start"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
            aria-hidden="true"
          >
            <p className="text-[24px] lg:text-[28px] leading-[1] text-[var(--ember)] whitespace-nowrap -rotate-[6deg]">
              I was done in 2 minutes
            </p>
            <svg
              viewBox="0 0 110 110"
              className="w-[78px] h-[78px] lg:w-[90px] lg:h-[90px] mt-1 ml-8 lg:ml-10 text-[var(--ember)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 12 8 C 2 48, 18 92, 86 96" />
              <path d="M 76 84 L 86 96 L 74 100" />
            </svg>
          </div>

          <div className="relative overflow-hidden">
            <Marquee pauseOnHover gap="0.75rem" className="py-4 sm:[--gap:1.25rem]">
              {videos.map((video) => (
                <VideoCard key={video.src} {...video} />
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-[var(--surface)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-[var(--surface)] to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
