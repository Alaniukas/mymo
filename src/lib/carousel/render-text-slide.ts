import { createCanvas } from "@napi-rs/canvas";
import { overlayDimsForAspect } from "./overlay/primitives";

/** Renders a clean solid-color slide background (no AI, no photos). */
export function renderTextSlideBackground(opts: {
  aspect: string;
  backgroundColor: string;
}): Buffer {
  const { width, height } = overlayDimsForAspect(opts.aspect);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const fill = opts.backgroundColor.startsWith("#")
    ? opts.backgroundColor
    : "#FFFFFF";
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer("image/png");
}
