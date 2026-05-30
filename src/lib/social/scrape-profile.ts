/**
 * Scrape recent posts from a public IG/TikTok profile via Apify.
 */

import {
  detectSocialProfilePlatform,
  isProfileScrapeSupported,
  type ScrapedPlatform,
  type SocialProfilePlatform,
} from "./platform";

export type { ScrapedPlatform, SocialProfilePlatform } from "./platform";
export { detectPlatform, detectSocialProfilePlatform } from "./platform";

const APIFY_BASE = "https://api.apify.com/v2";
const INSTAGRAM_ACTOR =
  process.env.APIFY_INSTAGRAM_ACTOR ?? "apify~instagram-scraper";
const TIKTOK_ACTOR =
  process.env.APIFY_TIKTOK_ACTOR ?? "clockworks~tiktok-scraper";

const MAX_POSTS = 20;

export interface ScrapedProfilePost {
  id: string;
  caption: string;
  imageUrl: string;
  videoUrl?: string;
  permalink?: string;
  postedAt?: string;
}

export interface ScrapedProfile {
  platform: ScrapedPlatform;
  profileUrl: string;
  posts: ScrapedProfilePost[];
}

type ApifyItem = Record<string, unknown>;

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isHttpUrl) : [];
}

async function runActor(actor: string, input: ApifyItem): Promise<ApifyItem[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not configured");
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Scraper request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as ApifyItem[]) : [];
}

function primaryImageFromPost(item: ApifyItem): string | null {
  if (isHttpUrl(item.displayUrl)) return item.displayUrl;
  const images = stringArray(item.images);
  if (images[0]) return images[0];
  const children = Array.isArray(item.childPosts) ? item.childPosts : [];
  for (const child of children) {
    if (child && typeof child === "object" && isHttpUrl((child as ApifyItem).displayUrl)) {
      return (child as ApifyItem).displayUrl as string;
    }
  }
  const media = stringArray(item.mediaUrls);
  if (media[0]) return media[0];
  return null;
}

function parseInstagramPosts(items: ApifyItem[], limit: number): ScrapedProfilePost[] {
  const posts: ScrapedProfilePost[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (posts.length >= limit) break;
    const imageUrl = primaryImageFromPost(item);
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);

    posts.push({
      id: asString(item.id) || asString(item.shortCode) || `ig-${posts.length}`,
      caption: asString(item.caption).slice(0, 2000),
      imageUrl,
      videoUrl: isHttpUrl(item.videoUrl) ? item.videoUrl : undefined,
      permalink: isHttpUrl(item.url) ? item.url : undefined,
      postedAt: asString(item.timestamp) || asString(item.takenAt) || undefined,
    });
  }
  return posts;
}

function parseTikTokPosts(items: ApifyItem[], limit: number): ScrapedProfilePost[] {
  const posts: ScrapedProfilePost[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (posts.length >= limit) break;
    const imageUrl = primaryImageFromPost(item);
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);

    posts.push({
      id: asString(item.id) || `tt-${posts.length}`,
      caption: (asString(item.text) || asString(item.desc)).slice(0, 2000),
      imageUrl,
      videoUrl: isHttpUrl(item.webVideoUrl) ? item.webVideoUrl : undefined,
      permalink: isHttpUrl(item.webVideoUrl) ? item.webVideoUrl : undefined,
      postedAt: asString(item.createTimeISO) || undefined,
    });
  }
  return posts;
}

/**
 * Fetch the latest public posts from a profile URL.
 * Instagram + TikTok supported today; LinkedIn/Facebook return a clear error.
 */
export async function scrapeProfilePosts(
  profileUrl: string,
  limit = 10,
): Promise<ScrapedProfile> {
  const platform = detectSocialProfilePlatform(profileUrl);
  if (!platform) {
    throw new Error(
      "Paste a profile link — Instagram (@user), TikTok (@user), LinkedIn (/in/…), or Facebook page.",
    );
  }
  if (!isProfileScrapeSupported(platform)) {
    throw new Error(
      `${platform === "linkedin" ? "LinkedIn" : "Facebook"} profile import is coming soon. Use Instagram or TikTok for now.`,
    );
  }

  const capped = Math.min(Math.max(Math.round(limit) || 10, 5), MAX_POSTS);
  let items: ApifyItem[] = [];

  if (platform === "instagram") {
    items = await runActor(INSTAGRAM_ACTOR, {
      directUrls: [profileUrl.trim()],
      resultsType: "posts",
      resultsLimit: capped,
      addParentData: false,
    });
  } else {
    items = await runActor(TIKTOK_ACTOR, {
      profiles: [profileUrl.trim()],
      resultsPerPage: capped,
      shouldDownloadSlideshowImages: true,
    });
  }

  const posts =
    platform === "instagram"
      ? parseInstagramPosts(items, capped)
      : parseTikTokPosts(items, capped);

  if (posts.length === 0) {
    throw new Error(
      "No public posts found. Check the profile is public and the link is correct.",
    );
  }

  return { platform, profileUrl: profileUrl.trim(), posts };
}

/** Build story-engine context from scraped captions. */
export function buildContextFromPosts(posts: ScrapedProfilePost[]): string {
  return posts
    .map((p, i) => {
      const cap = p.caption.trim();
      return cap
        ? `Post ${i + 1}${p.postedAt ? ` (${p.postedAt})` : ""}:\n${cap}`
        : `Post ${i + 1}: (image-only)`;
    })
    .join("\n\n");
}
