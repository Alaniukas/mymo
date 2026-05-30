"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How does the $19 / 7-day intro work?",
    answer:
      "Pay $19 today and get 7 days of full access — 40 Spaces credits, 5 B-roll generations, and 5 video downloads. After the 7 days, your subscription automatically renews at the regular price of $49 per month and you receive the full monthly bundle (100 credits, 10 B-rolls, 10 downloads). You can cancel anytime during the 7 days from Settings → Billing to avoid the $49 charge.",
  },
  {
    question: "When and how will I be charged $49?",
    answer:
      "You're charged $19 immediately when you start the intro plan. Exactly 7 days later, your card is charged $49 and your subscription continues monthly at $49/month until you cancel. Stripe handles the transition automatically — there's nothing to confirm.",
  },
  {
    question: "Is there a money-back guarantee?",
    answer:
      "Yes! We offer a 14-day money-back guarantee on all plans. If you're not satisfied, contact us for a full refund — no questions asked.",
  },
  {
    question: "What if I want to cancel my subscription?",
    answer:
      "You can cancel anytime from your account settings. Your plan stays active until the end of your billing period. No penalties, no hidden fees. Cancelling during the 7-day intro window stops the $49 monthly charge from happening.",
  },
  {
    question: "How realistic do the AI actors look?",
    answer:
      "Our AI presenters use state-of-the-art video generation. They have natural expressions, lip sync, and body language. Most viewers can't distinguish them from real creators.",
  },
  {
    question: "Can I customize the script and presenter?",
    answer:
      "Absolutely. You can edit the AI-generated script, choose from multiple presenter styles, and adjust the tone to match your brand voice.",
  },
  {
    question: "What platforms are the videos optimized for?",
    answer:
      "Videos are created in 9:16 vertical format, perfect for TikTok, Instagram Reels, YouTube Shorts, and Facebook Stories.",
  },
  {
    question: "Do I own the videos I create?",
    answer:
      "Yes. All videos you create with Mymo are yours to use commercially. No licensing fees, no attribution required.",
  },
  {
    question: "Can I use my own product footage?",
    answer:
      "Yes. You can upload product photos and B-roll footage to incorporate into your videos alongside the AI-generated presenter segments.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Yes, you can switch plans at any time. Upgrades take effect immediately, and downgrades apply at your next billing cycle.",
  },
];

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-8">
      <h2 className="text-2xl font-gambarino font-medium text-neutral-900 text-center mb-10">
        Frequently Asked Questions
      </h2>
      <div>
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question} className="border-b border-neutral-100">
              <button
                type="button"
                className="w-full flex items-center justify-between py-4 text-left group"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-neutral-800 pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-neutral-400 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <p className="text-sm text-neutral-500 leading-relaxed pb-4">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
