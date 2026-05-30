// The Variable Dictionary — the single source of truth for the [bracket]
// placeholders that the Content Template Frameworks inject. It maps the brand
// "Brain" (app_identities) onto the exact placeholder keys every framework
// draws from, so a template can be swapped without remapping any fields.
//
// Convention (mirrors the spec):
//   [Square_Brackets] -> text variables, resolved here from the Brain profile.
//   {Curly_Braces}    -> asset slots, resolved by the combinatorial mixing
//                        engine at generation time (not part of this module).

export interface BrandFeature {
  name: string;
  benefit: string;
}

export interface UserQuote {
  quote: string;
  name?: string;
  title?: string;
}

/**
 * The full brain profile used to resolve text slots. A superset of the legacy
 * `BrandIdentity` (brand_tone/target_audience/value_propositions/llm_summary)
 * the freeform caption path still uses.
 */
export interface BrandProfile {
  app_name: string | null;
  app_category: string | null;
  app_tagline: string | null;
  social_handle: string | null;
  brand_tone: string | null;
  target_audience: string | null;
  value_propositions: string[] | null;
  core_problem: string | null;
  key_outcome: string | null;
  features: BrandFeature[] | null;
  competitor_name: string | null;
  competitor_weakness: string | null;
  user_quotes: UserQuote[] | null;
  metric_result: string | null;
  cta_text: string | null;
  brand_color: string | null;
  logo_url: string | null;
  llm_summary: string | null;
  app_url?: string | null;
}

/** Every text placeholder a framework may reference. */
export const VARIABLE_KEYS = [
  "App_Name",
  "App_Category",
  "App_Tagline",
  "Target_Audience",
  "Brand_Voice",
  "App_URL",
  "Handle",
  "Core_Problem",
  "Key_Outcome",
  "Feature_Name",
  "Feature_Benefit",
  "Value_Prop_1",
  "Value_Prop_2",
  "Value_Prop_3",
  "Competitor_Name",
  "Competitor_Weakness",
  "User_Quote",
  "User_Quote_2",
  "User_Name",
  "User_Title",
  "Metric_Result",
  "CTA_Text",
  "Brand_Color",
] as const;

export type VariableKey = (typeof VARIABLE_KEYS)[number];

function arr<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

function normalizeHandle(handle: string | null): string {
  const h = (handle ?? "").trim();
  if (!h) return "";
  return h.startsWith("@") ? h : `@${h}`;
}

/**
 * Resolves the brain profile into a flat `{ Placeholder: value }` map. Missing
 * fields resolve to an empty string so callers and the LLM can treat absent
 * data as "skip", never as the literal token.
 */
export function resolveVariables(brand: BrandProfile): Record<VariableKey, string> {
  const vp = arr(brand.value_propositions);
  const features = arr(brand.features);
  const quotes = arr(brand.user_quotes);
  const f0 = features[0];
  const q0 = quotes[0];
  const q1 = quotes[1];

  return {
    App_Name: brand.app_name ?? "",
    App_Category: brand.app_category ?? "",
    App_Tagline: brand.app_tagline ?? "",
    Target_Audience: brand.target_audience ?? "",
    Brand_Voice: brand.brand_tone ?? "",
    App_URL: brand.app_url ?? "",
    Handle: normalizeHandle(brand.social_handle),
    Core_Problem: brand.core_problem ?? "",
    Key_Outcome: brand.key_outcome ?? "",
    Feature_Name: f0?.name ?? "",
    Feature_Benefit: f0?.benefit ?? "",
    Value_Prop_1: vp[0] ?? "",
    Value_Prop_2: vp[1] ?? "",
    Value_Prop_3: vp[2] ?? "",
    Competitor_Name: brand.competitor_name ?? "",
    Competitor_Weakness: brand.competitor_weakness ?? "",
    User_Quote: q0?.quote ?? "",
    User_Quote_2: q1?.quote ?? "",
    User_Name: q0?.name ?? "",
    User_Title: q0?.title ?? "",
    Metric_Result: brand.metric_result ?? "",
    CTA_Text: brand.cta_text ?? "",
    Brand_Color: brand.brand_color ?? "",
  };
}

/**
 * Builds a BrandProfile from a raw `app_identities` row (plus the workspace
 * URL). Tolerant of un-migrated databases where the dictionary columns don't
 * exist yet — any missing field resolves to null.
 */
export function brandProfileFromRow(
  row: Record<string, unknown> | null | undefined,
  appUrl?: string | null,
): BrandProfile {
  const r = (row ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return {
    app_name: str(r.app_name),
    app_category: str(r.app_category),
    app_tagline: str(r.app_tagline),
    social_handle: str(r.social_handle),
    brand_tone: str(r.brand_tone),
    target_audience: str(r.target_audience),
    value_propositions: Array.isArray(r.value_propositions)
      ? (r.value_propositions as string[])
      : null,
    core_problem: str(r.core_problem),
    key_outcome: str(r.key_outcome),
    features: Array.isArray(r.features) ? (r.features as BrandFeature[]) : null,
    competitor_name: str(r.competitor_name),
    competitor_weakness: str(r.competitor_weakness),
    user_quotes: Array.isArray(r.user_quotes) ? (r.user_quotes as UserQuote[]) : null,
    metric_result: str(r.metric_result),
    cta_text: str(r.cta_text),
    brand_color: str(r.brand_color),
    logo_url: str(r.logo_url),
    llm_summary: str(r.llm_summary),
    app_url: str(appUrl) ?? null,
  };
}

/**
 * Renders the resolved dictionary as a compact, labeled context block for the
 * injection LLM. Only includes keys that actually have a value.
 */
export function formatVariablesForPrompt(brand: BrandProfile): string {
  const resolved = resolveVariables(brand);
  const lines = VARIABLE_KEYS.filter((k) => resolved[k]).map(
    (k) => `[${k}]: ${resolved[k]}`,
  );
  const summary = brand.llm_summary?.trim();
  if (summary) lines.push(`Product summary: ${summary}`);
  return lines.join("\n");
}
