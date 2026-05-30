import Link from "next/link";

export function StickyCTA() {
  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
      style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
    >
      <Link
        href="/checkout?type=intro"
        className="pointer-events-auto rounded-xl bg-[var(--primary)] text-white px-6 py-3 sm:px-10 sm:py-4 font-bold text-base sm:text-lg btn-3d"
      >
        Redeem 50% OFF
      </Link>
    </div>
  );
}
