import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateSlideCaptions,
  generateCaptionsForSlides,
} from "@/lib/carousel/prompts";
import type { BrandIdentity, GeneratedSlideRef } from "@/lib/carousel/prompts";
import { getModelSettings } from "@/lib/settings/service";
import { getUsableFramework } from "@/lib/carousel/frameworks";
import { resolveFramework } from "@/lib/carousel/inject";
import { brandProfileFromRow } from "@/lib/carousel/variables";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 15, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      carousel_id,
      combination_id,
      custom_topic,
      framework_id,
      platform = "instagram",
      slide_count = 5,
      imperfect = false,
    } = body;

    if (!carousel_id && !framework_id && !combination_id && !custom_topic) {
      return NextResponse.json(
        {
          error:
            "carousel_id, framework_id, combination_id, or custom_topic is required",
        },
        { status: 400 },
      );
    }

    const activeProjectId = await resolveActiveWorkspaceId(supabase, user.id);

    if (!activeProjectId) {
      return NextResponse.json(
        { error: "No project selected. Create a project first." },
        { status: 404 },
      );
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, app_url")
      .eq("id", activeProjectId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Select the whole row so the full Variable Dictionary is available; on an
    // un-migrated DB the extra columns are simply absent (mapped to null).
    const { data: identity } = await supabase
      .from("app_identities")
      .select("*")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .maybeSingle();

    if (!identity) {
      return NextResponse.json(
        { error: "No brand identity found. Complete onboarding first." },
        { status: 400 },
      );
    }

    const settings = await getModelSettings(supabase);

    // ── Multi-asset mode: caption the ALREADY-GENERATED slides of a carousel ──
    // The images were generated first (one per selected asset); here we write a
    // caption that fits each actual slide, to be edited then burned on.
    if (carousel_id) {
      const { data: carousel } = await supabase
        .from("carousels")
        .select("id, platform, title")
        .eq("id", carousel_id)
        .eq("workspace_id", workspace.id)
        .single();

      if (!carousel) {
        return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
      }

      type SlideRow = {
        position: number;
        prompt: string | null;
        image_url: string | null;
        status: string;
        role?: string | null;
      };

      // Tolerant select — role was added in migration 010.
      let slideRows: SlideRow[] = [];
      const withRole = await supabase
        .from("carousel_slides")
        .select("position, prompt, image_url, status, role")
        .eq("carousel_id", carousel_id)
        .order("position", { ascending: true });
      if (!withRole.error) {
        slideRows = (withRole.data ?? []) as SlideRow[];
      } else {
        const basic = await supabase
          .from("carousel_slides")
          .select("position, prompt, image_url, status")
          .eq("carousel_id", carousel_id)
          .order("position", { ascending: true });
        slideRows = (basic.data ?? []) as SlideRow[];
      }

      const completed = slideRows.filter(
        (s) => s.status === "completed" && s.image_url,
      );

      if (completed.length === 0) {
        return NextResponse.json(
          { error: "No generated slides are ready to caption yet." },
          { status: 400 },
        );
      }

      const total = completed.length;
      const brandIdentity: BrandIdentity = {
        brand_tone: identity.brand_tone,
        target_audience: identity.target_audience,
        value_propositions: identity.value_propositions,
        llm_summary: identity.llm_summary,
      };

      const refs: GeneratedSlideRef[] = completed.map((s, i) => ({
        position: s.position,
        role: s.role ?? (i === 0 ? "hook" : i === total - 1 ? "cta" : "value"),
        prompt: s.prompt,
        imageUrl: s.image_url,
      }));

      const captions = await generateCaptionsForSlides(
        brandIdentity,
        carousel.platform,
        refs,
        carousel.title ?? "",
        settings.text_model,
        Boolean(imperfect),
      );

      return NextResponse.json({ captions });
    }

    // ── Angle framework path: inject the Brain dictionary into the skeleton ──
    if (framework_id) {
      const framework = getUsableFramework(framework_id);
      if (!framework) {
        return NextResponse.json(
          { error: "Unknown or unavailable framework" },
          { status: 400 },
        );
      }

      const brand = brandProfileFromRow(identity, workspace.app_url);
      const resolved = await resolveFramework(framework, brand, {
        model: settings.text_model,
        imperfect: Boolean(imperfect),
      });

      return NextResponse.json({
        framework_id: framework.id,
        captions: resolved.slides,
        caption: resolved.caption,
        hashtags: resolved.hashtags,
        slide_count: resolved.slides.length,
      });
    }

    // ── Freeform path: a custom topic or an approved combination's caption ──
    let postCaption = custom_topic ?? "";

    if (combination_id) {
      const { data: combo } = await supabase
        .from("combinations")
        .select("caption")
        .eq("id", combination_id)
        .eq("workspace_id", workspace.id)
        .single();

      if (!combo) {
        return NextResponse.json({ error: "Combination not found" }, { status: 404 });
      }
      postCaption = combo.caption ?? postCaption;
    }

    if (!postCaption) {
      return NextResponse.json(
        { error: "No caption available." },
        { status: 400 },
      );
    }

    const brandIdentity: BrandIdentity = {
      brand_tone: identity.brand_tone,
      target_audience: identity.target_audience,
      value_propositions: identity.value_propositions,
      llm_summary: identity.llm_summary,
    };

    const captions = await generateSlideCaptions(
      brandIdentity,
      postCaption,
      platform,
      slide_count,
      settings.text_model,
      Boolean(imperfect),
    );

    return NextResponse.json({ captions });
  } catch (error) {
    console.error("[generate-slide-captions] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
