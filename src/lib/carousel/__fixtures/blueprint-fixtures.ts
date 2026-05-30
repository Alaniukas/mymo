import type {
  TemplateBlueprint,
  TemplateSlideBlueprint,
} from "../template-blueprint";

export function makeSlideBlueprint(
  overrides: Partial<TemplateSlideBlueprint> & { position: number },
): TemplateSlideBlueprint {
  const { position, role, ...rest } = overrides;
  const inferredRole =
    role ?? (position === 1 ? "hook" : position === 3 ? "cta" : "value");

  return {
    position,
    narrativePurpose: "Deliver value",
    layout: "fullbleed_dark_overlay",
    composition: {
      photoCount: 1,
      photoLayout: "single_full",
      subjectZone: "center",
      hasPerson: false,
      hasProduct: false,
      hasScreenshot: false,
      hasUIChrome: false,
    },
    textZone: {
      placement: "center",
      style: "headline",
      lengthHint: "short",
    },
    visualStyle: "warm neutral tones",
    backgroundType: "photo",
    ...rest,
    role: role ?? inferredRole,
  };
}

export const sampleBlueprint: TemplateBlueprint = {
  summary: "Problem-agitate-solution carousel",
  arcType: "problem-agitate-solution",
  slideCount: 3,
  globalVisualStyle: "Dark moody palette with high contrast",
  copyPattern: "Question hook → pain point → CTA",
  slides: [
    makeSlideBlueprint({
      position: 1,
      role: "hook",
      narrativePurpose: "Stop the scroll with a bold question",
      layout: "fullbleed_dark_overlay",
      composition: {
        photoCount: 1,
        photoLayout: "single_full",
        subjectZone: "top",
        hasPerson: true,
        hasProduct: false,
        hasScreenshot: false,
        hasUIChrome: false,
      },
    }),
    makeSlideBlueprint({
      position: 2,
      role: "value",
      narrativePurpose: "Show before/after contrast",
      layout: "split_compare",
      composition: {
        photoCount: 2,
        photoLayout: "split_horizontal",
        subjectZone: "full",
        hasPerson: false,
        hasProduct: true,
        hasScreenshot: false,
        hasUIChrome: false,
      },
    }),
    makeSlideBlueprint({
      position: 3,
      role: "cta",
      narrativePurpose: "Drive action",
      layout: "notification_mock",
      composition: {
        photoCount: 1,
        photoLayout: "inset",
        subjectZone: "bottom",
        hasPerson: false,
        hasProduct: false,
        hasScreenshot: true,
        hasUIChrome: true,
      },
      textZone: {
        placement: "card",
        style: "cta",
        lengthHint: "short",
      },
    }),
  ],
};

export const sampleBlueprintJson = {
  summary: "Listicle tips format",
  arc_type: "listicle",
  slide_count: 2,
  global_visual_style: "Bright pastel gradients",
  copy_pattern: "Numbered tips ending with CTA",
  slides: [
    {
      position: 1,
      role: "hook",
      narrative_purpose: "Open with a list promise",
      layout: "text_only",
      composition: {
        photo_count: 1,
        photo_layout: "single_full",
        subject_zone: "center",
        has_person: false,
        has_product: false,
        has_screenshot: false,
        has_ui_chrome: false,
      },
      text_zone: {
        placement: "center",
        style: "headline",
        length_hint: "medium",
      },
      visual_style: "Minimal gradient",
      background_type: "gradient",
    },
    {
      position: 2,
      role: "cta",
      narrative_purpose: "Close with testimonial proof",
      layout: "testimonial_card",
      composition: {
        photo_count: 1,
        photo_layout: "inset",
        subject_zone: "center",
        has_person: true,
        has_product: false,
        has_screenshot: false,
        has_ui_chrome: true,
      },
      text_zone: {
        placement: "card",
        style: "quote",
        length_hint: "long",
      },
      visual_style: "Soft blur backdrop",
      background_type: "blurred",
    },
  ],
};

export const sampleBrandProfile = {
  app_name: "Mymo",
  app_category: "SaaS",
  app_tagline: "AI carousels in minutes",
  social_handle: "mymo",
  brand_tone: "Bold and direct",
  target_audience: "DTC founders",
  value_propositions: ["Save 10 hours/week", "On-brand every time"],
  core_problem: "Creating content takes forever",
  key_outcome: "Publish-ready carousels fast",
  features: [{ name: "Template remix", benefit: "Clone viral formats" }],
  competitor_name: null,
  competitor_weakness: null,
  user_quotes: [{ quote: "Game changer", name: "Alex", title: "Founder" }],
  metric_result: "3x engagement",
  cta_text: "Try free",
  brand_color: "#FF5A1F",
  logo_url: null,
  llm_summary: "AI carousel generator for brands",
  app_url: "https://mymo.app",
};
