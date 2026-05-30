/**
 * Memegen.link — free open meme template API (no API key).
 * Docs: https://api.memegen.link/docs/
 */

export interface MemeTemplate {
  id: string;
  name: string;
  lines: number;
  keywords: string[];
  blankUrl: string;
  exampleUrl?: string;
}

export interface MemeRenderSpec {
  templateId: string;
  /** Text lines for the template (top, bottom, …). Use "" for empty line. */
  lines: string[];
  format?: "webp" | "jpg" | "png";
}

let templateCache: MemeTemplate[] | null = null;
let cacheAt = 0;
const CACHE_MS = 1000 * 60 * 60 * 6;

function slugifyLine(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-'.!?]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80) || "_";
}

export async function fetchMemeTemplates(): Promise<MemeTemplate[]> {
  if (templateCache && Date.now() - cacheAt < CACHE_MS) {
    return templateCache;
  }

  const res = await fetch("https://api.memegen.link/templates/", {
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) throw new Error(`Memegen templates failed (${res.status})`);

  const raw = (await res.json()) as Array<Record<string, unknown>>;
  const byId = new Map<string, MemeTemplate>();

  for (const item of raw) {
    const id = typeof item.id === "string" ? item.id : "";
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: typeof item.name === "string" ? item.name : id,
      lines: typeof item.lines === "number" ? item.lines : 2,
      keywords: Array.isArray(item.keywords)
        ? item.keywords.filter((k): k is string => typeof k === "string")
        : [],
      blankUrl:
        typeof item.blank === "string"
          ? item.blank
          : `https://api.memegen.link/images/${id}.jpg`,
      exampleUrl:
        typeof item.example === "object" &&
        item.example &&
        typeof (item.example as { url?: string }).url === "string"
          ? (item.example as { url: string }).url
          : undefined,
    });
  }

  templateCache = Array.from(byId.values());
  cacheAt = Date.now();
  return templateCache;
}

export async function searchMemeTemplates(
  query: string,
  limit = 12,
): Promise<MemeTemplate[]> {
  const q = query.trim().toLowerCase();
  const all = await fetchMemeTemplates();
  if (!q) {
    return pickTrendingDefaults(all, limit);
  }

  const scored = all
    .map((t) => {
      const hay = `${t.name} ${t.keywords.join(" ")} ${t.id}`.toLowerCase();
      let score = 0;
      for (const word of q.split(/\s+/).filter(Boolean)) {
        if (hay.includes(word)) score += 2;
        if (t.id.includes(word)) score += 3;
      }
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length >= limit) {
    return scored.slice(0, limit).map((x) => x.t);
  }

  const picked = scored.map((x) => x.t);
  for (const t of pickTrendingDefaults(all, limit)) {
    if (picked.length >= limit) break;
    if (!picked.some((p) => p.id === t.id)) picked.push(t);
  }
  return picked.slice(0, limit);
}

/** Founder/brainrot-friendly defaults when no search query. */
function pickTrendingDefaults(all: MemeTemplate[], limit: number): MemeTemplate[] {
  const hotIds = [
    "drake",
    "db",
    "fine",
    "stonks",
    "pooh",
    "spongebob",
    "rollsafe",
    "panik-kalm-panik",
    "woman-cat",
    "gru",
    "midwit",
    "cmm",
    "doge",
    "success",
    "iw",
    "noidea",
    "bihw",
  ];
  const out: MemeTemplate[] = [];
  for (const id of hotIds) {
    const t = all.find((x) => x.id === id);
    if (t) out.push(t);
    if (out.length >= limit) return out;
  }
  return all.slice(0, limit);
}

/** Build a direct meme image URL (Memegen encodes text in path). */
export function memeImageUrl(spec: MemeRenderSpec): string {
  const ext = spec.format ?? "webp";
  const parts = spec.lines.map((line) => slugifyLine(line || "_"));
  while (parts.length < 1) parts.push("_");
  return `https://api.memegen.link/images/${spec.templateId}/${parts.join("/")}.${ext}`;
}

export async function renderMemeBuffer(spec: MemeRenderSpec): Promise<Buffer> {
  const url = memeImageUrl(spec);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meme render failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export function rankTemplatesForBrand(
  templates: MemeTemplate[],
  brandHints: string[],
  limit = 5,
): MemeTemplate[] {
  const hints = brandHints.map((h) => h.toLowerCase()).filter(Boolean);
  if (hints.length === 0) return templates.slice(0, limit);

  return templates
    .map((t) => {
      const hay = `${t.name} ${t.keywords.join(" ")}`.toLowerCase();
      let score = 0;
      for (const h of hints) {
        if (hay.includes(h)) score += 2;
      }
      if (["drake", "stonks", "pooh", "rollsafe", "fine"].includes(t.id)) {
        score += 1;
      }
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}
