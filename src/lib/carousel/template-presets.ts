// Starter template presets + niche presentation metadata.
//
// Presets are curated carousel layouts shown on the Templates page. Selecting
// one materializes a real `carousel_templates` row (via /api/templates/from-preset)
// so studio generation has slide images to replicate.

import { NICHES, type NicheSlug } from "./niches";

/** Presentation metadata for the four niche cards on the Templates page. */
export interface NicheMeta {
  slug: NicheSlug;
  label: string;
  tagline: string;
  /** Tailwind gradient classes for the niche card + preset thumbnails. */
  gradient: string;
}

export const NICHE_META: Record<NicheSlug, NicheMeta> = {
  ecomm: {
    slug: "ecomm",
    label: "Ecomm",
    tagline: "Product drops, offers & social proof for DTC stores.",
    gradient: "from-orange-400 to-rose-500",
  },
  app: {
    slug: "app",
    label: "App",
    tagline: "Feature spotlights and walkthroughs for SaaS & apps.",
    gradient: "from-sky-400 to-indigo-500",
  },
  personal_brand: {
    slug: "personal_brand",
    label: "Personal Brand",
    tagline: "Story, lessons & hot takes that build an audience.",
    gradient: "from-violet-400 to-fuchsia-500",
  },
  viral: {
    slug: "viral",
    label: "Viral",
    tagline: "Hook-driven, highly shareable scroll-stoppers.",
    gradient: "from-emerald-400 to-teal-500",
  },
};

/** Ordered niche metadata, aligned to the canonical niche taxonomy. */
export const NICHE_CARDS: NicheMeta[] = NICHES.map((n) => NICHE_META[n.slug]);

export interface TemplatePreset {
  /** Stable slug used in URLs and selection state. */
  id: string;
  niche: NicheSlug;
  title: string;
  description: string;
  slideCount: number;
  /** Topic seeded into the Create flow when this preset is applied. */
  starterTopic: string;
  /** Optional image thumbnail served from /public; falls back to a gradient. */
  thumbnail?: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ── Ecomm ──
  {
    id: "ecomm-product-drop",
    niche: "ecomm",
    title: "Product Drop",
    description: "Build hype for a brand-new product launch.",
    slideCount: 5,
    starterTopic:
      "A 5-slide product launch carousel that builds hype for a new product — a bold hook, three standout features, and a strong call-to-action to shop now.",
  },
  {
    id: "ecomm-before-after",
    niche: "ecomm",
    title: "Before / After",
    description: "Show the transformation your product delivers.",
    slideCount: 4,
    starterTopic:
      "A 4-slide before/after carousel showing the transformation customers get from the product, ending with a call-to-action to buy.",
  },
  {
    id: "ecomm-three-reasons",
    niche: "ecomm",
    title: "3 Reasons to Buy",
    description: "Benefit-driven listicle that converts browsers.",
    slideCount: 5,
    starterTopic:
      "A 5-slide listicle carousel covering the top three reasons to buy the product, each slide a clear benefit, ending with an offer.",
  },
  {
    id: "ecomm-bestseller",
    niche: "ecomm",
    title: "Bestseller Showcase",
    description: "Hero your top product with social proof.",
    slideCount: 5,
    starterTopic:
      "A 5-slide bestseller showcase carousel featuring the hero product, customer reviews and social proof, ending with a shop-now CTA.",
  },
  {
    id: "ecomm-bundle-save",
    niche: "ecomm",
    title: "Bundle & Save",
    description: "Promote a bundle or limited-time offer.",
    slideCount: 6,
    starterTopic:
      "A 6-slide carousel promoting a money-saving product bundle or limited-time offer, building urgency and ending with a clear CTA.",
  },

  // ── App ──
  {
    id: "app-feature-spotlight",
    niche: "app",
    title: "Feature Spotlight",
    description: "Put one killer feature center stage.",
    slideCount: 5,
    starterTopic:
      "A 5-slide carousel spotlighting one standout app feature — what it does, why it matters, and a CTA to try it.",
  },
  {
    id: "app-how-it-works",
    niche: "app",
    title: "How It Works",
    description: "A simple step-by-step product walkthrough.",
    slideCount: 6,
    starterTopic:
      "A 6-slide step-by-step walkthrough carousel explaining how the app works, one clear step per slide, ending with a sign-up CTA.",
  },
  {
    id: "app-problem-solution",
    niche: "app",
    title: "Problem → Solution",
    description: "Name the pain, then solve it.",
    slideCount: 5,
    starterTopic:
      "A 5-slide problem-to-solution carousel that names a painful problem the audience has and shows how the app solves it.",
  },
  {
    id: "app-old-way-new-way",
    niche: "app",
    title: "Old Way vs New Way",
    description: "Contrast the messy old workflow with yours.",
    slideCount: 4,
    starterTopic:
      "A 4-slide carousel contrasting the messy old way of doing things with the streamlined new way using the app.",
  },
  {
    id: "app-quick-tips",
    niche: "app",
    title: "Quick-Start Tips",
    description: "Help new users get value fast.",
    slideCount: 5,
    starterTopic:
      "A 5-slide carousel of quick-start tips that help new users get value from the app in their first few minutes.",
  },

