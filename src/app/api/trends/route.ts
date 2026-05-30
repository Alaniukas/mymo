import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getTrendingSounds, isTrendsConfigured } from "@/lib/trends/service";

export async function GET(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No data source configured yet — tell the client so it can show a setup hint
  // rather than an error. Never fabricate trend data.
  if (!isTrendsConfigured()) {
    return NextResponse.json({ configured: false, keyword: "", sounds: [] });
  }

  const keyword = (request.nextUrl.searchParams.get("keyword") ?? "").trim();
  if (!keyword) {
    return NextResponse.json(
      { error: "A keyword is required to search trends." },
      { status: 400 },
    );
  }

  try {
    const sounds = await getTrendingSounds(keyword);
    return NextResponse.json({ configured: true, keyword, sounds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load trends";
    console.error("[trends] error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
