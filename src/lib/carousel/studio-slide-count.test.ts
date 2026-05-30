import { describe, expect, it } from "vitest";
import {
  resolveStudioSlidePlan,
  slideUsesUserPhotos,
  effectiveStudioSlideCount,
} from "./studio-slide-count";

describe("resolveStudioSlidePlan", () => {
  it("caps to asset count by default", () => {
    const plan = resolveStudioSlidePlan(7, 4, false);
    expect(plan.totalSlides).toBe(4);
    expect(plan.trimBlueprint).toBe(true);
    expect(plan.aiSlideCount).toBe(0);
  });

  it("keeps full template with AI fill", () => {
    const plan = resolveStudioSlidePlan(7, 4, true);
    expect(plan.totalSlides).toBe(7);
    expect(plan.trimBlueprint).toBe(false);
    expect(plan.photoSlideCount).toBe(4);
    expect(plan.aiSlideCount).toBe(3);
    expect(plan.fillWithAi).toBe(true);
  });

  it("slideUsesUserPhotos respects plan", () => {
    const plan = resolveStudioSlidePlan(7, 4, true);
    expect(slideUsesUserPhotos(1, plan)).toBe(true);
    expect(slideUsesUserPhotos(4, plan)).toBe(true);
    expect(slideUsesUserPhotos(5, plan)).toBe(false);
  });
});

describe("effectiveStudioSlideCount", () => {
  it("delegates to resolveStudioSlidePlan", () => {
    expect(effectiveStudioSlideCount(5, 4)).toBe(4);
  });
});
