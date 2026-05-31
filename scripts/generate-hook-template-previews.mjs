/**
 * Generates preview videos for hook_templates rows that lack preview_video_url.
 * Uses EvoLink: Nano Banana 2 (image) + Seedance 1.5 Pro (image-to-video).
 *
 * Usage: node --env-file=.env scripts/generate-hook-template-previews.mjs
 * Optional: node --env-file=.env scripts/generate-hook-template-previews.mjs --force
 */
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.EVOLINK_BASE_URL || "https://api.evolink.ai/v1";
const API_KEY = process.env.EVOLINK_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const VIDEO_MODEL = "seedance-1.5-pro";
const FORCE = process.argv.includes("--force");

function buildHookImagePrompt(creatorPrompt) {
  return [
    "Ultra-realistic, photorealistic vertical 9:16 portrait of a real young woman looking at the camera, like authentic UGC filmed on a modern phone's front camera.",
    `Creator: ${creatorPrompt}.`,
    "Natural skin texture, realistic lighting, candid and believable — not a glossy studio model shot.",
    "Silent emotional reaction — mouth relaxed and closed, NOT mid-speech, NOT talking, NOT lip-syncing. Framed head-and-shoulders for a vertical phone video.",
    "Absolutely NO text, captions, subtitles, logos, watermarks, or UI overlays anywhere in the image.",
  ].join(" ");
}

function buildVideoPrompt(motionPrompt) {
  return [
    "Silent vertical UGC reaction clip. No speech, no lip-sync, no dialogue.",
    motionPrompt,
    "Natural subtle head movement, realistic tears and facial expression, phone-front-camera feel.",
    "No on-screen text, subtitles, or watermarks.",
  ].join(" ");
}

async function evolinkPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `EvoLink POST ${path} failed (${res.status})`);
  }
  return data;
}

async function evolinkGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `EvoLink GET ${path} failed (${res.status})`);
  }
  return data;
}

async function pollTask(taskId, label) {
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    const task = await evolinkGet(`/tasks/${taskId}`);
    const pct = task.progress ?? 0;
    process.stdout.write(`\r  ${label}: ${task.status} (${pct}%)   `);
    if (task.status === "completed") {
      process.stdout.write("\n");
      return task;
    }
    if (task.status === "failed") {
      process.stdout.write("\n");
      throw new Error(task.error?.message || `${label} failed`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`${label} timed out`);
}

async function download(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

async function upload(supabase, storagePath, buffer, contentType) {
  const { error } = await supabase.storage
    .from("carousels")
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("carousels").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function generatePreview(supabase, template) {
  const slug = template.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const imagePrompt = buildHookImagePrompt(template.creator_prompt);
  const videoPrompt = buildVideoPrompt(template.motion_prompt);

  console.log(`\n→ ${template.title}`);

  console.log("  Submitting image…");
  const imageTask = await evolinkPost("/images/generations", {
    model: IMAGE_MODEL,
    prompt: imagePrompt,
    size: "9:16",
    quality: "2K",
    n: 1,
  });
  const imageDone = await pollTask(imageTask.id, "Image");
  const imageUrl = imageDone.results?.[0];
  if (!imageUrl) throw new Error("No image URL in task result");

  const { buffer: imgBuf, contentType: imgType } = await download(imageUrl);
  const previewImageUrl = await upload(
    supabase,
    `hook-templates/${template.id}/preview.jpg`,
    imgBuf,
    imgType.startsWith("image/") ? imgType : "image/jpeg",
  );

  console.log("  Submitting video (Seedance 1.5 Pro)…");
  const videoTask = await evolinkPost("/videos/generations", {
    model: VIDEO_MODEL,
    prompt: videoPrompt,
    image_urls: [imageUrl],
    duration: 5,
    quality: "720p",
    aspect_ratio: "9:16",
    generate_audio: false,
  });
  const videoDone = await pollTask(videoTask.id, "Video");
  const videoUrl = videoDone.results?.[0];
  if (!videoUrl) throw new Error("No video URL in task result");

  const { buffer: vidBuf, contentType: vidType } = await download(videoUrl);
  const previewVideoUrl = await upload(
    supabase,
    `hook-templates/${template.id}/preview.mp4`,
    vidBuf,
    vidType.startsWith("video/") ? vidType : "video/mp4",
  );

  const { error } = await supabase
    .from("hook_templates")
    .update({
      preview_image_url: previewImageUrl,
      preview_video_url: previewVideoUrl,
    })
    .eq("id", template.id);

  if (error) throw new Error(`DB update failed: ${error.message}`);

  console.log(`  ✓ ${previewVideoUrl}`);
  return { previewImageUrl, previewVideoUrl };
}

async function main() {
  if (!API_KEY) throw new Error("EVOLINK_API_KEY not set");
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY required");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("hook_templates")
    .select("id, title, creator_prompt, motion_prompt, preview_video_url")
    .eq("kind", "template")
    .order("sort_order", { ascending: true });

  if (!FORCE) {
    query = query.is("preview_video_url", null);
  }

  const { data: templates, error } = await query;
  if (error) {
    if (error.message.includes("hook_templates")) {
      console.log("hook_templates table not found — apply migration 026/027 first.");
      return;
    }
    throw error;
  }

  if (!templates?.length) {
    console.log(FORCE ? "No template rows found." : "All templates already have previews.");
    return;
  }

  console.log(`Generating ${templates.length} hook template preview(s)…`);

  for (const template of templates) {
    try {
      await generatePreview(supabase, template);
    } catch (err) {
      console.error(`\n  ✗ ${template.title}:`, err.message);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
