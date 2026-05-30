// Public entry point for trending-sounds data.
//
// Keeps the rest of the app provider-agnostic: routes import from here, not
// from a specific provider. Swap EnsembleData for another source by changing
// only this file + the provider module. Results are cached briefly because the
// underlying provider is metered per request.

import { fetchTrendingSounds } from "./ensembledata";
import type { TrendingSound } from "./types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; sounds: TrendingSound[] }>();

function getToken(): string | null {
  return process.env.ENSEMBLE_DATA_TOKEN?.trim() || null;
}

/** Whether a trends data source is configured on the server. */
export function isTrendsConfigured(): boolean {
  return Boolean(getToken());
}

/** Returns trending sounds for a keyword, or throws if not configured. */
export async function getTrendingSounds(keyword: string): Promise<TrendingSound[]> {
  const token = getToken();
  if (!token) {
    throw new Error("No trends data source is configured.");
  }

  const key = keyword.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.sounds;
  }

  const sounds = await fetchTrendingSounds(token, keyword);
  cache.set(key, { at: Date.now(), sounds });
  return sounds;
}
