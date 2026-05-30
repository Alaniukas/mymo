import { type NicheSlug } from "@/lib/carousel/niches";

// Per-niche overrides for the human-facing field labels in the Brain editor.
// DB column names and the Variable Dictionary keys are unchanged — only what the
// user reads. Any field omitted falls back to the default label passed by the
// caller, so the `app` niche (and pre-niche workspaces) keep the defaults.
const NICHE_LABELS: Partial<Record<NicheSlug, Record<string, string>>> = {
  ecomm: {
    app_name: "Brand / Product Name",
    app_category: "Product Category",
    core_problem: "Customer Problem",
    key_outcome: "Result / Transformation",
    cta_text: "Shop CTA",
  },
  personal_brand: {
    app_name: "Your Name / Offer",
    app_category: "Topic / Niche",
    core_problem: "Audience Problem",
    key_outcome: "Transformation",
    cta_text: "Follow / Join CTA",
  },
  viral: {
    app_name: "Brand / Handle",
    app_category: "Topic",
    cta_text: "Engagement CTA",
  },
};

/** Resolves a field's label for the active niche, defaulting to `fallback`. */
export function resolveFieldLabel(
  niche: NicheSlug | null | undefined,
  field: string,
  fallback: string,
): string {
  return (niche && NICHE_LABELS[niche]?.[field]) || fallback;
}
