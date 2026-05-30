// Niche-aware brand quiz.
//
// Each niche gets a short, mostly tap-to-answer questionnaire whose selections
// are turned into authoritative source text and run through the same
// brand-analysis LLM as the website crawl (see /api/brand-quiz). Keeping the
// question content here — separate from the modal UI — lets the copy evolve per
// niche without touching the component.

import type { NicheSlug } from "./niches";

export type QuizFieldType = "text" | "select" | "textarea";

export interface QuizQuestionDef {
  /** Stable key used for answer state (not sent to the LLM). */
  id: string;
  /** The question, also used as the label fed to the brand-analysis LLM. */
  prompt: string;
  type: QuizFieldType;
  /** Tap-to-select choices for `select` questions. */
  options?: string[];
  placeholder?: string;
  helper?: string;
}

/** One answered question, sent to the brand-quiz API as authoritative input. */
export interface QuizResponse {
  prompt: string;
  value: string;
}

// Tone is the one question that stays identical across every niche.
const TONE_QUESTION: QuizQuestionDef = {
  id: "tone",
  prompt: "How should your content sound?",
  type: "select",
  options: [
    "Bold & punchy",
    "Friendly & warm",
    "Professional & authoritative",
    "Playful & fun",
    "Inspirational",
  ],
};

// Optional free-text closer — the only spot for nuance the choices can't capture.
const NOTES_QUESTION: QuizQuestionDef = {
  id: "notes",
  prompt: "Anything else we should know?",
  type: "textarea",
  placeholder:
    "Your story, what makes you different, key features, customer wins, your main call-to-action…",
  helper: "Optional — the more you share, the richer your brand identity.",
};

const NICHE_QUIZZES: Record<NicheSlug, QuizQuestionDef[]> = {
  ecomm: [
    {
      id: "brandName",
      prompt: "What's your brand or product called?",
      type: "text",
      placeholder: "e.g. Lunar Skincare",
    },
    {
      id: "category",
      prompt: "What do you sell?",
      type: "select",
      options: [
        "Apparel & accessories",
        "Beauty & skincare",
        "Health & supplements",
        "Home & lifestyle",
        "Food & beverage",
        "Electronics & gadgets",
      ],
    },
    {
      id: "audience",
      prompt: "Who are your customers?",
      type: "select",
      options: [
        "Gen Z shoppers",
        "Millennials",
        "Parents & families",
        "Fitness & wellness fans",
        "Luxury buyers",
        "Budget-conscious shoppers",
      ],
    },
    TONE_QUESTION,
    {
      id: "goal",
      prompt: "What's the #1 goal for your content?",
      type: "select",
      options: [
        "Drive sales",
        "Launch a new product",
        "Promote an offer or sale",
        "Build brand awareness",
      ],
    },
    NOTES_QUESTION,
  ],

  app: [
    {
      id: "brandName",
      prompt: "What's your product called?",
      type: "text",
      placeholder: "e.g. Tutlio",
    },
    {
      id: "category",
      prompt: "What kind of product is it?",
      type: "select",
      options: [
        "Productivity",
        "AI tool",
        "Finance",
        "Health & fitness",
        "Education",
        "Social",
        "Developer tool",
      ],
    },
    {
      id: "audience",
      prompt: "Who's it for?",
      type: "select",
      options: [
        "Founders & entrepreneurs",
        "Busy professionals",
        "Students",
        "Developers",
        "Small business owners",
        "Creators",
      ],
    },
    TONE_QUESTION,
    {
      id: "goal",
      prompt: "What's the #1 goal for your content?",
      type: "select",
      options: [
        "Drive sign-ups",
        "Showcase a feature",
        "Educate users",
        "Build awareness",
      ],
    },
    NOTES_QUESTION,
  ],

  personal_brand: [
    {
      id: "brandName",
      prompt: "What's your name or handle?",
      type: "text",
      placeholder: "e.g. Alex Rivera / @alexbuilds",
    },
    {
      id: "topic",
      prompt: "What's your content about?",
      type: "select",
      options: [
        "Business & entrepreneurship",
        "Fitness & health",
        "Finance & investing",
        "Marketing & content",
        "Tech & coding",
        "Mindset & productivity",
      ],
    },
    {
      id: "audience",
      prompt: "Who's your audience?",
      type: "select",
      options: [
        "Aspiring entrepreneurs",
        "Other creators",
        "Professionals leveling up",
        "Beginners in my niche",
        "Fellow enthusiasts",
      ],
    },
    TONE_QUESTION,
    {
      id: "goal",
      prompt: "What's the #1 goal for your content?",
      type: "select",
      options: [
        "Grow my following",
        "Build authority",
        "Sell my offer",
        "Drive engagement",
      ],
    },
    NOTES_QUESTION,
  ],

  viral: [
    {
      id: "brandName",
      prompt: "What's your brand or handle called?",
      type: "text",
      placeholder: "e.g. @dailyfacts",
    },
    {
      id: "topic",
      prompt: "What's your content about?",
      type: "select",
      options: [
        "Entertainment",
        "Education",
        "Lifestyle",
        "Tech",
        "Money",
        "Humor & relatable",
      ],
    },
    {
      id: "audience",
      prompt: "Who are you trying to reach?",
      type: "select",
      options: [
        "Gen Z",
        "Millennials",
        "General audience",
        "Niche enthusiasts",
      ],
    },
    TONE_QUESTION,
    {
      id: "goal",
      prompt: "What's the #1 goal for your content?",
      type: "select",
      options: [
        "Maximize shares",
        "Get saves",
        "Spark comments",
        "Grow followers",
      ],
    },
    NOTES_QUESTION,
  ],
};

/**
 * Returns the quiz for a niche. Falls back to the app/SaaS set when no niche is
 * selected (the quiz is gated on a niche in the UI, so this is just a safety net).
 */
export function quizForNiche(niche: NicheSlug | null): QuizQuestionDef[] {
  return (niche && NICHE_QUIZZES[niche]) || NICHE_QUIZZES.app;
}
