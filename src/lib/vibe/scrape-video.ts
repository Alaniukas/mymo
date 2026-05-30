import { scrapeCarousel } from "@/lib/social/scraper";
import { detectPlatform } from "@/lib/social/platform";

export interface ScrapedVideoContent {
  platform: string;
  sourceUrl: string;
  caption: string;
  imageUrls: string[];
  videoUrls: string[];
}

/** Scrape a single IG/TikTok post (often video) for vibe extraction. */
export async function scrapeVideoOrPost(url: string): Promise<ScrapedVideoContent> {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error("Paste an Instagram or TikTok post/reel/video link.");
  }

  const scraped = await scrapeCarousel(url.trim());
  const imageUrls = scraped.slides.map((s) => s.imageUrl).filter(Boolean);
  const videoUrls = scraped.slides
    .map((s) => s.videoUrl)
    .filter((v): v is string => Boolean(v));

  return {
    platform: scraped.platform,
    sourceUrl: url.trim(),
    caption: scraped.caption,
    imageUrls,
    videoUrls,
  };
}
