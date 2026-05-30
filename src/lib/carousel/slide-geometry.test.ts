import { describe, expect, it } from "vitest";
import {
  bboxToPixelRect,
  geometryUsesBlurredBackdrop,
  photoRegionsFromGeometry,
  shouldUseGeometryRenderer,
  slideHasGeometry,
} from "./slide-geometry";
import type { TemplateSlideBlueprint } from "./template-blueprint";

const baseSlide: TemplateSlideBlueprint = {
  position: 1,
  role: "hook",
  narrativePurpose: "Open",
  layout: "editorial_split",
  composition: {
    photoCount: 1,
    photoLayout: "split_vertical",
    subjectZone: "center",
    hasPerson: false,
    hasProduct: false,
    hasScreenshot: false,
    hasUIChrome: false,
  },
  textZone: {
    placement: "top",
    style: "headline",
    lengthHint: "short",
  },
  visualStyle: "",
  backgroundType: "solid",
};

describe("slideHasGeometry", () => {
  it("detects photoSlots and text bbox", () => {
    expect(slideHasGeometry(baseSlide)).toBe(false);
    expect(
      slideHasGeometry({
        ...baseSlide,
        photoSlots: [{ x: 0, y: 0.5, w: 1, h: 0.5 }],
      }),
    ).toBe(true);
    expect(
      slideHasGeometry({
        ...baseSlide,
        textZone: {
          ...baseSlide.textZone,
          bbox: { x: 0, y: 0, w: 1, h: 0.4 },
        },
      }),
    ).toBe(true);
  });
});

describe("photoRegionsFromGeometry", () => {
  it("converts normalized slots to pixels", () => {
    const regions = photoRegionsFromGeometry(
      {
        ...baseSlide,
        photoSlots: [{ x: 0, y: 0.5, w: 1, h: 0.5 }],
      },
      1080,
      1920,
    );
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ x: 0, y: 960, w: 1080, h: 960 });
  });
});

describe("shouldUseGeometryRenderer", () => {
  it("defers to card chrome when Notes UI is flagged", () => {
    expect(
      shouldUseGeometryRenderer({
        ...baseSlide,
        photoSlots: [{ x: 0, y: 0, w: 1, h: 1 }],
        composition: { ...baseSlide.composition, hasUIChrome: true },
        textZone: {
          placement: "card",
          style: "body",
          lengthHint: "medium",
        },
      }),
    ).toBe(false);
  });
});

describe("geometryUsesBlurredBackdrop", () => {
  it("detects inset photo on blurred background", () => {
    expect(
      geometryUsesBlurredBackdrop(
        {
          ...baseSlide,
          backgroundType: "blurred",
          photoSlots: [{ x: 0.1, y: 0.2, w: 0.8, h: 0.55 }],
        },
        1080,
        1080,
      ),
    ).toBe(true);
    expect(
      geometryUsesBlurredBackdrop(
        {
          ...baseSlide,
          photoSlots: [{ x: 0, y: 0, w: 1, h: 1 }],
        },
        1080,
        1080,
      ),
    ).toBe(false);
  });
});

describe("bboxToPixelRect", () => {
  it("scales 0–1 coords", () => {
    expect(bboxToPixelRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 }, 1000, 2000)).toEqual(
      { x: 100, y: 400, w: 500, h: 600 },
    );
  });
});
