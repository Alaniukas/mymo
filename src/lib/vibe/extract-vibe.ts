import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { fetchMediaBuffer } from "@/lib/carousel/storage";
import type { BrandVibePayload } from "./types";
import { parseBrandVibePayload } from "./types";

const VIBE_EXTRACT_SYSTEM = `You reverse-engineer a creator/brand's social media visual identity from their posts.

From captions + sample images (and video context if provided), extract their repeatable "vibe" so NEW photos can be styled to match.

Return JSON:
{
  "visualTheme": "palette, lighting, mood, composition patterns",
  "captionVoice": "how they write — tone, length, emoji, slang",
  "hashtagStyle": "how they use hashtags",
  "fonts": {
    "heading": "font personality for titles (e.g. bold condensed sans)",
    "body": "body/caption font feel",
    "overlay": "on-video/image text overlay font style",
    "notes": "other typography cues"
  },
  "colors": ["#hex or color name", ...],
  "logoDescription": "logo/watermark placement and look if visible",
  "textOverlayStyle": "where/how text sits on images (bottom third, stroke, caps, etc.)",
  "uploadPatterns": "what content they post (talking head, b-roll, memes, product shots…)",
  "contentTopics": ["topic1", "topic2"],
  "summary": "2-3 sentence vibe brief for an AI content generator"
}`;

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const media = await fetchMediaBuffer(url);
    if (!media || !media.buffer.length) return null;
    const mime = media.contentType.startsWith("image/") ? media.contentType : "image/jpeg";
    return `data:${mime};base64,${media.buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function extractBrandVibeFromContent(opts: {
  platform: string;
  sourceUrl: string;
  captions: string[];
  imageUrls: string[];
  videoUrls?: string[];
  model?: string;
}): Promise<BrandVibePayload> {
  const captionBlock = opts.captions
    .filter(Boolean)
    .slice(0, 12)
    .map((c, i) => `Post ${i + 1}: ${c.slice(0, 500)}`)
    .join("\n");

  const videoNote =
    opts.videoUrls && opts.videoUrls.length > 0
      ? `\nVideo posts detected (${opts.videoUrls.length}). Infer motion/edit style, on-screen text, and pacing from covers + captions.`
      : "";

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Platform: ${opts.platform}\nSource: ${opts.sourceUrl}\n\nCaptions:\n${captionBlock || "(image-only posts)"}${videoNote}\n\nExtract the brand vibe JSON:`,
    },
  ];

  for (const url of opts.imageUrls.slice(0, 5)) {
    const dataUrl = await imageUrlToDataUrl(url);
    if (dataUrl) {
      contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
    }
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 2048,
    temperature: 0.4,
    messages: [
      { role: "system", content: VIBE_EXTRACT_SYSTEM },
      { role: "user", content: contentParts },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) {
    return fallbackVibe(opts.captions);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return parseBrandVibePayload(parsed) ?? fallbackVibe(opts.captions);
  } catch {
    return fallbackVibe(opts.captions);
  }
}

function fallbackVibe(captions: string[]): BrandVibePayload {
  const sample = captions.filter(Boolean).slice(0, 3).join(" ").slice(0, 200);
  return {
    visualTheme: "Authentic social-native feed aesthetic",
    captionVoice: sample || "Casual, relatable, short-form",
    hashtagStyle: "Mix of niche + broad tags",
    fonts: { overlay: "Bold white sans-serif with dark stroke" },
    colors: [],
    textOverlayStyle: "Bottom-third caption bars",
    uploadPatterns: "Mixed photo and short-form content",
    contentTopics: [],
    summary: sample || "Social-native creator brand",
  };
}
