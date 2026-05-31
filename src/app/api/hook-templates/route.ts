import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedHookTemplates } from "@/lib/hook-templates/service";
import type { HookTemplateKind } from "@/lib/hook-templates/types";

const VALID_KINDS: HookTemplateKind[] = ["premade", "template"];

/** Browser + CDN cache for published hook lists (auth still required). */
const LIST_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=600";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind =
    kindParam && VALID_KINDS.includes(kindParam as HookTemplateKind)
      ? (kindParam as HookTemplateKind)
      : null;

  try {
    const templates = await getPublishedHookTemplates(supabase, kind);
    return NextResponse.json(
      { templates },
      { headers: { "Cache-Control": LIST_CACHE_CONTROL } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load hooks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
