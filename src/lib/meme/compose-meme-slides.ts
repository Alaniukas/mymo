import type { MemeTemplate } from "./memegen-client";
import { rankTemplatesForBrand } from "./memegen-client";

export interface MemeSlideRender {
  templateId: string;
  lines: string[];
}

/** Turn carousel caption into meme template text lines. */
export function captionToMemeLines(caption: string, lineCount: number): string[] {
  const parts = caption
    .split(/\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= lineCount) return parts.slice(0, lineCount);
  if (lineCount <= 1) return [caption.trim() || "..."];
  if (lineCount === 2) {
    return [parts[0] ?? caption.trim(), parts[1] ?? ""];
  }
  const out = [...parts];
  while (out.length < lineCount) out.push("");
  return out.slice(0, lineCount);
}

export function assignMemeTemplatesToSlides(
  slides: { position: number; caption: string; role: string; useUserPhoto?: boolean }[],
  templates: MemeTemplate[],
  brandHints: string[],
  preferredTemplateIds?: string[],
): Map<number, { templateId: string; lines: string[] }> {
  let ranked = rankTemplatesForBrand(templates, brandHints, slides.length + 6);

  if (preferredTemplateIds?.length) {
    const preferred: MemeTemplate[] = [];
    for (const id of preferredTemplateIds) {
      const t = templates.find((x) => x.id === id);
      if (t) preferred.push(t);
    }
    if (preferred.length > 0) {
      const prefIds = new Set(preferred.map((p) => p.id));
      ranked = [...preferred, ...ranked.filter((t) => !prefIds.has(t.id))];
    }
  }

  const map = new Map<number, { templateId: string; lines: string[] }>();

  let ti = 0;
  for (const slide of slides) {
    if (slide.useUserPhoto || slide.role === "cta") continue;
    const template = ranked[ti % ranked.length] ?? ranked[0];
    if (!template) break;
    const lines = captionToMemeLines(slide.caption, Math.max(template.lines, 2));
    map.set(slide.position, {
      templateId: template.id,
      lines,
    });
    ti++;
  }
  return map;
}
