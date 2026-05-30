/**
 * Pulls the slide images out of a public Instagram or TikTok carousel/slideshow
 * post via the Apify scraper API. Wrapped behind a thin adapter so the provider
 * or actor can be swapped through env vars without touching callers.
 *
 * Required: APIFY_TOKEN
 * Optional: APIFY_INSTAGRAM_ACTOR, APIFY_TIKTOK_ACTOR (actor id overrides)
 */

const APIFY_BASE = "https://api.apify.com/v2";
const INSTAGRAM_ACTOR =
  process.env.APIFY_INSTAGRAM_ACTOR ?? "apify~instagram-scraper";
const TIKTOK_ACTOR =
  process.env.APIFY_TIKTOK_ACTOR ?? "clockworks~tiktok-scraper";

/** Hard cap on imported slides (IG allows 10, TikTok up to 35). */
const MAX_SLIDES = 20;

export type ScrapedPlatform = "instagram" | "tiktok";

/**
 * One slide of a scraped post. `imageUrl` is always the still that represents
 * the slide (the full image for photo slides, the cover/poster for video
 * slides). `videoUrl` is set only when the slide is a video so the original
 * post can be played back exactly as it was.
 */
export interface ScrapedSlide {
  imageUrl: string;
  videoUrl: string | null;
}

export interface ScrapedCarousel {
  platform: ScrapedPlatform;
  caption: string;
  slides: ScrapedSlide[];
}

type ApifyItem = Record<string, unknown>;

/** Returns the platform for a URL, or null if it is not IG/TikTok. */
export function detectPlatform(url: string): ScrapedPlatform | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (hostname.includes("instagram.com")) return "instagram";
  if (hostname.includes("tiktok.com")) return "tiktok";
  return null;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isHttpUrl) : [];
}

/** Pulls http(s) URLs from an array of strings or objects (by candidate keys). */
function collectFromList(list: unknown, keys: string[]): string[] {
  if (!Array.isArray(list)) return [];
  const urls: string[] = [];
  for (const entry of list) {
    if (isHttpUrl(entry)) {
      urls.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as ApifyItem;
      for (const key of keys) {
        if (isHttpUrl(obj[key])) {
          urls.push(obj[key] as string);
          break;
        }
      }
    }
  }
  return urls;
}

async function runActor(actor: string, input: ApifyItem): Promise<ApifyItem[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not configured");
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(
      token,
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(55_000),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Scraper request failed (${res.status})${
        detail ? `: ${detail.slice(0, 200)}` : ""
      }`,
    );
  }

  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as ApifyItem[]) : [];
}

function parseInstagram(items: ApifyItem[]): { caption: string; slides: ScrapedSlide[] } {
  const item = items[0] ?? {};
  const caption = asString(item.caption);

  // A carousel ("Sidecar") exposes one entry per slide in childPosts; prefer it
  // since it preserves each slide's media — `displayUrl` is the cover image and
  // `videoUrl` is the MP4 when that slide is a video (e.g. a Reel-style clip).
  const children = Array.isArray(item.childPosts) ? item.childPosts : [];
  let slides: ScrapedSlide[] = [];
  for (const child of children) {
    if (!child || typeof child !== "object") continue;
    const c = child as ApifyItem;
    if (!isHttpUrl(c.displayUrl)) continue; // every slide needs a still to show
    slides.push({
      imageUrl: c.displayUrl,
      videoUrl: isHttpUrl(c.videoUrl) ? c.videoUrl : null,
    });
  }

  // Fall back to the images array, then the single post (which may itself be a
  // video, e.g. a Reel) for non-carousel links.
  if (slides.length === 0) {
    const fromImages = stringArray(item.images);
    if (fromImages.length > 0) {
      slides = fromImages.map((imageUrl) => ({ imageUrl, videoUrl: null }));
    } else if (isHttpUrl(item.displayUrl)) {
      slides = [
        {
          imageUrl: item.displayUrl,
          videoUrl: isHttpUrl(item.videoUrl) ? item.videoUrl : null,
        },
      ];
    }
  }

  return { caption, slides };
}

function parseTikTok(items: ApifyItem[]): { caption: string; slides: ScrapedSlide[] } {
  const item = items[0] ?? {};
  const caption = asString(item.text);

  // TikTok carousels are photo slideshows (no per-slide video). With
  // shouldDownloadSlideshowImages, mediaUrls holds stable Apify-hosted image
  // links. slideshowImageLinks holds the original (signed) TikTok CDN URLs as a
  // fallback; images is a last resort.
  const fromMedia = stringArray(item.mediaUrls);
  const fromSlideshow = collectFromList(item.slideshowImageLinks, [
    "downloadLink",
    "tiktokLink",
    "url",
  ]);
  const fromImages = stringArray(item.images);

  let urls = fromMedia;
  if (urls.length === 0) urls = fromSlideshow;
  if (urls.length === 0) urls = fromImages;

  return { caption, slides: urls.map((imageUrl) => ({ imageUrl, videoUrl: null })) };
}

/**
 * Scrapes a public IG/TikTok post and returns the platform, caption, and an
 * ordered, de-duplicated list of slides. Each slide carries its still image and,
 * for video slides, the original video URL. May be empty for unsupported posts
 * (e.g. private accounts).
 */
export async function scrapeCarousel(url: string): Promise<ScrapedCarousel> {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error("URL must be an Instagram or TikTok link");
  }

  let parsed: { caption: string; slides: ScrapedSlide[] };

  if (platform === "instagram") {
    const items = await runActor(INSTAGRAM_ACTOR, {
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    });
    parsed = parseInstagram(items);
  } else {
    const items = await runActor(TIKTOK_ACTOR, {
      postURLs: [url],
      resultsPerPage: 1,
      shouldDownloadSlideshowImages: true,
    });
    parsed = parseTikTok(items);
  }

  // De-dupe by still image so a slide's image+video pairing stays intact.
  const seen = new Set<string>();
  const slides: ScrapedSlide[] = [];
  for (const slide of parsed.slides) {
    if (seen.has(slide.imageUrl)) continue;
    seen.add(slide.imageUrl);
    slides.push(slide);
    if (slides.length >= MAX_SLIDES) break;
  }

  return { platform, caption: parsed.caption, slides };
}
