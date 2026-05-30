export type BrandStoryGoal =
  | "story"
  | "launch"
  | "event"
  | "recap"
  | "educate";

export interface BrandStorySlidePlan {
  position: number;
  role: "hook" | "value" | "cta";
  /** On-slide headline/body (burned at finalize). */
  caption: string;
  /** Background image brief for AI generation. */
  visualBrief: string;
  layout: "fullbleed_dark_overlay" | "editorial_split" | "text_only";
  textPlacement: "top" | "center" | "bottom" | "card";
  textStyle: "headline" | "body" | "list" | "cta";
  textAlignment: "left" | "center" | "right";
  /** Prefer a user-uploaded photo for this slide when available. */
  useUserPhoto: boolean;
}

export interface BrandStoryPlan {
  title: string;
  postCaption: string;
  hashtags: string[];
  visualTheme: string;
  slides: BrandStorySlidePlan[];
}

/** Text-only solid slides vs AI-generated story imagery. */
export type StoryCarouselMediaMode = "text_only" | "with_images";

/** Narrative playbook for serial follower-growth carousels. */
export type StoryNarrativeAngle = "follower_growth" | "brand_experience";

export interface StoryCarouselSlidePlan {
  position: number;
  role: "hook" | "value" | "cta";
  caption: string;
  visualBrief: string;
  layout: "fullbleed_dark_overlay" | "text_only";
  textPlacement: "top" | "center" | "bottom" | "card";
  textStyle: "headline" | "body" | "list" | "cta";
  textAlignment: "left" | "center" | "right";
  /** Solid slide fill for text_only mode (#000000, #FFFFFF, #F5F5F0). */
  backgroundColor: string;
  /** Caption ink color — must contrast with backgroundColor. */
  textColor: string;
}

export interface StoryCarouselPlan {
  title: string;
  postCaption: string;
  hashtags: string[];
  /** Shared visual thread when mediaMode=with_images. */
  visualTheme: string;
  /** One-line story arc for continuity across slides. */
  storyLine: string;
  slides: StoryCarouselSlidePlan[];
}
