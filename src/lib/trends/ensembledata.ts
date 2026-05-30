// EnsembleData provider: fetches TikTok music ("sounds") data.
//
// We use the Music Search endpoint sorted by "most used", which is the closest
// publicly available proxy for "what's trending right now" in a given niche.
// Docs: https://ensembledata.com/apis/docs (GET /tt/music/info)

import type { TrendingSound } from "./types";

const ENSEMBLE_BASE = "https://ensembledata.com/apis";

interface EnsembleCover {
  url_list?: string[];
}

interface EnsembleMusic {
  id?: number;
  id_str?: string;
  mid?: string;
  title?: string;
  author?: string;
  user_count?: number;
  duration?: number;
  is_commerce_music?: boolean;
  cover_thumb?: EnsembleCover;
  cover_medium?: EnsembleCover;
  cover_large?: EnsembleCover;
  play_url?: EnsembleCover;
}

function firstUrl(...covers: Array<EnsembleCover | undefined>): string | null {
  for (const cover of covers) {
    const url = cover?.url_list?.find(
      (u) => typeof u === "string" && u.startsWith("http"),
    );
    if (url) return url;
  }
  return null;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sound"
  );
}

function mapSound(m: EnsembleMusic): TrendingSound | null {
  const id = m.id_str || m.mid || (m.id != null ? String(m.id) : "");
  if (!id) return null;

  const title = m.title?.trim() || "Untitled sound";
  const author = m.author?.trim() || "Unknown artist";

  return {
    id,
    title,
    author,
    coverUrl: firstUrl(m.cover_medium, m.cover_thumb, m.cover_large),
    playUrl: firstUrl(m.play_url),
    usageCount: typeof m.user_count === "number" ? m.user_count : 0,
    durationSec: typeof m.duration === "number" ? m.duration : null,
    isCommercial: Boolean(m.is_commerce_music),
    tiktokUrl: `https://www.tiktok.com/music/${slugify(title)}-${id}`,
  };
}

function describeError(status: number): string {
  switch (status) {
    case 491:
      return "Trends API token is invalid.";
    case 492:
      return "Trends API account email is not verified.";
    case 493:
      return "Trends API subscription has expired.";
    case 495:
      return "Trends API daily quota reached — try again later.";
    case 422:
      return "Invalid trends search.";
    default:
      return `Trends API request failed (${status}).`;
  }
}

/**
 * Search TikTok sounds for a keyword, ranked by how many videos use each track.
 * Throws with a friendly message on provider errors.
 */
export async function fetchTrendingSounds(
  token: string,
  keyword: string,
  limit = 24,
): Promise<TrendingSound[]> {
  const params = new URLSearchParams({
    name: keyword,
    cursor: "0",
    sorting: "1", // most_used
    filter_by: "0",
    token,
  });

  const res = await fetch(`${ENSEMBLE_BASE}/tt/music/info?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(describeError(res.status));
  }

  const data = (await res.json().catch(() => null)) as
    | { data?: { music?: EnsembleMusic[] } }
    | null;

  const music = data?.data?.music ?? [];

  return music
    .map(mapSound)
    .filter((s): s is TrendingSound => s !== null)
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}
