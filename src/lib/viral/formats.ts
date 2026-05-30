export type ViralGoal = "awareness" | "product" | "followers" | "engagement";

export interface MemeFormat {
  id: string;
  title: string;
  description: string;
  /** How the meme text is structured on slides. */
  structure: "single_punchline" | "setup_punchline" | "hot_take_list" | "before_after";
  slideCount: number;
  hookStyle: string;
}

export const MEME_FORMATS: MemeFormat[] = [
  {
    id: "pov_relate",
    title: "POV / Relatable",
    description: "POV hook → relatable pain → product as cheat code",
    structure: "setup_punchline",
    slideCount: 4,
    hookStyle: "POV: you're [audience] and...",
  },
  {
    id: "hot_take",
    title: "Hot Take",
    description: "Bold opinion → proof → CTA",
    structure: "hot_take_list",
    slideCount: 5,
    hookStyle: "Unpopular opinion:",
  },
  {
    id: "before_after_meme",
    title: "Before / After",
    description: "Chaos before → calm after (with your product)",
    structure: "before_after",
    slideCount: 4,
    hookStyle: "Me before vs after",
  },
  {
    id: "one_liner",
    title: "One-liner Stack",
    description: "3 viral one-liners + product slide",
    structure: "single_punchline",
    slideCount: 4,
    hookStyle: "Things that shouldn't work but do:",
  },
  {
    id: "meme_listicle",
    title: "Meme Listicle",
    description: "Numbered meme hooks that build to your offer",
    structure: "hot_take_list",
    slideCount: 6,
    hookStyle: "5 signs you need to...",
  },
];

export function getMemeFormat(id: string): MemeFormat | undefined {
  return MEME_FORMATS.find((f) => f.id === id);
}
