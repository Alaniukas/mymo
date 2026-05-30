import type { NicheSlug } from "./niches";
import { getPreset, type TemplatePreset } from "./template-presets";

/** Stable marker stored in `carousel_templates.source_url` for deduplication. */
export function presetSourceUrl(presetId: string): string {
  return `preset:${presetId}`;
}

const NICHE_GRADIENTS: Record<NicheSlug, { from: string; to: string }> = {
  ecomm: { from: "#fb923c", to: "#f43f5e" },
  app: { from: "#38bdf8", to: "#6366f1" },
  personal_brand: { from: "#a78bfa", to: "#d946ef" },
  viral: { from: "#34d399", to: "#14b8a6" },
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars = 28): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Slide copy hints derived from the preset metadata. */
export function presetSlideLabels(preset: TemplatePreset): string[] {
  const total = preset.slideCount;
  const labels: string[] = [];
  for (let i = 0; i < total; i++) {
    if (i === 0) {
      labels.push(preset.title);
    } else if (i === total - 1) {
      labels.push("Call to action →");
    } else if (i === 1) {
      labels.push(preset.description);
    } else {
      labels.push(`Slide ${i + 1} — ${preset.title}`);
    }
  }
  return labels;
}

export function buildPresetSlideSvg(
  preset: TemplatePreset,
  slideIndex: number,
): string {
  const { from, to } = NICHE_GRADIENTS[preset.niche];
  const total = preset.slideCount;
  const labels = presetSlideLabels(preset);
  const label = labels[slideIndex] ?? preset.title;
  const lines = wrapText(label);
  const lineEls = lines
    .map(
      (l, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : 52}">${escapeXml(l)}</tspan>`,
    )
    .join("");
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === total - 1;
  const fontSize = isFirst ? 56 : 44;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="48" y="48" width="984" height="1254" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>
  <text x="540" y="${isFirst ? 620 : 580}" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-0.02em">
    ${lineEls}
  </text>
  <text x="540" y="1280" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, sans-serif" font-size="28" font-weight="600">${slideIndex + 1} / ${total}</text>
  ${!isLast ? `<polygon points="1020,675 1060,675 1040,710" fill="rgba(255,255,255,0.5)"/>` : ""}
  ${isLast ? `<rect x="340" y="1180" width="400" height="72" rx="36" fill="#ffffff"/><text x="540" y="1228" text-anchor="middle" fill="${to}" font-family="system-ui, sans-serif" font-size="28" font-weight="700">Swipe / CTA</text>` : ""}
</svg>`;
}

export function resolvePreset(presetId: string): TemplatePreset | undefined {
  return getPreset(presetId);
}
