import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";

/**
 * Built-in video compositing with ffmpeg. Two renderers share one concat
 * pipeline:
 *
 * - `renderSlideshow` — stitches a carousel's finished slide IMAGES into an MP4,
 *   each shown for a fixed duration (a clean cut between slides, no transitions).
 * - `renderClipReel` — concatenates a video carousel's per-slide CLIPS into one
 *   continuous MP4 for publishing as a single Reel/video.
 *
 * Both scale + letterbox-pad every input to the target size so mixed source
 * dimensions stay centered and undistorted, and can lay a looping audio track
 * over the top. Captions are NOT added here — slide frames already carry their
 * text (baked in for image carousels, burned onto the clips for video ones).
 */

const execFileAsync = promisify(execFile);

// Bounds so a stray request can never ask ffmpeg for an absurd render.
export const MIN_TOTAL_SECONDS = 3;
export const MAX_TOTAL_SECONDS = 60;
export const MIN_SLIDE_SECONDS = 1;

/** Even split of a total target length across N slides, clamped to sane bounds. */
export function perSlideSeconds(totalSeconds: number, slideCount: number): number {
  if (slideCount <= 0) return MIN_SLIDE_SECONDS;
  const total = Math.min(
    MAX_TOTAL_SECONDS,
    Math.max(MIN_TOTAL_SECONDS, Math.round(totalSeconds)),
  );
  return Math.max(MIN_SLIDE_SECONDS, Math.round((total / slideCount) * 100) / 100);
}

function scaleFilter(width: number, height: number): string {
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`
  );
}

interface ConcatInput {
  path: string;
  /** When set, the input is a still image looped for this many seconds. */
  loopSeconds?: number;
}

// Builds and runs the ffmpeg filtergraph: normalize each input to W×H, concat
// (video only), then optionally overlay a looped, length-trimmed audio track.
async function encodeConcat(input: {
  inputs: ConcatInput[];
  width: number;
  height: number;
  audioPath: string | null;
  outPath: string;
}): Promise<void> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  const { inputs, width, height, audioPath, outPath } = input;

  const args: string[] = ["-y", "-loglevel", "error"];
  for (const inp of inputs) {
    if (inp.loopSeconds != null) {
      args.push("-loop", "1", "-t", String(inp.loopSeconds));
    }
    args.push("-i", inp.path);
  }
  if (audioPath) {
    // Loop the track so short sounds still cover the whole video.
    args.push("-stream_loop", "-1", "-i", audioPath);
  }

  const labeled = inputs
    .map((_, i) => `[${i}:v]${scaleFilter(width, height)}[v${i}]`)
    .join(";");
  const concatIn = inputs.map((_, i) => `[v${i}]`).join("");
  const filter = `${labeled};${concatIn}concat=n=${inputs.length}:v=1:a=0[v]`;

  args.push("-filter_complex", filter, "-map", "[v]");
  if (audioPath) {
    args.push("-map", `${inputs.length}:a`, "-c:a", "aac", "-b:a", "192k", "-shortest");
  }
  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath,
  );

  await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 });
}

export interface RenderSlideshowOptions {
  /** Ordered slide frames (PNG/JPEG bytes), shown in array order. */
  frames: Buffer[];
  /** Seconds each frame stays on screen. */
  secondsPerFrame: number;
  width: number;
  height: number;
  /** Optional audio track (e.g. mp3); looped and trimmed to the video length. */
  audio?: Buffer | null;
}

/**
 * Composes a still-image slideshow MP4 and returns its bytes. Throws if ffmpeg
 * is unavailable or no frames are supplied.
 */
export async function renderSlideshow(
  opts: RenderSlideshowOptions,
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  if (opts.frames.length === 0) throw new Error("No slide frames to render");

  const dir = await mkdtemp(path.join(tmpdir(), "carousel-export-"));
  try {
    const inputs: ConcatInput[] = await Promise.all(
      opts.frames.map(async (buf, i) => {
        const p = path.join(dir, `frame-${String(i).padStart(3, "0")}.png`);
        await writeFile(p, buf);
        return { path: p, loopSeconds: opts.secondsPerFrame };
      }),
    );

    let audioPath: string | null = null;
    if (opts.audio && opts.audio.length > 0) {
      audioPath = path.join(dir, "audio");
      await writeFile(audioPath, opts.audio);
    }

    const outPath = path.join(dir, "out.mp4");
    await encodeConcat({
      inputs,
      width: opts.width,
      height: opts.height,
      audioPath,
      outPath,
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface RenderClipReelOptions {
  /** Ordered per-slide video clips (MP4 bytes), concatenated in array order. */
  clips: Buffer[];
  width: number;
  height: number;
  /** Optional audio track; looped and trimmed to the combined length. */
  audio?: Buffer | null;
}

/**
 * Concatenates a video carousel's per-slide clips into one continuous MP4
 * (their original audio is dropped; pass `audio` to lay a track over the top).
 * Throws if ffmpeg is unavailable or no clips are supplied.
 */
export async function renderClipReel(
  opts: RenderClipReelOptions,
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  if (opts.clips.length === 0) throw new Error("No clips to combine");

  const dir = await mkdtemp(path.join(tmpdir(), "carousel-reel-"));
  try {
    const inputs: ConcatInput[] = await Promise.all(
      opts.clips.map(async (buf, i) => {
        const p = path.join(dir, `clip-${String(i).padStart(3, "0")}.mp4`);
        await writeFile(p, buf);
        return { path: p };
      }),
    );

    let audioPath: string | null = null;
    if (opts.audio && opts.audio.length > 0) {
      audioPath = path.join(dir, "audio");
      await writeFile(audioPath, opts.audio);
    }

    const outPath = path.join(dir, "out.mp4");
    await encodeConcat({
      inputs,
      width: opts.width,
      height: opts.height,
      audioPath,
      outPath,
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