  // ── Personal Brand ──
  {
    id: "pb-build-systems",
    niche: "personal_brand",
    title: "Build Systems Before Scaling",
    description: "Authority-building systems & organization advice.",
    slideCount: 7,
    starterTopic:
      "A 7-slide personal-brand carousel on building business systems before scaling — a strong cover hook, then practical slides on creating repeatable workflows, simplifying your offers, documenting everything in step-by-step guides, tracking the metrics that matter, ending with a save-this call-to-action.",
    thumbnail: "/templates/personal-brand/personal1.jpg",
  },
  {
    id: "pb-my-story",
    niche: "personal_brand",
    title: "My Story",
    description: "An origin story that builds connection.",
    slideCount: 5,
    starterTopic:
      "A 5-slide personal-story carousel sharing a founder/creator origin story that builds trust and connection with the audience.",
  },
  {
    id: "pb-lessons-learned",
    niche: "personal_brand",
    title: "5 Lessons Learned",
    description: "Hard-won insights as a listicle.",
    slideCount: 5,
    starterTopic:
      "A 5-slide listicle carousel sharing five hard-won lessons learned, one insight per slide, ending with a reflective takeaway.",
  },
  {
    id: "pb-day-in-life",
    niche: "personal_brand",
    title: "Day in the Life",
    description: "Behind-the-scenes that humanizes you.",
    slideCount: 6,
    starterTopic:
      "A 6-slide behind-the-scenes 'day in the life' carousel that humanizes the creator and pulls the audience into their world.",
  },
  {
    id: "pb-myth-vs-reality",
    niche: "personal_brand",
    title: "Myth vs Reality",
    description: "Bust a common myth in your space.",
    slideCount: 4,
    starterTopic:
      "A 4-slide myth-vs-reality carousel that busts a common misconception in the creator's niche with a confident point of view.",
  },
  {
    id: "pb-hot-take",
    niche: "personal_brand",
    title: "Hot Take",
    description: "A bold opinion with the reasoning behind it.",
    slideCount: 5,
    starterTopic:
      "A 5-slide 'hot take' carousel that opens with a bold opinion and backs it up with sharp reasoning, inviting discussion.",
  },

  // ── Viral ──
  {
    id: "viral-hook-reveal",
    niche: "viral",
    title: "Hook & Reveal",
    description: "A strong hook with a payoff at the end.",
    slideCount: 5,
    starterTopic:
      "A 5-slide carousel built on a scroll-stopping hook in slide one, building curiosity through the middle, and a satisfying reveal at the end.",
  },
  {
    id: "viral-top-five",
    niche: "viral",
    title: "Top 5 Listicle",
    description: "Numbered, rapid-fire and snackable.",
    slideCount: 5,
    starterTopic:
      "A 5-slide rapid-fire 'Top 5' listicle carousel, one numbered item per slide, designed to be saved and shared.",
  },
  {
    id: "viral-did-you-know",
    niche: "viral",
    title: "Did You Know?",
    description: "Surprising facts that beg a share.",
    slideCount: 5,
    starterTopic:
      "A 5-slide 'did you know?' carousel packed with surprising, share-worthy facts that pay off the opening hook.",
  },
  {
    id: "viral-this-or-that",
    niche: "viral",
    title: "This or That",
    description: "A comparison that sparks comments.",
    slideCount: 4,
    starterTopic:
      "A 4-slide 'this or that' comparison carousel that pits two options against each other and invites the audience to pick a side.",
  },
  {
    id: "viral-save-this",
    niche: "viral",
    title: "Save This",
    description: "A how-to so useful people bookmark it.",
    slideCount: 6,
    starterTopic:
      "A 6-slide highly useful how-to carousel designed to be saved and shared, with a clear actionable step on each slide.",
  },
];

/** Presets for a given niche, in definition order. */
export function presetsForNiche(niche: NicheSlug): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter((p) => p.niche === niche);
}

export function getPreset(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((p) => p.id === id);
}
