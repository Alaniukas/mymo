import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { fetchMediaBuffer } from "./storage";
import type { SubjectZone } from "./template-blueprint";

export type AssetSuggestedRole = "hook" | "value" | "cta";

export interface AssetBlueprint {
  subjectZone: SubjectZone;
  hasPerson: boolean;
  hasProduct: boolean;
  hasScreenshot: boolean;
  mood: string;
  dominantColors: string[];
  shortDescription: string;
  suggestedRoles: AssetSuggestedRole[];
  sceneType?: string;
  visualEnergy?: string;
}

const ASSET_ANALYSIS_SYSTEM = `You analyze a single user-uploaded photo for carousel slide assignment.

Return JSON:
{
  "subjectZone": "top"|"center"|"bottom"|"left"|"right"|"full",
  "hasPerson": boolean,
  "hasProduct": boolean,
  "hasScreenshot": boolean,
  "mood": "short mood label",
  "dominantColors": ["#hex", ...],
  "shortDescription": "one sentence — what is in the photo, where the subject sits in frame",
  "suggestedRoles": ["hook"|"value"|"cta"] — which slide roles this photo fits best (1-2),
  "sceneType": "portrait"|"workspace"|"event"|"product"|"detail"|"environment"|"other",
  "visualEnergy": "high"|"medium"|"calm"
}

Rules:
- subjectZone = where the MAIN subject sits in the frame (for smart cropping into template layouts)
- hasScreenshot=true for UI/screen/code visible as main subject
- hasProduct=true for physical product or app UI as hero
- hasPerson=true when a face or person is prominent
- suggestedRoles: hook for striking openers (person speaking, bold scene), cta for action/community shots, value for explanatory/demo/workspace
- shortDescription must mention composition (close-up, wide shot, etc.)`;

function normalizeSubjectZone(v: unknown): SubjectZone {
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
  return "center";
}

function normalizeRoles(v: unknown): AssetSuggestedRole[] {
  if (!Array.isArray(v)) return ["value"];
  const valid = new Set<AssetSuggestedRole>(["hook", "value", "cta"]);
  const roles = v.filter(
    (r): r is AssetSuggestedRole =>
      typeof r === "string" && valid.has(r as AssetSuggestedRole),
  );
  return roles.length > 0 ? roles : ["value"];
}

export function parseAssetBlueprint(raw: unknown): AssetBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    subjectZone: normalizeSubjectZone(o.subjectZone ?? o.subject_zone),
    hasPerson: Boolean(o.hasPerson ?? o.has_person),
    hasProduct: Boolean(o.hasProduct ?? o.has_product),
    hasScreenshot: Boolean(o.hasScreenshot ?? o.has_screenshot),
    mood: typeof o.mood === "string" ? o.mood.trim() : "",
    dominantColors: Array.isArray(o.dominantColors)
      ? o.dominantColors.map(String).slice(0, 4)
      : Array.isArray(o.dominant_colors)
        ? (o.dominant_colors as string[]).map(String).slice(0, 4)
        : [],
    shortDescription:
      typeof o.shortDescription === "string"
        ? o.shortDescription.trim()
        : typeof o.short_description === "string"
          ? o.short_description.trim()
          : "",
    suggestedRoles: normalizeRoles(o.suggestedRoles ?? o.suggested_roles),
    sceneType:
      typeof o.sceneType === "string"
        ? o.sceneType.trim()
        : typeof o.scene_type === "string"
          ? o.scene_type.trim()
          : undefined,
    visualEnergy:
      typeof o.visualEnergy === "string"
        ? o.visualEnergy.trim()
        : typeof o.visual_energy === "string"
          ? o.visual_energy.trim()
          : undefined,
  };
}

async function bufferToVisionDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(buffer);
    const maxDim = 1024;
    let w = image.width;
    let h = image.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, w, h);
      return `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg").toString("base64")}`;
    }
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }
}

export async function analyzeAssetBlueprint(
  imageUrl: string,
  model?: string,
): Promise<AssetBlueprint | null> {
  const media = await fetchMediaBuffer(imageUrl);
  if (!media) return null;

  const dataUrl = await bufferToVisionDataUrl(media.buffer);
  if (!dataUrl) return null;

  const openai = getOpenAIClient();
  const content = [
    { type: "text" as const, text: "Analyze this user photo for carousel assignment:" },
    { type: "image_url" as const, image_url: { url: dataUrl } },
  ];

  try {
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: model || EVOLINK_CHAT_DEFAULTS.model,
      max_completion_tokens: 512,
      temperature: 0.2,
      messages: [
        { role: "system", content: ASSET_ANALYSIS_SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const text = extractMessageText(completion);
    if (!text) return null;
    return parseAssetBlueprint(JSON.parse(text));
  } catch (err) {
    console.warn("[asset-blueprint] analysis failed:", err);
    return null;
  }
}

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export async function persistAssetAnalysis(
  db: SupabaseClient,
  assetId: string,
  imageUrl: string,
  model?: string,
): Promise<AssetBlueprint | null> {
  const analysis = await analyzeAssetBlueprint(imageUrl, model);
  if (!analysis) return null;

  const analyzedAt = new Date().toISOString();
  const { error } = await db
    .from("assets")
    .update({ analysis, analyzed_at: analyzedAt })
    .eq("id", assetId);

  if (error) {
    console.warn("[asset-blueprint] persist failed:", error.message);
    return analysis;
  }
  return analysis;
}
