/**
 * Social URL detection — post links vs profile links.
 */
export type SocialProfilePlatform =
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "facebook";

export type ScrapedPlatform = "instagram" | "tiktok";

function parseUrl(url: string): { hostname: string; pathname: string } | null {
  try {
    const u = new URL(url.trim());
    return { hostname: u.hostname.toLowerCase(), pathname: u.pathname.toLowerCase() };
  } catch {
    return null;
  }
}

/** Returns IG/TikTok for a single **post** URL (template import, carousel scrape). */
export function detectPlatform(url: string): ScrapedPlatform | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const { hostname, pathname } = parsed;

  if (hostname.includes("instagram.com")) {
    if (
      pathname.includes("/p/") ||
      pathname.includes("/reel/") ||
      pathname.includes("/tv/")
    ) {
      return "instagram";
    }
  }
  if (hostname.includes("tiktok.com")) {
    if (
      pathname.includes("/video/") ||
      pathname.includes("/photo/") ||
      pathname.includes("/t/")
    ) {
      return "tiktok";
    }
  }
  return null;
}

/** Profile / page URL for bulk post import. */
export function detectSocialProfilePlatform(
  url: string,
): SocialProfilePlatform | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const { hostname, pathname } = parsed;

  if (hostname.includes("instagram.com")) {
    if (pathname.includes("/p/") || pathname.includes("/reel/")) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 1 && !["explore", "accounts", "direct"].includes(segments[0]!)) {
      return "instagram";
    }
  }
  if (hostname.includes("tiktok.com")) {
    if (pathname.includes("/video/")) return null;
    if (pathname.startsWith("/@")) return "tiktok";
  }
  if (hostname.includes("linkedin.com")) {
    if (pathname.includes("/in/") || pathname.includes("/company/")) {
      return "linkedin";
    }
  }
  if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
    return "facebook";
  }
  return null;
}

export function isProfileScrapeSupported(
  platform: SocialProfilePlatform,
): platform is ScrapedPlatform {
  return platform === "instagram" || platform === "tiktok";
}
