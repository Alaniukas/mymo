import type { NicheSlug } from "@/lib/carousel/niches";

export interface CommunityTemplateSlide {
  position: number;
  image_url: string;
  storage_path: string;
  media_type?: "image" | "video";
  video_url?: string | null;
  video_storage_path?: string | null;
}

export interface CommunityTemplate {
  id: string;
  user_id: string | null;
  author_name: string;
  title: string;
  description: string | null;
  niche: NicheSlug;
  slides: CommunityTemplateSlide[];
  source_url: string | null;
  source_platform: string | null;
  upvote_count: number;
  downvote_count: number;
  download_count: number;
  is_seed: boolean;
  created_at: string;
  user_vote?: 1 | -1 | null;
}

export type CommunitySort = "trending" | "new" | "top";

export function communityTrendScore(t: Pick<
  CommunityTemplate,
  "upvote_count" | "downvote_count" | "download_count"
>): number {
  return t.upvote_count - t.downvote_count + t.download_count * 2;
}
