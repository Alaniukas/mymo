import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Browser-like UA — some CDNs (Instagram/TikTok) reject requests without one.
 * Harmless for first-party URLs (e.g. EvoLink results).
 */
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/**
 * Downloads a remote media URL into a Buffer with the same browser-like UA used
 * for re-uploads. Returns null on any network/HTTP failure so callers can
 * degrade gracefully (e.g. render a slideshow without its audio track).
 */
export async function fetchMediaBuffer(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) {
      console.warn(`[carousel/storage] media download failed (${res.status}) for ${url}`);
      return null;
    }
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  } catch (err) {
    console.warn("[carousel/storage] media download error:", err);
    return null;
  }
}

export type ReuploadResult =
  | { ok: true; publicUrl: string; storagePath: string }
  | { ok: false; reason: "download" | "upload" };

/**
 * Optional post-download transform — e.g. burning a text overlay onto the
 * downloaded bytes before they are uploaded. Returning a new buffer/contentType
 * lets callers change the stored format (e.g. JPEG source → PNG overlay).
 */
export type ReuploadTransform = (input: {
  buffer: Buffer;
  contentType: string;
}) => Promise<{ buffer: Buffer; contentType: string }>;

/**
 * Downloads an image from a source URL and re-uploads it to a public storage
 * bucket (default `carousels`) so the app owns a stable, long-lived URL. An
 * optional `transform` can rewrite the bytes (e.g. compositing a caption) just
 * before upload; if it throws, the original bytes are stored instead.
 *
 * Returns a discriminated result so callers can distinguish a failed download
 * (source unreachable) from a failed upload (storage issue) and react
 * accordingly — e.g. fall back to the source URL, or skip the slide.
 */
export async function reuploadImage(
  supabase: ServerSupabaseClient,
  sourceUrl: string,
  storagePath: string,
  bucket = "carousels",
  options?: { transform?: ReuploadTransform },
): Promise<ReuploadResult> {
  let buffer: Buffer;
  let contentType: string;
  try {
    const res = await fetch(sourceUrl, { headers: FETCH_HEADERS });
    if (!res.ok) {
      console.warn(`[carousel/storage] download failed (${res.status}) for ${sourceUrl}`);
      return { ok: false, reason: "download" };
    }
    buffer = Buffer.from(await res.arrayBuffer());
    contentType = res.headers.get("content-type") || "image/jpeg";
  } catch (err) {
    console.warn("[carousel/storage] download error:", err);
    return { ok: false, reason: "download" };
  }

  if (options?.transform) {
    try {
      const out = await options.transform({ buffer, contentType });
      buffer = out.buffer;
      contentType = out.contentType;
    } catch (err) {
      console.warn("[carousel/storage] transform failed, storing original:", err);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, new Blob([new Uint8Array(buffer)], { type: contentType }), {
      contentType: contentType || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.warn("[carousel/storage] upload error:", uploadError);
    return { ok: false, reason: "upload" };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { ok: true, publicUrl: data.publicUrl, storagePath };
}
