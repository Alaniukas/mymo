import type { NicheSlug } from "../niches";
import { FRAMEWORKS } from "./library";
import type { Framework } from "./types";

export type {
  Framework,
  FrameworkSlide,
  FrameworkFormat,
  LayoutName,
  SlideRole,
  AssetSlot,
} from "./types";
export { FRAMEWORKS } from "./library";

/** All non-video frameworks that are enabled (the MVP carousel library). */
export function carouselFrameworks(): Framework[] {
  return FRAMEWORKS.filter((f) => f.format !== "video" && !f.disabled);
}

/** Enabled frameworks surfaced under a given niche. */
export function frameworksForNiche(niche: NicheSlug): Framework[] {
  return carouselFrameworks().filter((f) => f.niches.includes(niche));
}

/** Look up a framework by id, regardless of enabled/disabled state. */
export function getFramework(id: string | null | undefined): Framework | undefined {
  if (!id) return undefined;
  return FRAMEWORKS.find((f) => f.id === id);
}

/** An enabled framework usable for generation (carousel + not disabled). */
export function getUsableFramework(id: string | null | undefined): Framework | undefined {
  const fw = getFramework(id);
  if (!fw || fw.disabled || fw.format === "video") return undefined;
  return fw;
}
