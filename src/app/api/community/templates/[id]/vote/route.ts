import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  isMissingCommunityTableError,
  seedTemplatesFromCode,
} from "@/lib/community/fallback-seed";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const vote = body.vote as number | undefined;
  const currentUp = body.current_upvote_count as number | undefined;
  const currentDown = body.current_downvote_count as number | undefined;
  const currentUserVote = body.current_user_vote as 1 | -1 | null | undefined;

  if (vote !== 1 && vote !== -1 && vote !== 0) {
    return NextResponse.json(
      { error: "vote must be 1, -1, or 0" },
      { status: 400 },
    );
  }

  const { data: template, error: tplErr } = await supabase
    .from("community_templates")
    .select("id")
    .eq("id", id)
    .single();

  if (tplErr) {
    if (isMissingCommunityTableError(tplErr.message)) {
      const seed = seedTemplatesFromCode().find((t) => t.id === id);
      if (!seed) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      let up = currentUp ?? seed.upvote_count;
      let down = currentDown ?? seed.downvote_count;
      let userVote = currentUserVote ?? null;

      if (userVote === 1) up--;
      if (userVote === -1) down--;

      if (vote === 0) {
        userVote = null;
      } else if (userVote === vote) {
        userVote = null;
      } else {
        if (vote === 1) up++;
        if (vote === -1) down++;
        userVote = vote as 1 | -1;
      }

      return NextResponse.json({
        upvote_count: up,
        downvote_count: down,
        user_vote: userVote,
        fallback: true,
      });
    }
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("community_template_votes")
    .select("id, vote")
    .eq("template_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (vote === 0) {
    if (existing) {
      await supabase
        .from("community_template_votes")
        .delete()
        .eq("id", existing.id);
    }
  } else if (existing) {
    if (existing.vote === vote) {
      await supabase
        .from("community_template_votes")
        .delete()
        .eq("id", existing.id);
    } else {
      await supabase
        .from("community_template_votes")
        .update({ vote })
        .eq("id", existing.id);
    }
  } else {
    await supabase.from("community_template_votes").insert({
      template_id: id,
      user_id: user.id,
      vote,
    });
  }

  const { data: updated } = await supabase
    .from("community_templates")
    .select("upvote_count, downvote_count")
    .eq("id", id)
    .single();

  const { data: userVoteRow } = await supabase
    .from("community_template_votes")
    .select("vote")
    .eq("template_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    upvote_count: updated?.upvote_count ?? 0,
    downvote_count: updated?.downvote_count ?? 0,
    user_vote: (userVoteRow?.vote as 1 | -1 | undefined) ?? null,
    fallback: false,
  });
}
