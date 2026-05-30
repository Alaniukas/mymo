/**
 * Extract brand-relevant images and colors from crawled HTML (og tags, icons,
 * hero images, theme-color). Used by /api/crawl before LLM brand analysis.
 */

export interface PageAssetsExtracted {
  logoUrl: string | null;
  imageUrls: string[];
  brandColor: string | null;
  /** Short block appended to crawl source text for the brand LLM. */
  assetHints: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(raw: string): string | null {
  const t = raw.trim();
  if (!HEX_RE.test(t)) return null;
  if (t.length === 4) {
    const [, r, g, b] = t;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return t.toUpperCase();
}

export function resolvePageUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return m[1].trim();
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i",
  );
  return re2.exec(html)?.[1]?.trim() ?? null;
}

function linkHref(html: string, rel: string): string | null {
  const re = new RegExp(
    `<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return m[1].trim();
  const re2 = new RegExp(
    `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${rel}[^"']*["']`,
    "i",
  );
  return re2.exec(html)?.[1]?.trim() ?? null;
}

function allMetaImages(html: string): string[] {
  const keys = [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
  ];
  const out: string[] = [];
  for (const key of keys) {
    const v = metaContent(html, "property", key) ?? metaContent(html, "name", key);
    if (v) out.push(v);
  }
  return out;
}

function iconCandidates(html: string): string[] {
  const icons: { href: string; size: number }[] = [];
  const re =
    /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon|shortcut icon)[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const sizes = tag.match(/sizes=["']([^"']+)["']/i)?.[1];
    let size = 0;
    if (sizes && sizes !== "any") {
      const px = sizes.match(/(\d+)x(\d+)/);
      if (px) size = Math.max(Number(px[1]), Number(px[2]));
    }
    if (/apple-touch-icon/i.test(tag)) size = Math.max(size, 180);
    icons.push({ href, size });
  }
  icons.sort((a, b) => b.size - a.size);
  return icons.map((i) => i.href);
}

function imgSrcs(html: string): string[] {
  const out: string[] = [];
  const re = /<img[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src =
      tag.match(/\ssrc=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const alt = (tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    const cls = (tag.match(/\sclass=["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    const skip =
      /avatar|pixel|tracking|spacer|1x1|badge-small/.test(`${alt} ${cls}`) ||
      /\.(svg)(\?|$)/i.test(src);
    if (skip) continue;
    out.push(src);
  }
  return out;
}

function jsonLdImages(html: string): string[] {
  const out: string[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      collectJsonLdImages(data, out);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

function collectJsonLdImages(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdImages(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o.logo === "string") out.push(o.logo);
  if (typeof o.image === "string") out.push(o.image);
  if (Array.isArray(o.image)) {
    for (const img of o.image) {
      if (typeof img === "string") out.push(img);
      else if (img && typeof img === "object" && typeof (img as { url?: string }).url === "string") {
        out.push((img as { url: string }).url);
      }
    }
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") collectJsonLdImages(v, out);
  }
}

function isJunkImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /favicon|sprite|placeholder|blank\.|pixel\.|spacer|1x1|badge|emoji|gravatar/.test(
      u,
    ) || /\.(svg|gif)(\?|$)/.test(u)
  );
}

function scoreImage(url: string, index: number): number {
  let s = 100 - index;
  const u = url.toLowerCase();
  if (/hero|product|feature|gallery|og|cover|banner|main/.test(u)) s += 40;
  if (/thumb|icon|logo|avatar|small|tiny|16x|32x|64x/.test(u)) s -= 50;
  if (/\.(png|webp|jpe?g)(\?|$)/.test(u)) s += 10;
  return s;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = u.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

export function extractPageAssets(html: string, pageUrl: string): PageAssetsExtracted {
  const resolved = (raw: string | null): string | null => {
    if (!raw?.trim()) return null;
    return resolvePageUrl(raw.trim(), pageUrl);
  };

  const iconHrefs = iconCandidates(html).map((h) => resolved(h)).filter(Boolean) as string[];
  const metaImages = allMetaImages(html)
    .map((h) => resolved(h))
    .filter(Boolean) as string[];
  const imgImages = imgSrcs(html)
    .map((h) => resolved(h))
    .filter(Boolean) as string[];
  const ldImages = jsonLdImages(html)
    .map((h) => resolved(h))
    .filter(Boolean) as string[];

  const logoCandidates = [
    ...iconHrefs,
    ...ldImages.filter((u) => /logo/i.test(u)),
    ...imgImages.filter((u) => /logo/i.test(u)),
  ];

  let logoUrl =
    logoCandidates.find((u) => !isJunkImageUrl(u)) ??
    iconHrefs.find((u) => !isJunkImageUrl(u)) ??
    null;

  const colorRaw =
    metaContent(html, "name", "theme-color") ??
    metaContent(html, "name", "msapplication-TileColor") ??
    metaContent(html, "property", "og:color") ??
    null;
  let brandColor = colorRaw ? normalizeHex(colorRaw) : null;

  if (!brandColor) {
    const cssVar = html.match(/--(?:primary|brand|accent)(?:-color)?:\s*(#[0-9a-f]{3,6})/i);
    if (cssVar?.[1]) brandColor = normalizeHex(cssVar[1]);
  }

  const imagePool = dedupeUrls(
    [...metaImages, ...ldImages, ...imgImages].filter((u) => !isJunkImageUrl(u)),
  )
    .filter((u) => u !== logoUrl)
    .sort((a, b) => scoreImage(b, 0) - scoreImage(a, 0));

  const imageUrls = imagePool.slice(0, 12);

  const lines: string[] = [];
  if (brandColor) lines.push(`Primary brand color (from page): ${brandColor}`);
  if (logoUrl) lines.push(`Logo image URL: ${logoUrl}`);
  if (imageUrls.length > 0) {
    lines.push(
      `Product / hero image URLs:\n${imageUrls.slice(0, 6).map((u) => `- ${u}`).join("\n")}`,
    );
  }

  const assetHints =
    lines.length > 0
      ? `\n\nDetected visual brand assets (from page HTML — use for brand_color when plausible, do not invent URLs):\n${lines.join("\n")}`
      : "";

  return { logoUrl, imageUrls, brandColor, assetHints };
}
