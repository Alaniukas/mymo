// Brand-analysis prompt used by the crawl route to turn scraped site text into
// the Variable Dictionary (app_identities). The JSON shape NEVER changes
// between niches — only the "lens" paragraph that tells the model how to
// interpret each field changes — so the downstream parser and upsert stay
// identical regardless of niche.

import { nicheLabel, type NicheSlug } from "./niches";

const BRAND_PARSE_INTRO = `You are a brand analyst. Given the text content scraped from a website, extract a structured brand profile that will power on-brand social content. This profile fills the placeholders our content templates inject, so be concrete and specific — favor the words a real customer would use over marketing fluff.`;

const BRAND_PARSE_SHAPE = `Respond ONLY with valid JSON in this exact shape. Use "" for unknown strings and [] for unknown lists — never null, and never invent facts that aren't supported by the text. Escape any double quotes inside string values as \\". Keep string values on a single line (no raw line breaks inside strings):
{
  "app_name": "the product / brand name",
  "app_category": "what the product is, in plain words (e.g. 'AI meeting-notes app')",
  "app_tagline": "one-line positioning statement",
  "brand_tone": "communication style (e.g. 'punchy, no-fluff', 'professional but approachable')",
  "target_audience": "who the content speaks to (e.g. 'busy founders')",
  "social_handle": "primary social handle if discoverable (e.g. '@brand'), else ''",
  "value_propositions": ["3-5 short benefit bullets"],
  "core_problem": "the main pain the audience feels today, as a concrete moment",
  "key_outcome": "the result the user gets — sell outcomes, not features (e.g. '10 hours back every week')",
  "features": [{"name": "a single named capability", "benefit": "why that feature matters to the user"}],
  "competitor_name": "a named rival if mentioned, otherwise a generic foil like 'the old way' or 'spreadsheets'",
  "competitor_weakness": "what that rival / old way does badly",
  "user_quotes": [{"quote": "a short testimonial line", "name": "attribution name or ''", "title": "attribution title or ''"}],
  "metric_result": "a quantified win if present (e.g. 'saved 12 hrs/week'), else ''",
  "cta_text": "the primary action verb phrase (e.g. 'Try it free', 'Shop now')",
  "brand_color": "the primary brand color as a hex value if detectable (e.g. '#5B3DF5'), else ''",
  "logo_url": "URL of the brand logo image if discoverable in the source, else ''",
  "product_terminology": {"term": "definition"},
  "brand_dna": "the brand's DNA in 1-2 vivid sentences — its personality, point of view, and what makes its voice unmistakable (e.g. 'A scrappy, no-BS coach who treats fitness like engineering — blunt, data-driven, and allergic to hype.')",
  "summary": "a 2-3 sentence summary of what the product does and who it serves"
}`;

// The app/ecommerce framing the tool shipped with — used when no niche is set
// so existing behavior never regresses.
const DEFAULT_LENS = `This is a SaaS app, app, or ecommerce business. Treat "app_name" as the product/brand name and "app_category" as what the product is in plain words.`;

const NICHE_LENSES: Record<NicheSlug, string> = {
  ecomm: `This is an ecommerce / DTC product store. Interpret every field through a product-commerce lens: "app_name" is the brand or product name, "app_category" is the product category (e.g. "skincare serum", "running shoes"), "core_problem" is the customer pain the product solves, "key_outcome" is the result or transformation the product delivers, "features" are product features/benefits, and "cta_text" is a shopping action like "Shop now" or "Get yours".`,
  app: `This is a SaaS product or app. Interpret the fields through a software lens: "app_name" is the product name, "app_category" is what the app does (e.g. "AI meeting-notes app"), "features" are app capabilities, and "cta_text" is an action like "Try it free" or "Start now".`,
  personal_brand: `This is a personal brand or creator. Interpret the fields through a creator lens: "app_name" is the creator/person's name or their signature offer, "app_category" is their domain or topic (e.g. "fitness coaching", "indie hacking"), "target_audience" is their followers, "features" are what they teach or offer, and "cta_text" is a community action like "Follow for more" or "Join free".`,
  viral: `Optimize for a broad, general audience and curiosity. Keep every field generic and widely relatable rather than tied to one product: "app_name" is the brand or handle behind the content, "app_category" is the broad topic, and "cta_text" is an engagement action like "Follow for more" or "Save this".`,
};

// Composes the shared base prompt with the niche-specific lens. With no niche
// the default app/ecommerce framing is used.
export function buildBrandPrompt(niche: NicheSlug | null): string {
  const lens = niche ? NICHE_LENSES[niche] : DEFAULT_LENS;
  const header = niche ? `NICHE CONTEXT — ${nicheLabel(niche)}:` : "CONTEXT:";
  return `${BRAND_PARSE_INTRO}\n\n${header}\n${lens}\n\n${BRAND_PARSE_SHAPE}`;
}
