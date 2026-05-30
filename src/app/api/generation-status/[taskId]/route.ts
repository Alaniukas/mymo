import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkTaskStatus, EvolinkError } from "@/lib/evolink/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { taskId } = await params;

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 },
    );
  }

  try {
    const task = await checkTaskStatus(taskId);

    let status: "pending" | "processing" | "done" | "error";
    if (task.status === "completed") status = "done";
    else if (task.status === "failed") status = "error";
    else status = task.status;

    return NextResponse.json({
      status,
      progress: status === "done" ? 100 : (task.progress ?? 0),
      resultUrl: task.results?.[0] ?? null,
      results: task.results ?? null,
      model: task.model,
      error:
        status === "error"
          ? {
              code: task.error?.code ?? "unknown_error",
              message: task.error?.message ?? "Generation failed",
            }
          : null,
    });
  } catch (error) {
    if (error instanceof EvolinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[generation-status] unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 },
    );
  }
}
