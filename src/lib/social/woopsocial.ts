// WoopSocial REST client.
//
// WoopSocial is the single managed publishing backend: it owns the per-platform
// OAuth apps and the publishing pipeline, so the app holds one API key and stores
// a reference to each connected social account. Docs: https://docs.woopsocial.com

const DEFAULT_BASE_URL = "https://api.woopsocial.com/v1";

function baseUrl(): string {
  return process.env.WOOPSOCIAL_BASE_URL || DEFAULT_BASE_URL;
}

function apiKey(): string {
  const key = process.env.WOOPSOCIAL_API_KEY;
  if (!key) throw new Error("WOOPSOCIAL_API_KEY is not configured");
  return key;
}

export function isWoopSocialConfigured(): boolean {
  return Boolean(process.env.WOOPSOCIAL_API_KEY);
}

/** Public base URL of this app, used to build OAuth redirect URLs. */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

export type AppPlatform =
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "linkedin_pages"
  | "facebook"
  | "x"
  | "youtube"
  | "pinterest";

export type WoopPlatform =
  | "INSTAGRAM"
  | "TIKTOK"
  | "LINKEDIN"
  | "LINKEDIN_PAGES"
  | "FACEBOOK"
  | "X"
  | "YOUTUBE"
  | "PINTEREST"
  | "WOOPTEST";

const APP_TO_WOOP: Record<AppPlatform, WoopPlatform> = {
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
  linkedin: "LINKEDIN",
  linkedin_pages: "LINKEDIN_PAGES",
  facebook: "FACEBOOK",
  x: "X",
  youtube: "YOUTUBE",
  pinterest: "PINTEREST",
};

const WOOP_TO_APP = Object.fromEntries(
  Object.entries(APP_TO_WOOP).map(([app, woop]) => [woop, app]),
) as Record<WoopPlatform, AppPlatform>;

export function toWoopPlatform(p: AppPlatform): WoopPlatform {
  return APP_TO_WOOP[p];
}

export function fromWoopPlatform(p: string): AppPlatform | null {
  return WOOP_TO_APP[p as WoopPlatform] ?? null;
}

/** Platforms exposed in the UI for connecting + publishing image carousels. */
export const SUPPORTED_PLATFORMS: AppPlatform[] = [
  "linkedin",
  "linkedin_pages",
  "instagram",
  "facebook",
  "tiktok",
  "x",
];

export function isSupportedPlatform(p: string): p is AppPlatform {
  return (SUPPORTED_PLATFORMS as string[]).includes(p);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function extractError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.validationErrors) && d.validationErrors.length) {
      const first = d.validationErrors[0] as { message?: string };
      if (first?.message) return first.message;
    }
    if (typeof d.message === "string") return d.message;
  }
  if (typeof data === "string" && data) return data;
  return `WoopSocial request failed (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, ...(init?.headers ?? {}) },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) throw new Error(extractError(data, res.status));
  return data as T;
}

// ---------------------------------------------------------------------------
// Projects & accounts
// ---------------------------------------------------------------------------

export interface WoopProject {
  id: string;
  name: string;
}

export interface WoopSocialAccount {
  id: string;
  externalAccountId: string;
  platform: WoopPlatform;
  username: string;
  imageUrl: string;
  status: "CONNECTED" | "DISCONNECTED";
}

export function listProjects(): Promise<WoopProject[]> {
  return request<WoopProject[]>("/projects");
}

export function createProject(name: string): Promise<WoopProject> {
  return request<WoopProject>("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function createAuthorizationUrl(input: {
  projectId: string;
  platform: WoopPlatform;
  redirectUrl?: string;
}): Promise<{ url: string }> {
  return request<{ url: string }>("/social-accounts/authorization-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listSocialAccounts(
  projectId?: string,
): Promise<WoopSocialAccount[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return request<WoopSocialAccount[]>(`/social-accounts${qs}`);
}

export function deleteSocialAccount(id: string): Promise<unknown> {
  return request(`/social-accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

function filenameFromUrl(url: string, contentType: string): string {
  try {
    const last = new URL(url).pathname.split("/").pop();
    if (last && last.includes(".")) return last;
  } catch {
    // fall through to content-type based name
  }
  const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
  return `slide.${ext}`;
}

async function uploadMediaBlob(
  projectId: string,
  blob: Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", blob, filename);

  const data = await request<{ mediaId: string }>(
    `/media?projectId=${encodeURIComponent(projectId)}`,
    { method: "POST", body: form },
  );
  return data.mediaId;
}

