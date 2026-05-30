import { LandingCompare } from "@/components/landing-compare";
import { LandingFAQ } from "@/components/landing-faq";
import { LandingFinalCTA } from "@/components/landing-final-cta";
import { LandingHero } from "@/components/landing-hero";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNavbar } from "@/components/marketing-navbar";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Mymo",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Advertising",
      operatingSystem: "Web",
      url: "https://www.trymymo.com/",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "19",
        highPrice: "49",
        offerCount: "2",
        availability: "https://schema.org/InStock",
      },
      description:
        "Mymo generates AI UGC video ads and product videos for Shopify and DTC brands. 1000+ proven templates, 100+ AI actors, Meta-ready exports — add your product and export in 2 minutes.",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "147",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@type": "Organization",
      name: "Mymo",
      url: "https://www.trymymo.com/",
      logo: "https://www.trymymo.com/logo_original.jpeg",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How long does it take to generate one ad?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "About 2–3 minutes from picking a template to an export-ready video.",
          },
        },
        {
          "@type": "Question",
          name: "Can I customize the script and actor?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Every line is editable, and you can swap actors or adjust tone per scene.",
          },
        },
        {
          "@type": "Question",
          name: "What platforms do videos export to?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "TikTok, Instagram Reels, YouTube Shorts, and Meta Ads — with captions baked in.",
          },
        },
        {
          "@type": "Question",
          name: "How realistic do the AI actors look?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Viewers can't distinguish them from real creators in blind tests. Natural lip-sync, expressions, and body language.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a free trial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Our 7-day intro is $19 and includes 40 credits, 5 video downloads, and 5 B-roll generations. After 7 days it auto-renews at $49/month — cancel anytime.",
          },
        },
        {
          "@type": "Question",
          name: "Do I own the videos I create?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Every video is yours to use commercially. No royalties, no attribution, no extra fees.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use my own product footage?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Upload product photos or B-roll clips and we'll splice them into the AI-generated presenter segments.",
          },
        },
        {
          "@type": "Question",
          name: "Who's responsible for the output?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "All templates are AI-generated. The creator of the final video is responsible for reviewing and following platform policies.",
          },
        },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <MarketingNavbar />
      <div className="min-h-[calc(100vh-48px)]">
        <div className="min-h-screen bg-[var(--surface)]">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <LandingHero />
          <LandingCompare />
          <LandingFAQ />
          <LandingFinalCTA />
        </div>
      </div>
      <MarketingFooter />
    </>
  );
}
