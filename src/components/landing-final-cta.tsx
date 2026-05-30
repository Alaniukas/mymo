import Link from "next/link";

export function LandingFinalCTA() {
  return (
    <section className="relative isolate overflow-hidden py-16 sm:py-24 lg:py-32">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{
            backgroundImage: "url('/assets/landing/Background/background-example.jpg')",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
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
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,95vw)] h-[360px] -z-[5] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(252,252,252,0.9) 0%, rgba(252,252,252,0.55) 40%, rgba(252,252,252,0) 75%)",
        }}
      />

      <div className="relative mx-auto max-w-[1000px] px-4 sm:px-6 text-center">
        <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.2em] text-[#C4501A] mb-3">
          Ready?
        </p>
        <h2 className="font-gambarino text-[44px] sm:text-[72px] md:text-[90px] leading-[0.9] tracking-[-0.06em] sm:tracking-[-0.08em] text-black">
          Your next winning ad{" "}
          <span className="italic font-[family-name:var(--font-instrument-serif)] text-[color:var(--ember)]">
            is 2 minutes away
          </span>
        </h2>
        <p className="mt-5 sm:mt-6 mx-auto max-w-xl text-[15px] sm:text-[18px] md:text-[20px] text-[#1C1C1C]/75 leading-[1.5]">
          Pick a template. Drop in your product. Watch it come to life.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-5">
          <Link
            href="/checkout?type=intro"
            className="inline-flex items-center px-6 py-3 rounded-[10px] bg-[var(--ember)] text-white text-base font-bold uppercase tracking-wide border-2 border-black shadow-[4px_4px_0_0_#000] transition-[transform,box-shadow] duration-[225ms] ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_#000]"
          >
            Try for only $19
          </Link>
          <div className="flex items-center gap-2 text-[13px] text-[#0A0A0A]/60">
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E8C1A0] to-[#B88761] border-2 border-[var(--surface)]" />
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C89F8E] to-[#8B5A3C] border-2 border-[var(--surface)]" />
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#A89B92] to-[#5C4E44] border-2 border-[var(--surface)]" />
            </div>
            <span>350+ brands already shipping</span>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 flex justify-center">
          <div
            className="pointer-events-none flex flex-col items-start"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
            aria-hidden="true"
          >
            <p
              className="text-[22px] lg:text-[26px] leading-[1] whitespace-nowrap"
              style={{ color: "var(--ember)", transform: "rotate(3deg)" }}
            >
              no contract, cancel anytime
            </p>
            <svg
              viewBox="0 0 110 110"
              className="w-[76px] h-[76px] mt-1"
              fill="none"
              stroke="var(--ember)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 98 102 C 108 62, 92 18, 24 14" />
              <path d="M 34 26 L 24 14 L 36 10" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
