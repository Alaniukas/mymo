import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import {
  ensureWorkspace,
  parseBrandProfile,
  upsertAppIdentity,
  type ParsedBrand,
} from "@/lib/carousel/brand-identity";
import { extractPageAssets } from "@/lib/carousel/page-assets";
import { importPageAssetsToWorkspace } from "@/lib/carousel/import-page-assets";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15_000);
}

function normalizeCrawlUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mergeExtractedBrandFields(
  parsed: ParsedBrand,
  extracted: { logoUrl: string | null; brandColor: string | null },
  importedLogoUrl: string | null,
): ParsedBrand {
  const next = { ...parsed };
  if (!next.brand_color?.trim() && extracted.brandColor) {
    next.brand_color = extracted.brandColor;
  }
  const logo = importedLogoUrl || extracted.logoUrl;
  if (!next.logo_url?.trim() && logo) {
    next.logo_url = logo;
  }
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceName } = body;
    const niche: NicheSlug | null = isNiche(body.niche) ? body.niche : null;

    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const url = normalizeCrawlUrl(body.url);

    const workspace = await ensureWorkspace(supabase, user.id, {
      name: workspaceName || "My Workspace",
      niche,
      appUrl: url,
    });

    let html: string;
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Could not fetch the URL (HTTP ${res.status}).` },
          { status: 422 },
        );
      }
      html = await res.text();
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch the URL. Check that it's accessible." },
        { status: 422 },
      );
    }

    const rawText = stripHtml(html);
    if (rawText.length < 50) {
      return NextResponse.json(
        { error: "Could not extract enough text from this URL." },
        { status: 422 },
      );
    }

    const pageAssets = extractPageAssets(html, url);

    const parsed = await parseBrandProfile(
      supabase,
      niche,
      `Website text content:\n\n${rawText}${pageAssets.assetHints}`,
    );

    const imported = await importPageAssetsToWorkspace(
      supabase,
      workspace.id,
      pageAssets,
      niche,
    );

    const merged = mergeExtractedBrandFields(
      parsed,
      pageAssets,
      imported.logoUrl,
    );

    const identity = await upsertAppIdentity(
      supabase,
      workspace.id,
      merged,
      rawText,
    );

    return NextResponse.json({
      workspace_id: workspace.id,
      identity,
      assets_imported: {
        count: imported.assets.length,
        logo_url: imported.logoUrl ?? merged.logo_url ?? null,
        brand_color: imported.brandColor ?? merged.brand_color ?? null,
        preview_urls: imported.assets.slice(0, 6).map((a) => a.public_url),
      },
    });
  } catch (err) {
    console.error("[crawl] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
