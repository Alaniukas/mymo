"use client";

import { useEffect, useState } from "react";

function getTimeLeft() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end.getTime() - now.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds };
}

export function LaunchBanner() {
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="w-full py-3 px-4"
        style={{
          background:
            "linear-gradient(135deg, rgb(235, 81, 43) 0%, rgb(212, 72, 29) 50%, rgb(192, 62, 21) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-white">
          <span className="text-sm sm:text-base font-semibold tracking-wide">
            Launch Sale 50% OFF
          </span>
          <span className="text-white/40 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-bold tabular-nums">
            <span className="bg-white/15 backdrop-blur-sm rounded-md px-2 py-0.5 min-w-[2.2rem] text-center">
              {pad(time.hours)}h
            </span>
            <span className="bg-white/15 backdrop-blur-sm rounded-md px-2 py-0.5 min-w-[2.2rem] text-center">
              {pad(time.minutes)}m
            </span>
            <span className="bg-white/15 backdrop-blur-sm rounded-md px-2 py-0.5 min-w-[2.2rem] text-center">
              {pad(time.seconds)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
