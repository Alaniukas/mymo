import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isNiche } from "@/lib/carousel/niches";
import {
  communityTrendScore,
  type CommunitySort,
  type CommunityTemplate,
} from "@/lib/community/types";
import {
  isMissingCommunityTableError,
  seedTemplatesFromCode,
} from "@/lib/community/fallback-seed";

const SORTS: CommunitySort[] = ["trending", "new", "top"];

function sortTemplates(
  templates: CommunityTemplate[],
  sort: CommunitySort,
): CommunityTemplate[] {
  const copy = [...templates];
  if (sort === "new") {
    copy.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  } else if (sort === "top") {
    copy.sort((a, b) => b.upvote_count - a.upvote_count);
  } else {
    copy.sort((a, b) => communityTrendScore(b) - communityTrendScore(a));
  }
  return copy;
}

function buildStats(templates: CommunityTemplate[]) {
  if (templates.length === 0) {
    return { mostUpvoted: null, mostDownloaded: null, rising: null };
  }

  const used = new Set<string>();

  function pickUnique(sorted: CommunityTemplate[]): CommunityTemplate | null {
    for (const t of sorted) {
      if (!used.has(t.id)) {
        used.add(t.id);
        return t;
      }
    }
    return sorted[0] ?? null;
  }

  const mostUpvotedTpl = pickUnique(
    [...templates].sort((a, b) => b.upvote_count - a.upvote_count),
  );

  const mostDownloadedTpl = pickUnique(
    [...templates].sort((a, b) => b.download_count - a.download_count),
  );

  const risingTpl = pickUnique(
    [...templates].sort((a, b) => {
      const ratio = (t: CommunityTemplate) =>
        (t.upvote_count - t.downvote_count) /
        Math.max(t.upvote_count + t.downvote_count, 1);
      return ratio(b) - ratio(a) || communityTrendScore(b) - communityTrendScore(a);
    }),
  );

  return {
    mostUpvoted: mostUpvotedTpl
      ? {
          template: mostUpvotedTpl,
          metric: `${mostUpvotedTpl.upvote_count.toLocaleString()} upvotes`,
        }
      : null,
    mostDownloaded: mostDownloadedTpl
      ? {
          template: mostDownloadedTpl,
          metric: `${mostDownloadedTpl.download_count.toLocaleString()} downloads`,
        }
      : null,
    rising: risingTpl
      ? {
          template: risingTpl,
          metric: `${(risingTpl.upvote_count - risingTpl.downvote_count).toLocaleString()} net score`,
        }
      : null,
  };
}

function filterByNiche(
  templates: CommunityTemplate[],
  nicheParam: string | null,
): CommunityTemplate[] {
  if (nicheParam && isNiche(nicheParam)) {
    return templates.filter((t) => t.niche === nicheParam);
  }
  return templates;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const sortParam = searchParams.get("sort") ?? "trending";
  const sort: CommunitySort = SORTS.includes(sortParam as CommunitySort)
    ? (sortParam as CommunitySort)
    : "trending";
  const nicheParam = searchParams.get("niche");

  let query = supabase
    .from("community_templates")
    .select(
      "id, user_id, author_name, title, description, niche, slides, source_url, source_platform, upvote_count, downvote_count, download_count, is_seed, created_at",
    );

  if (nicheParam && isNiche(nicheParam)) {
    query = query.eq("niche", nicheParam);
  }

  const { data: templates, error } = await query;

  if (error) {
    if (isMissingCommunityTableError(error.message)) {
      const seeded = filterByNiche(seedTemplatesFromCode(), nicheParam);
      const sorted = sortTemplates(seeded, sort);
      return NextResponse.json({
        templates: sorted,
        stats: buildStats(seeded),
        fallback: true,
      });
    }
    console.error("[community/templates] GET error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: votes } = await supabase
    .from("community_template_votes")
    .select("template_id, vote")
    .eq("user_id", user.id);

  const voteMap = new Map(
    (votes ?? []).map((v) => [v.template_id, v.vote as 1 | -1]),
  );

  const withVotes = (templates ?? []).map((t) => ({
    ...t,
    user_vote: voteMap.get(t.id) ?? null,
  })) as CommunityTemplate[];

  const sorted = sortTemplates(withVotes, sort);

  return NextResponse.json({
    templates: sorted,
    stats: buildStats(withVotes),
    fallback: false,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, niche, slides, author_name } = body as {
    title?: string;
    description?: string;
    niche?: string;
    slides?: unknown[];
    author_name?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (!isNiche(niche)) {
    return NextResponse.json(
      { error: "A valid niche is required" },
      { status: 400 },
    );
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { error: "At least one slide is required" },
      { status: 400 },
    );
  }

  const displayName =
    author_name?.trim() ||
    user.email?.split("@")[0] ||
    "Anonymous";

  const { data, error } = await supabase
    .from("community_templates")
    .insert({
      user_id: user.id,
      author_name: displayName.slice(0, 40),
      title: title.trim().slice(0, 80),
      description: description?.trim().slice(0, 300) ?? null,
      niche,
      slides,
      is_seed: false,
    })
    .select(
      "id, user_id, author_name, title, description, niche, slides, source_url, source_platform, upvote_count, downvote_count, download_count, is_seed, created_at",
    )
    .single();

  if (error) {
    if (isMissingCommunityTableError(error.message)) {
      return NextResponse.json(
        {
          error:
            "Community templates database is not set up yet. Run migration 017_community_templates.sql in Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: { ...data, user_vote: null } });
}
