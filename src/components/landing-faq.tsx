"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "How long does it take to generate one ad?",
    answer:
      "About 2–3 minutes from picking a template to an export-ready video.",
  },
  {
    question: "Can I customize the script and actor?",
    answer:
      "Yes. Every line is editable, and you can swap actors or adjust tone per scene.",
  },
  {
    question: "What platforms do videos export to?",
    answer:
      "TikTok, Instagram Reels, YouTube Shorts, and Meta Ads — with captions baked in.",
  },
  {
    question: "How realistic do the AI actors look?",
    answer:
      "Viewers can't distinguish them from real creators in blind tests. Natural lip-sync, expressions, and body language.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Our 7-day intro is $19 and includes 40 credits, 5 video downloads, and 5 B-roll generations. After 7 days it auto-renews at $49/month — cancel anytime.",
  },
  {
    question: "Do I own the videos I create?",
    answer:
      "Yes. Every video is yours to use commercially. No royalties, no attribution, no extra fees.",
  },
  {
    question: "Can I use my own product footage?",
    answer:
      "Yes. Upload product photos or B-roll clips and we'll splice them into the AI-generated presenter segments.",
  },
  {
    question: "Who's responsible for the output?",
    answer:
      "All templates are AI-generated. The creator of the final video is responsible for reviewing and following platform policies.",
  },
];

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative bg-[var(--surface)] py-14 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-[760px] px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.2em] text-[#C4501A] mb-3">
            FAQ
          </p>
          <h2 className="font-gambarino text-[40px] sm:text-[56px] md:text-[64px] leading-[0.95] tracking-[-0.05em] text-black">
            Questions,{" "}
            <span className="italic font-[family-name:var(--font-instrument-serif)] text-[color:var(--ember)]">
              answered
            </span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="rounded-2xl border transition-colors bg-[#FAFAF9] border-transparent hover:bg-white hover:border-black/5"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-4 p-5 sm:p-6 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="flex-1 font-gambarino text-[18px] sm:text-[22px] leading-[1.2] tracking-[-0.02em] text-black">
                    {faq.question}
                  </span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#F2F0ED] text-[#3C2E25]">
                    {isOpen ? (
                      <Minus className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-2">
                    <p className="text-[15px] sm:text-[16px] text-[#1C1C1C]/75 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
