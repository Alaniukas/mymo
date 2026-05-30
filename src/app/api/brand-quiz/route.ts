import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import {
  ensureWorkspace,
  parseBrandProfile,
  upsertAppIdentity,
} from "@/lib/carousel/brand-identity";

interface QuizResponse {
  prompt: string;
  value: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Accepts the niche-aware quiz shape (`answers` is an array of { prompt, value })
// and degrades to the legacy object shape ({ brandName, offer, audience, story })
// so older clients keep working.
function normalizeResponses(body: unknown): QuizResponse[] {
  const answers = (body as { answers?: unknown })?.answers;

  if (Array.isArray(answers)) {
    return answers
      .map((r) => ({
        prompt: clean((r as QuizResponse)?.prompt),
        value: clean((r as QuizResponse)?.value),
      }))
      .filter((r) => r.value.length > 0);
  }

  const legacy = (answers ?? {}) as Record<string, unknown>;
  return [
    { prompt: "Brand / product name", value: clean(legacy.brandName) },
    { prompt: "What they offer", value: clean(legacy.offer) },
    { prompt: "Who it's for", value: clean(legacy.audience) },
    { prompt: "In their own words", value: clean(legacy.story) },
  ].filter((r) => r.value.length > 0);
}

// Frame the answers as first-party input so the model trusts them over the
// scraped marketing copy a later crawl might add. Long / multi-line answers get
// their own block; short ones stay inline.
function buildQuizSourceText(responses: QuizResponse[]): string {
  const lines = responses.map((r) => {
    const block = r.value.includes("\n") || r.value.length > 80;
    return block ? `${r.prompt}:\n${r.value}` : `${r.prompt}: ${r.value}`;
  });

  return [
    "The following details were provided directly by the brand owner in a short guided quiz. Treat them as authoritative.",
    lines.join("\n"),
  ].join("\n\n");
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
    const niche: NicheSlug | null = isNiche(body.niche) ? body.niche : null;
    const responses = normalizeResponses(body);

    if (responses.length === 0) {
      return NextResponse.json(
        { error: "Answer at least one question so we can build your profile." },
        { status: 400 },
      );
    }

    const workspace = await ensureWorkspace(supabase, user.id, { niche });

    const sourceText = buildQuizSourceText(responses);
    const parsed = await parseBrandProfile(supabase, niche, sourceText);

    // Merge so the quiz refines an existing (e.g. crawled) profile rather than
    // wiping fields the answers didn't touch.
    const identity = await upsertAppIdentity(
      supabase,
      workspace.id,
      parsed,
      sourceText,
      { mode: "merge" },
    );

    return NextResponse.json({
      workspace_id: workspace.id,
      identity,
    });
  } catch (err) {
    console.error("[brand-quiz] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
