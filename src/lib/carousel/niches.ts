// Niche taxonomy for carousel templates. Slugs are persisted in
// carousel_templates.niche (see migration 006) and validated server-side.

export const NICHES = [
  { slug: "ecomm", label: "Ecomm" },
  { slug: "app", label: "App" },
  { slug: "personal_brand", label: "Personal Brand" },
  { slug: "viral", label: "Viral" },
] as const;

export type NicheSlug = (typeof NICHES)[number]["slug"];

const NICHE_SLUGS = NICHES.map((n) => n.slug) as readonly string[];

export function isNiche(value: unknown): value is NicheSlug {
  return typeof value === "string" && NICHE_SLUGS.includes(value);
}

export function nicheLabel(slug: string): string {
  return NICHES.find((n) => n.slug === slug)?.label ?? slug;
}

// Per-niche content model.
//
// `usesDemos` decides whether a niche pairs a lifestyle "hook" with a
// product/app "demo" screenshot (app, ecomm) or works from hooks alone
// (personal_brand, viral) — the latter generate one caption per hook with no
// demo to pair against. `identityLabel` is the human label for the brand
// identity step shown in the sidebar + onboarding.
interface NicheContentModel {
  identityLabel: string;
  usesDemos: boolean;
}

const NICHE_CONTENT: Record<NicheSlug, NicheContentModel> = {
  ecomm: { identityLabel: "Brand Identity", usesDemos: true },
  app: { identityLabel: "App Identity", usesDemos: true },
  personal_brand: { identityLabel: "Brand Identity", usesDemos: false },
  viral: { identityLabel: "Identity", usesDemos: false },
};

// Defaults preserve the original app-style behavior for workspaces whose niche
// isn't set yet (migration 012 not run, or onboarding not completed), so demos
// keep being required there exactly as before.
const DEFAULT_CONTENT: NicheContentModel = {
  identityLabel: "App Identity",
  usesDemos: true,
};

function nicheContent(slug: string | null | undefined): NicheContentModel {
  return isNiche(slug) ? NICHE_CONTENT[slug] : DEFAULT_CONTENT;
}

/** Sidebar/onboarding label for the brand-identity step, adapted to the niche. */
export function nicheIdentityLabel(slug: string | null | undefined): string {
  return nicheContent(slug).identityLabel;
}

/** Whether this niche pairs hooks with product "demo" screenshots. */
export function nicheUsesDemos(slug: string | null | undefined): boolean {
  return nicheContent(slug).usesDemos;
}
