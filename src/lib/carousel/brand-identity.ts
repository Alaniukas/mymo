// Shared brand "Brain" (app_identities) helpers.
//
// The crawl route and the brand quiz route both turn a blob of source text
// into the structured Variable Dictionary and persist it. This module owns that
// shared pipeline — LLM parse, jsonb normalization, graceful-degradation upsert,
// and get-or-create workspace — so neither caller duplicates the logic.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { getModelSettings } from "@/lib/settings/service";
import { buildBrandPrompt } from "@/lib/carousel/brand-prompt";
import type { NicheSlug } from "@/lib/carousel/niches";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export interface ParsedBrand {
  app_name?: string;
  app_category?: string;
  app_tagline?: string;
  brand_tone?: string;
  target_audience?: string;
  social_handle?: string;
  value_propositions?: string[];
  core_problem?: string;
  key_outcome?: string;
  features?: { name?: string; benefit?: string }[];
  competitor_name?: string;
  competitor_weakness?: string;
  user_quotes?: { quote?: string; name?: string; title?: string }[];
  metric_result?: string;
  cta_text?: string;
  brand_color?: string;
  product_terminology?: Record<string, string>;
  brand_dna?: string;
  summary?: string;
}

export type AppIdentityRow = Record<string, unknown>;

// Coerce the LLM output into the dictionary's persisted shapes, dropping
// malformed list entries so we never store junk in the jsonb columns.
function normalizeFeatures(raw: unknown): { name: string; benefit: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => ({
      name: typeof f?.name === "string" ? f.name.trim() : "",
      benefit: typeof f?.benefit === "string" ? f.benefit.trim() : "",
    }))
    .filter((f) => f.name);
}

function normalizeQuotes(
  raw: unknown,
): { quote: string; name: string; title: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => ({
      quote: typeof q?.quote === "string" ? q.quote.trim() : "",
      name: typeof q?.name === "string" ? q.name.trim() : "",
      title: typeof q?.title === "string" ? q.title.trim() : "",
    }))
    .filter((q) => q.quote);
}

// The original five fields — the only ones guaranteed to exist before
// migration 009. Used as the fallback payload on an un-migrated database.
function coreIdentityData(
  workspaceId: string,
  parsed: ParsedBrand,
  rawText: string,
) {
  return {
    workspace_id: workspaceId,
    brand_tone: parsed.brand_tone || "",
    target_audience: parsed.target_audience || "",
    value_propositions: parsed.value_propositions || [],
    product_terminology: parsed.product_terminology || {},
    raw_crawl_text: rawText.slice(0, 5000),
    llm_summary: parsed.summary || "",
  };
}

// Full dictionary payload (requires migration 009).
function fullIdentityData(
  workspaceId: string,
  parsed: ParsedBrand,
  rawText: string,
) {
  return {
    ...coreIdentityData(workspaceId, parsed, rawText),
    app_name: parsed.app_name || "",
    app_category: parsed.app_category || "",
    app_tagline: parsed.app_tagline || "",
    social_handle: parsed.social_handle || "",
    core_problem: parsed.core_problem || "",
    key_outcome: parsed.key_outcome || "",
    features: normalizeFeatures(parsed.features),
    competitor_name: parsed.competitor_name || "",
    competitor_weakness: parsed.competitor_weakness || "",
    user_quotes: normalizeQuotes(parsed.user_quotes),
    metric_result: parsed.metric_result || "",
    cta_text: parsed.cta_text || "",
    brand_color: parsed.brand_color || "",
    brand_dna: parsed.brand_dna || "",
  };
}

// Drops empty strings / arrays / objects so a merge update never overwrites an
// existing value with a blank the LLM couldn't determine.
function pruneEmpty(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as object).length === 0
    )
      continue;
    out[key] = value;
  }
  return out;
}

/**
 * Runs the brand-analysis LLM over arbitrary source text and returns the parsed
 * Variable Dictionary. Throws on an empty completion so callers can surface a
 * retryable error.
 */
