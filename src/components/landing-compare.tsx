"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const notifications = [
  {
    icon: "/assets/shopify-logo-png-transparent.png",
    name: "Shopify",
    message: "Your store has a new order of 3 items totaling $128.75 from Online Store.",
  },
  {
    icon: "/assets/Meta-logo.png",
    name: "Meta Ads",
    message: "Your ad was scheduled for running",
  },
  {
    icon: "/assets/shopify-logo-png-transparent.png",
    name: "Shopify",
    message: "Your store has a new order of 1 item totaling $34.00 from Online Store.",
  },
  {
    icon: "/assets/shopify-logo-png-transparent.png",
    name: "Shopify",
    message: "Your store has a new order of 2 items totaling $70.49 from Online Store.",
  },
  {
    icon: "/assets/shopify-logo-png-transparent.png",
    name: "Shopify",
    message: "Your store has a new order of 5 items totaling $241.15 from Online Store.",
  },
  {
    icon: "/assets/Meta-logo.png",
    name: "Meta Ads",
    message: "Your ad was scheduled for running",
  },
];

function NotificationCard({
  icon,
  name,
  message,
}: {
  icon: string;
  name: string;
  message: string;
}) {
  return (
    <figure className="relative mx-auto w-full max-w-[380px] cursor-pointer overflow-hidden rounded-2xl bg-white p-4 transition-all duration-200 ease-in-out hover:scale-[103%] [box-shadow:0_0_0_1px_rgba(0,0,0,.04),0_2px_4px_rgba(0,0,0,.06),0_12px_24px_rgba(0,0,0,.06)]">
      <div className="flex flex-row items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl">
          <Image alt={name} src={icon} width={40} height={40} className="h-10 w-10 object-contain" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center">
            <span className="text-[15px] font-semibold text-[#0A0A0A]">{name}</span>
            <span className="mx-1 text-[#0A0A0A]/40">·</span>
            <span className="text-xs text-gray-500">just now</span>
          </figcaption>
          <p className="text-sm font-normal text-[#0A0A0A]/70 leading-snug">{message}</p>
        </div>
      </div>
    </figure>
  );
}

export function LandingCompare() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % notifications.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const visible = [
    notifications[index % notifications.length],
    notifications[(index + 1) % notifications.length],
    notifications[(index + 2) % notifications.length],
    notifications[(index + 3) % notifications.length],
  ];

  return (
    <section className="relative px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-gambarino text-center text-[40px] sm:text-[56px] md:text-[68px] leading-[0.95] tracking-[-0.04em] text-black mb-20 sm:mb-28">
          One gives anxiety.. one{" "}
          <span className="italic font-[family-name:var(--font-instrument-serif)] text-[color:var(--ember)]">
            prints
          </span>
          .
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="relative h-[480px]">
            <h3 className="font-inter-display text-[20px] sm:text-[22px] font-medium tracking-[-0.01em] text-center text-[#5A5A5A]">
              Without Mymo
            </h3>

            <div className="absolute top-[110px] left-2 sm:left-6 w-[260px] rounded-2xl bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)] -rotate-[7deg]">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100 overflow-hidden">
                  <Image
                    alt="Stripe"
                    src="/assets/Stripe-Emblem.png"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-[#0A0A0A]">Stripe</span>
                    <span className="text-[11px] text-gray-500">· 2h ago</span>
                  </div>
                  <p className="text-[13px] text-[#0A0A0A]/70 leading-tight">
                    $500 invoice paid to @creator_mia
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute top-[210px] right-2 sm:right-6 w-[290px] rounded-2xl bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)] rotate-[4deg]">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100 overflow-hidden">
                  <Image
                    alt="Slack"
                    src="/assets/Slack_icon_2019.svg.png"
                    width={26}
                    height={26}
                    className="h-[26px] w-[26px] object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-[#0A0A0A] truncate">
                      #marketing
                    </span>
                    <span className="text-[11px] text-gray-500 shrink-0">· 1h</span>
                  </div>
                  <p className="text-[13px] text-[#0A0A0A]/70 leading-tight">
                    hey we need more ads, should we plan a shooting?
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute top-[320px] left-4 sm:left-10 w-[280px] rounded-2xl bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)] -rotate-[5deg]">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
                    />
                    <path
                      fill="#34A853"
                      d="M5.455 4.639l6.545 4.91 6.545-4.91v7.092L12 16.64l-6.545-4.91z"
                    />
                    <path
                      fill="#EA4335"
                      d="M5.455 4.639L3.927 3.494C2.309 2.28 0 3.434 0 5.457v1.91l5.455 4.364z"
                    />
                    <path
                      fill="#FBBC04"
                      d="M18.545 4.639l1.528-1.145C21.69 2.28 24 3.434 24 5.457v1.91l-5.455 4.364z"
                    />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-[#0A0A0A] truncate">
                      mia@gmail.com
                    </span>
                    <span className="text-[11px] text-gray-500 shrink-0">· 4d</span>
                  </div>
                  <p className="text-[13px] text-[#0A0A0A]/70 leading-tight line-clamp-2">
                    hey sorry — I&apos;ll film that part next week 🙏
                  </p>
                </div>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[56px] leading-none select-none -rotate-[4deg]"
            >
              😭
            </div>
            <p
              aria-hidden="true"
              className="absolute bottom-4 left-1/2 translate-x-[44px] text-[22px] sm:text-[24px] leading-[1] text-[#1A1A1A] whitespace-nowrap -rotate-[6deg] pointer-events-none"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              “WTF am I doing?”
            </p>
          </div>

          <div className="relative h-[480px]">
            <h3 className="font-inter-display text-[20px] sm:text-[22px] font-medium tracking-[-0.01em] text-center text-[#5A5A5A]">
              With Mymo
            </h3>
            <div className="relative h-[380px] mt-12 overflow-hidden">
              <div className="flex flex-col items-center gap-4 transition-all duration-500">
                {visible.map((item, i) => (
                  <div
                    key={`${item.name}-${index}-${i}`}
                    className="mx-auto w-full transition-all duration-500"
                    style={{
                      opacity: i === 0 ? 1 : 1 - i * 0.05,
                      transform: `translateY(-${i * 4}px) scale(${1 - i * 0.02})`,
                    }}
                  >
                    <NotificationCard {...item} />
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/80 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
