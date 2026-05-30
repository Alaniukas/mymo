import {
  SEED_TEMPLATES,
  seedSlidesJson,
} from "@/lib/community/seed-templates";
import type { CommunityTemplate } from "@/lib/community/types";

/** In-memory seed templates when DB migration is not applied yet. */
export function seedTemplatesFromCode(): CommunityTemplate[] {
  const base = new Date("2026-01-15T12:00:00.000Z").getTime();

  return SEED_TEMPLATES.map((s, i) => ({
    id: s.id,
    user_id: null,
    author_name: s.author_name,
    title: s.title,
    description: s.description,
    niche: s.niche,
    slides: seedSlidesJson(s.slug, s.slideLabels.length),
    source_url: null,
    source_platform: null,
    upvote_count: s.upvote_count,
    downvote_count: s.downvote_count,
    download_count: s.download_count,
    is_seed: true,
    created_at: new Date(base - i * 86400000).toISOString(),
    user_vote: null,
  }));
}

export function isMissingCommunityTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("community_templates") &&
    (lower.includes("does not exist") ||
      lower.includes("could not find") ||
      lower.includes("schema cache"))
  );
}
