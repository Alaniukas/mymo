import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidModel, buildImagePayload } from "@/lib/evolink/models";
import { submitImageGeneration, EvolinkError } from "@/lib/evolink/client";

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { model, prompt, size, quality, resolution, n, image_urls } = body;

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { error: "model is required" },
        { status: 400 },
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    if (!isValidModel(model)) {
      return NextResponse.json(
        { error: `Unsupported model: ${model}` },
        { status: 400 },
      );
    }

    const { payload, errors } = buildImagePayload(model, prompt, {
      size,
      quality,
      resolution,
      n,
      image_urls,
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join("; ") },
        { status: 400 },
      );
    }

    const task = await submitImageGeneration(payload);

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      model: task.model,
    });
  } catch (error) {
    if (error instanceof EvolinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[generate-image] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
