import { describe, expect, it } from "vitest";
import { matchAssetsToSlides } from "./match-assets-to-slides";
import { resolveStudioSlidePlan } from "./studio-slide-count";
import type { TemplateSlideBlueprint } from "./template-blueprint";

function slide(
  position: number,
  role: TemplateSlideBlueprint["role"],
  flags: Partial<TemplateSlideBlueprint["composition"]> = {},
): TemplateSlideBlueprint {
  return {
    position,
    role,
    narrativePurpose: "",
    layout: "fullbleed_dark_overlay",
    composition: {
      photoCount: 1,
      photoLayout: "single_full",
      subjectZone: "center",
      hasPerson: false,
      hasProduct: false,
      hasScreenshot: false,
      hasUIChrome: false,
      ...flags,
    },
    textZone: { placement: "center", style: "headline", lengthHint: "short" },
    visualStyle: "",
    backgroundType: "photo",
  };
}

describe("matchAssetsToSlides", () => {
  it("assigns person asset to hook slide", () => {
    const slides = [
      slide(1, "hook", { hasPerson: true }),
      slide(2, "value"),
      slide(3, "cta"),
    ];
    const assets = [
      {
        id: "a1",
        public_url: "1.jpg",
        analysis: {
          hasPerson: true,
          suggestedRoles: ["hook"],
          subjectZone: "center",
          hasProduct: false,
          hasScreenshot: false,
        },
      },
      {
        id: "a2",
        public_url: "2.jpg",
        analysis: {
          hasPerson: false,
          suggestedRoles: ["value"],
          subjectZone: "center",
          hasProduct: true,
          hasScreenshot: false,
        },
      },
    ];
    const plan = resolveStudioSlidePlan(3, 2, false);
    const map = matchAssetsToSlides(slides, assets, plan);
    expect(map.get(1)).toEqual(["a1"]);
  });

  it("assigns each asset once when there are enough photos", () => {
    const slides = [
      slide(1, "hook"),
      slide(2, "value"),
      slide(3, "value"),
      slide(4, "cta"),
    ];
    const assets = [
      { id: "a1", public_url: "1.jpg" },
      { id: "a2", public_url: "2.jpg" },
      { id: "a3", public_url: "3.jpg" },
      { id: "a4", public_url: "4.jpg" },
    ];
    const plan = resolveStudioSlidePlan(4, 4, false);
    const map = matchAssetsToSlides(slides, assets, plan);

    const assigned = [...map.values()].flat();
    expect(assigned).toHaveLength(4);
    expect(new Set(assigned).size).toBe(4);
    expect(assigned.sort()).toEqual(["a1", "a2", "a3", "a4"]);
  });
});
