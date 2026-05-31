export type HookTemplateKind = "premade" | "template";

export interface HookTemplate {
  id: string;
  title: string;
  hook_line: string;
  creator_prompt: string;
  motion_prompt: string;
  preview_image_url: string | null;
  preview_video_url: string | null;
  kind: HookTemplateKind;
  published: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface HookTemplateInput {
  title: string;
  hook_line: string;
  creator_prompt: string;
  motion_prompt: string;
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  kind: HookTemplateKind;
  published?: boolean;
  sort_order?: number;
}
