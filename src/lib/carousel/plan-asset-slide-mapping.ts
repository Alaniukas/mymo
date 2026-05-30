import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import type { AssetBlueprint } from "./asset-blueprint";
import { parseAssetBlueprint } from "./asset-blueprint";
import {
  matchAssetsToSlides,
  type AssetWithAnalysis,
} from "./match-assets-to-slides";
import type { StudioSlidePlan } from "./studio-slide-count";
import { slideUsesUserPhotos } from "./studio-slide-count";
import type { SubjectZone, TemplateSlideBlueprint } from "./template-blueprint";

export interface SlideAssetAssignment {
  assetIds: string[];
  /** AI-suggested crop anchor when placing this photo in the template frame. */
  subjectZone?: SubjectZone;
}

export type AssetSlideMapping = Map<number, SlideAssetAssignment>;

const MAPPING_SYSTEM = `You assign user-uploaded photos to carousel template slides.

Each template slide has a structural role and layout (inset photo, full bleed, notes card backdrop, etc.).
Each user photo has been analyzed — use those descriptions to pick the BEST photo per slide.

Rules:
- When there are at least as many photos as photo slides, use each photo AT MOST ONCE.
- Hook slide (first): prefer striking, person-forward, or high-energy opener shots.
- CTA slide (last): prefer action-oriented, workspace, or community shots.
- Value slides: match photo content to slide purpose (workspace for "building", portrait for "personal story", detail shots for tips).
- Respect template composition hints (hasPerson, hasProduct, hasScreenshot, subjectZone).
- Pick subjectZone for crop: where the main subject sits IN the user photo (top/center/bottom/left/right/full).

Output JSON:
{
  "assignments": [
    { "slidePosition": number, "assetId": string, "subjectZone": "top"|"center"|"bottom"|"left"|"right"|"full" }
  ]
}`;

function slideSpec(slide: TemplateSlideBlueprint): string {
  const c = slide.composition;
  return [
    `Slide ${slide.position} (${slide.role})`,
    `purpose: ${slide.narrativePurpose || "value"}`,
    `layout: ${slide.layout}`,
    `photos: ${c.photoCount}/${c.photoLayout}`,
    `needs person=${c.hasPerson} product=${c.hasProduct} screenshot=${c.hasScreenshot}`,
    `template subjectZone: ${c.subjectZone}`,
    `background: ${slide.backgroundType}`,
  ].join(" | ");
}

function assetSpec(
  asset: AssetWithAnalysis,
  index: number,
): string {
  const bp = parseAssetBlueprint(asset.analysis);
  if (!bp) {
    return `Photo ${index + 1} id=${asset.id}: (not analyzed yet)`;
  }
  return [
    `Photo ${index + 1} id=${asset.id}`,
    bp.shortDescription || "user photo",
    `subjectZone=${bp.subjectZone}`,
    `person=${bp.hasPerson}`,
    `product=${bp.hasProduct}`,
    `screenshot=${bp.hasScreenshot}`,
    `mood=${bp.mood || "neutral"}`,
    bp.sceneType ? `scene=${bp.sceneType}` : "",
    bp.visualEnergy ? `energy=${bp.visualEnergy}` : "",
    `fits roles: ${bp.suggestedRoles.join(",")}`,
  ].join(" | ");
}

function normalizeSubjectZone(v: unknown): SubjectZone | undefined {
  const valid: SubjectZone[] = [
    "top",
    "center",
    "bottom",
    "left",
    "right",
    "full",
  ];
  if (typeof v === "string" && valid.includes(v as SubjectZone)) {
    return v as SubjectZone;
  }
  return undefined;
}