export async function parseBrandProfile(
  supabase: SupabaseClient,
  niche: NicheSlug | null,
  sourceText: string,
): Promise<ParsedBrand> {
  const settings = await getModelSettings(supabase);
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: settings.text_model,
    temperature: 0.3,
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: buildBrandPrompt(niche) },
      { role: "user", content: sourceText },
    ],
    response_format: { type: "json_object" },
  });

  const content = extractMessageText(completion);
  if (!content) {
    throw new Error("Brand analysis returned empty content. Try again.");
  }
  return JSON.parse(content) as ParsedBrand;
}

/**
 * Persists a parsed brand profile to app_identities for a workspace.
 *
 * - `mode: "replace"` (default) writes the full payload, matching the crawl's
 *   "this is the source of truth" behavior.
 * - `mode: "merge"` only writes the fields the parse actually produced, so a
 *   sparse quiz refines an existing (e.g. crawled) profile instead of wiping it.
 *
 * Degrades gracefully: if a dictionary column is missing (migration 009 not
 * applied) it retries with just the original five fields.
 */
export async function upsertAppIdentity(
  supabase: SupabaseClient,
  workspaceId: string,
  parsed: ParsedBrand,
  rawText: string,
  opts: { mode?: "replace" | "merge" } = {},
): Promise<AppIdentityRow> {
  const mode = opts.mode ?? "replace";

  const { data: existing } = await supabase
    .from("app_identities")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  const upsert = async (data: Record<string, unknown>) => {
    if (existing) {
      const payload = mode === "merge" ? pruneEmpty(data) : data;
      return supabase
        .from("app_identities")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
    }
    return supabase.from("app_identities").insert(data).select().single();
  };

  let { data: identity, error } = await upsert(
    fullIdentityData(workspaceId, parsed, rawText),
  );

  if (error) {
    ({ data: identity, error } = await upsert(
      coreIdentityData(workspaceId, parsed, rawText),
    ));
    if (error) throw error;
  }

  return identity as AppIdentityRow;
}

/**
 * Creates a brand-new project (workspace) for the user. Niche writes degrade
 * gracefully when the `niche` column is missing (migration 012 not applied).
 */
export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  opts: { name?: string; niche?: NicheSlug | null; appUrl?: string } = {},
): Promise<{ id: string }> {
  const hasNiche = opts.niche != null;

  const base: Record<string, unknown> = {
    user_id: userId,
    name: opts.name?.trim() || "Untitled project",
  };
  if (opts.appUrl !== undefined) base.app_url = opts.appUrl;

  let { data: created, error } = await supabase
    .from("workspaces")
    .insert(hasNiche ? { ...base, niche: opts.niche } : base)
    .select("id")
    .single();

  if (error && hasNiche) {
    ({ data: created, error } = await supabase
      .from("workspaces")
      .insert(base)
      .select("id")
      .single());
  }

  if (error || !created) {
    throw error ?? new Error("Failed to create project.");
  }
  return created;
}

/**
 * Resolves the workspace a content mutation should target: the user's *active*
 * project (see lib/workspace/active). Only the provided mutable fields are
 * written, so callers without a URL (e.g. the quiz) never clobber an existing
 * `app_url`. Niche writes degrade gracefully when the `niche` column is missing
 * (migration 012 not applied). When the user has no project yet, their first
 * one is created so the very first crawl/quiz still works end to end.
 */
export async function ensureWorkspace(
  supabase: SupabaseClient,
  userId: string,
  opts: { name?: string; niche?: NicheSlug | null; appUrl?: string } = {},
): Promise<{ id: string }> {
  const hasNiche = opts.niche != null;
  const activeId = await resolveActiveWorkspaceId(supabase, userId);

  if (activeId) {
    const base: Record<string, unknown> = {};
    if (opts.appUrl !== undefined) base.app_url = opts.appUrl;

    if (Object.keys(base).length > 0 || hasNiche) {
      const { error } = await supabase
        .from("workspaces")
        .update(hasNiche ? { ...base, niche: opts.niche } : base)
        .eq("id", activeId);
      if (error && hasNiche) {
        await supabase.from("workspaces").update(base).eq("id", activeId);
      }
    }
    return { id: activeId };
  }

  return createProject(supabase, userId, opts);
}
