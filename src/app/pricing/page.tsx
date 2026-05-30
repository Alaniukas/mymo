import type { Metadata } from "next";
import { IntroCard } from "@/components/pricing/intro-card";
import { LaunchBanner } from "@/components/pricing/launch-banner";
import { PricingFAQ } from "@/components/pricing/pricing-faq";
import { PricingFinalCTA } from "@/components/pricing/pricing-final-cta";
import { ScaleFeatures } from "@/components/pricing/scale-features";
import { StickyCTA } from "@/components/pricing/sticky-cta";
import { TestimonialsWall } from "@/components/pricing/testimonials-wall";
import { TrustSection } from "@/components/pricing/trust-section";
import { PricingVideoMarquee } from "@/components/pricing/video-marquee";

export const metadata: Metadata = {
  title: "Mymo Pricing — AI UGC Ads from $19 · 14-Day Guarantee",
  description:
    "Try Mymo for $19 — 1000+ UGC ad templates, 100+ AI actors, product videos, and Meta-ready exports. Then $49/month. Cancel anytime. 14-day money-back guarantee.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Mymo Pricing — AI UGC Ads from $19",
    description:
      "Try Mymo for $19 — 1000+ UGC ad templates, AI actors, product videos. Then $49/month. Cancel anytime.",
  },
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Mymo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "19",
        highPrice: "49",
        offerCount: "2",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How does the $19 / 7-day intro work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Pay $19 today for 7 days of full access. After 7 days, renews at $49/month unless cancelled.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a money-back guarantee?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes — 14-day money-back guarantee on all plans.",
          },
        },
      ],
    },
  ],
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)] pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <LaunchBanner />
      <IntroCard />
      <ScaleFeatures />
      <PricingVideoMarquee />
      <TestimonialsWall />
      <TrustSection />
      <PricingFAQ />
      <PricingFinalCTA />
      <StickyCTA />
    </div>
  );
}
