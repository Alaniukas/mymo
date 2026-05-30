import { NextRequest, NextResponse } from "next/server";
import { searchMemeTemplates } from "@/lib/meme/memegen-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const templates = await searchMemeTemplates(q, Math.min(limit, 24));
    return NextResponse.json({
      provider: "memegen.link",
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        lines: t.lines,
        keywords: t.keywords,
        preview_url: t.exampleUrl ?? t.blankUrl,
        blank_url: t.blankUrl,
      })),
    });
  } catch (err) {
    console.error("[meme/templates]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load memes" },
      { status: 502 },
    );
  }
}
