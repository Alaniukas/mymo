import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import {
  ensureWorkspace,
  parseBrandProfile,
  upsertAppIdentity,
} from "@/lib/carousel/brand-identity";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15_000);
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
    const { url, workspaceName } = body;
    const niche: NicheSlug | null = isNiche(body.niche) ? body.niche : null;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const workspace = await ensureWorkspace(supabase, user.id, {
      name: workspaceName || "My Workspace",
      niche,
      appUrl: url,
    });

    // Crawl the URL
    let rawText: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mymo-Bot/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      const html = await res.text();
      rawText = stripHtml(html);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch the URL. Check that it's accessible." },
        { status: 422 },
      );
    }

    if (rawText.length < 50) {
      return NextResponse.json(
        { error: "Could not extract enough text from this URL." },
        { status: 422 },
      );
    }

    const parsed = await parseBrandProfile(
      supabase,
      niche,
      `Website text content:\n\n${rawText}`,
    );

    const identity = await upsertAppIdentity(
      supabase,
      workspace.id,
      parsed,
      rawText,
    );

    return NextResponse.json({
      workspace_id: workspace.id,
      identity,
    });
  } catch (err) {
    console.error("[crawl] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
