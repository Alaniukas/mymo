export interface BrandVibeFonts {
  heading?: string;
  body?: string;
  overlay?: string;
  notes?: string;
}

export interface BrandVibePayload {
  visualTheme: string;
  captionVoice: string;
  hashtagStyle: string;
  fonts: BrandVibeFonts;
  colors: string[];
  logoDescription?: string;
  textOverlayStyle: string;
  uploadPatterns: string;
  contentTopics: string[];
  summary: string;
}

export interface BrandVibeSnapshot {
  id: string;
  workspace_id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  vibe: BrandVibePayload;
  asset_ids: string[];
  is_active: boolean;
  created_at: string;
}

export function parseBrandVibePayload(raw: unknown): BrandVibePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fontsRaw = o.fonts && typeof o.fonts === "object" ? (o.fonts as Record<string, unknown>) : {};
  return {
    visualTheme: typeof o.visualTheme === "string" ? o.visualTheme : typeof o.visual_theme === "string" ? o.visual_theme : "",
    captionVoice: typeof o.captionVoice === "string" ? o.captionVoice : typeof o.caption_voice === "string" ? o.caption_voice : "",
    hashtagStyle: typeof o.hashtagStyle === "string" ? o.hashtagStyle : typeof o.hashtag_style === "string" ? o.hashtag_style : "",
    fonts: {
      heading: typeof fontsRaw.heading === "string" ? fontsRaw.heading : undefined,
      body: typeof fontsRaw.body === "string" ? fontsRaw.body : undefined,
      overlay: typeof fontsRaw.overlay === "string" ? fontsRaw.overlay : undefined,
      notes: typeof fontsRaw.notes === "string" ? fontsRaw.notes : undefined,
    },
    colors: Array.isArray(o.colors) ? o.colors.map(String).slice(0, 8) : [],
    logoDescription:
      typeof o.logoDescription === "string"
        ? o.logoDescription
        : typeof o.logo_description === "string"
          ? o.logo_description
          : undefined,
    textOverlayStyle:
      typeof o.textOverlayStyle === "string"
        ? o.textOverlayStyle
        : typeof o.text_overlay_style === "string"
          ? o.text_overlay_style
          : "",
    uploadPatterns:
      typeof o.uploadPatterns === "string"
        ? o.uploadPatterns
        : typeof o.upload_patterns === "string"
          ? o.upload_patterns
          : "",
    contentTopics: Array.isArray(o.contentTopics)
      ? o.contentTopics.map(String).slice(0, 8)
      : Array.isArray(o.content_topics)
        ? (o.content_topics as string[]).map(String).slice(0, 8)
        : [],
    summary: typeof o.summary === "string" ? o.summary : "",
  };
}

export function formatVibeForPrompt(vibe: BrandVibePayload): string {
  const lines = [
    vibe.summary && `Vibe summary: ${vibe.summary}`,
    vibe.visualTheme && `Visual theme: ${vibe.visualTheme}`,
    vibe.captionVoice && `Caption voice: ${vibe.captionVoice}`,
    vibe.textOverlayStyle && `Text overlay style: ${vibe.textOverlayStyle}`,
    vibe.fonts.heading && `Heading font feel: ${vibe.fonts.heading}`,
    vibe.fonts.body && `Body font feel: ${vibe.fonts.body}`,
    vibe.fonts.overlay && `On-screen text font: ${vibe.fonts.overlay}`,
    vibe.colors.length > 0 && `Brand colors from feed: ${vibe.colors.join(", ")}`,
    vibe.logoDescription && `Logo/branding: ${vibe.logoDescription}`,
    vibe.uploadPatterns && `What they typically post: ${vibe.uploadPatterns}`,
    vibe.hashtagStyle && `Hashtag style: ${vibe.hashtagStyle}`,
    vibe.contentTopics.length > 0 && `Topics: ${vibe.contentTopics.join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}