/** Downloads a publicly accessible asset and uploads it to the media library. */
export async function uploadMediaFromUrl(
  projectId: string,
  url: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch media for upload (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const blob = new Blob([await res.arrayBuffer()], { type: contentType });
  return uploadMediaBlob(projectId, blob, filenameFromUrl(url, contentType));
}

/** Uploads in-memory bytes (e.g. a freshly rendered video) to the media library. */
export async function uploadMediaFromBuffer(
  projectId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  return uploadMediaBlob(projectId, blob, filename);
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export type PostSchedule =
  | { type: "DRAFT" }
  | { type: "PUBLISH_NOW" }
  | { type: "SCHEDULE_FOR_LATER"; scheduledFor: string };

interface MediaRef {
  type: "MEDIA_LIBRARY";
  mediaId: string;
}

export interface CreatePostBody {
  content: Array<{ text?: string; media?: MediaRef[] }>;
  schedule: PostSchedule;
  socialAccounts: Array<Record<string, unknown>>;
}

/** Whether a post carries still images (carousel) or a single combined video. */
export type MediaKind = "image" | "video";

export interface SocialAccountOptions {
  /**
   * TikTok only: let TikTok auto-add a recommended (trending) track to the
   * photo post. This is the only music control the publishing API exposes —
   * a specific viral sound can't be attached programmatically. Defaults to true.
   */
  autoAddMusic?: boolean;
  /** Image carousel vs. single video — selects the platform's post type. */
  kind?: MediaKind;
}

/**
 * Returns the platform-specific required fields for a single-account post.
 * Video carousels publish as one combined clip, so they use each platform's
 * video post type (Instagram Reel, TikTok Video, Facebook Video); image
 * carousels use the multi-photo post type as before.
 */
export function buildSocialAccountInput(
  platform: WoopPlatform,
  socialAccountId: string,
  options: SocialAccountOptions = {},
): Record<string, unknown> {
  const base = { platform, socialAccountId };
  const isVideo = options.kind === "video";
  switch (platform) {
    case "LINKEDIN":
    case "LINKEDIN_PAGES":
    case "X":
      return base;
    case "INSTAGRAM":
      return { ...base, postType: isVideo ? "REEL" : "POST" };
    case "FACEBOOK":
      return { ...base, postType: isVideo ? "VIDEO" : "IMAGE" };
    case "TIKTOK":
      return {
        ...base,
        postType: isVideo ? "VIDEO" : "PHOTO",
        privacyLevel: "PUBLIC_TO_EVERYONE",
        allowComment: true,
        allowDuet: false,
        allowStitch: false,
        isYourBrand: false,
        isBrandedContent: false,
        autoAddMusic: options.autoAddMusic ?? true,
      };
    default:
      throw new Error(`Publishing to ${platform} is not supported yet.`);
  }
}

export function buildMediaPostBody(input: {
  platform: WoopPlatform;
  socialAccountId: string;
  caption: string;
  mediaIds: string[];
  kind?: MediaKind;
  schedule?: PostSchedule;
  autoAddMusic?: boolean;
}): CreatePostBody {
  return {
    content: [
      {
        text: input.caption,
        media: input.mediaIds.map((mediaId) => ({
          type: "MEDIA_LIBRARY" as const,
          mediaId,
        })),
      },
    ],
    schedule: input.schedule ?? { type: "PUBLISH_NOW" },
    socialAccounts: [
      buildSocialAccountInput(input.platform, input.socialAccountId, {
        autoAddMusic: input.autoAddMusic,
        kind: input.kind,
      }),
    ],
  };
}

export interface ValidatePostResult {
  isValid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
}

export function validatePost(body: CreatePostBody): Promise<ValidatePostResult> {
  return request<ValidatePostResult>("/posts/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface WoopSocialAccountPost {
  socialAccountPostId: string;
  deliveryStatus: "NOT_STARTED" | "SENDING" | "PUBLISHED" | "FAILED";
  externalPostId?: string;
  externalPostUrl?: string;
  errorMessage?: string;
}

export interface WoopPost {
  id: string;
  projectId: string;
  socialAccountPosts: WoopSocialAccountPost[];
}

export function createPost(body: CreatePostBody): Promise<WoopPost> {
  return request<WoopPost>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