function validateMapping(
  raw: Map<number, SlideAssetAssignment>,
  photoSlides: TemplateSlideBlueprint[],
  assets: AssetWithAnalysis[],
  plan: StudioSlidePlan,
): AssetSlideMapping | null {
  const validIds = new Set(assets.map((a) => a.id));
  const allowReuse = photoSlides.length > assets.length;
  const used = new Set<string>();
  const result: AssetSlideMapping = new Map();

  for (const slide of photoSlides) {
    const entry = raw.get(slide.position);
    if (!entry?.assetIds[0]) return null;
    const id = entry.assetIds[0];
    if (!validIds.has(id)) return null;
    if (!allowReuse && used.has(id)) return null;
    result.set(slide.position, entry);
    if (!allowReuse) used.add(id);
  }

  if (result.size !== photoSlides.length) return null;
  return result;
}

/** LLM picks which user photo belongs on each template photo slide. */
export async function planAssetSlideMappingWithAI(
  slides: TemplateSlideBlueprint[],
  assets: AssetWithAnalysis[],
  plan: StudioSlidePlan,
  model?: string,
): Promise<AssetSlideMapping | null> {
  const photoSlides = slides.filter((s) => slideUsesUserPhotos(s.position, plan));
  if (photoSlides.length === 0 || assets.length === 0) return null;

  const slideLines = photoSlides.map(slideSpec).join("\n");
  const assetLines = assets.map((a, i) => assetSpec(a, i)).join("\n");
  const reuseNote =
    photoSlides.length > assets.length
      ? "Fewer photos than slides — reuse allowed on value slides only."
      : "Each photo may be used at most once.";

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: model || EVOLINK_CHAT_DEFAULTS.model,
    reasoning_effort: "low",
    max_completion_tokens: 1024,
    temperature: 0.2,
    messages: [
      { role: "system", content: MAPPING_SYSTEM },
      {
        role: "user",
        content: `${reuseNote}\n\nTemplate slides:\n${slideLines}\n\nUser photos:\n${assetLines}\n\nReturn assignments JSON.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) return null;

  const parsed = JSON.parse(text) as {
    assignments?: {
      slidePosition?: number;
      slide_position?: number;
      assetId?: string;
      asset_id?: string;
      subjectZone?: string;
      subject_zone?: string;
    }[];
  };

  const raw = new Map<number, SlideAssetAssignment>();
  for (const row of parsed.assignments ?? []) {
    const pos = row.slidePosition ?? row.slide_position;
    const assetId = row.assetId ?? row.asset_id;
    if (typeof pos !== "number" || typeof assetId !== "string") continue;
    raw.set(pos, {
      assetIds: [assetId],
      subjectZone: normalizeSubjectZone(row.subjectZone ?? row.subject_zone),
    });
  }

  return validateMapping(raw, photoSlides, assets, plan);
}

function heuristicToMapping(
  heuristic: Map<number, string[]>,
): AssetSlideMapping {
  const out: AssetSlideMapping = new Map();
  for (const [pos, ids] of heuristic) {
    out.set(pos, { assetIds: ids });
  }
  return out;
}

/** Ensure analyses exist, then AI-match photos to template slides (heuristic fallback). */
export async function resolveAssetSlideMapping(
  slides: TemplateSlideBlueprint[],
  assets: AssetWithAnalysis[],
  plan: StudioSlidePlan,
  model?: string,
): Promise<AssetSlideMapping> {
  const analyzedCount = assets.filter((a) => parseAssetBlueprint(a.analysis)).length;
  if (analyzedCount >= Math.min(assets.length, 1)) {
    try {
      const ai = await planAssetSlideMappingWithAI(slides, assets, plan, model);
      if (ai && ai.size > 0) return ai;
    } catch (err) {
      console.warn("[plan-asset-slide-mapping] AI mapping failed:", err);
    }
  }

  return heuristicToMapping(matchAssetsToSlides(slides, assets, plan));
}

export function subjectZoneForAssignment(
  assignment: SlideAssetAssignment | undefined,
  assetAnalysis: unknown,
  templateZone: SubjectZone,
): SubjectZone {
  if (assignment?.subjectZone) return assignment.subjectZone;
  const bp = parseAssetBlueprint(assetAnalysis);
  return bp?.subjectZone ?? templateZone;
}
