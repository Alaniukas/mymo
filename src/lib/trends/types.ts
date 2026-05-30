// Shared types for the trending-sounds inspiration feature.

export interface TrendingSound {
  /** TikTok music id (stable identifier). */
  id: string;
  title: string;
  author: string;
  /** Cover art URL, if available. */
  coverUrl: string | null;
  /** Short preview clip URL (mp3), if available. */
  playUrl: string | null;
  /** How many TikTok videos use this sound — our "trending" proxy. */
  usageCount: number;
  durationSec: number | null;
  /** True when the track is in TikTok's Commercial Music Library. */
  isCommercial: boolean;
  /** Link to the sound page on TikTok. */
  tiktokUrl: string;
}

export interface TrendsResponse {
  /** False when no trends data source is configured on the server. */
  configured: boolean;
  keyword: string;
  sounds: TrendingSound[];
}
