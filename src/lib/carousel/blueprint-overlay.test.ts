import { describe, expect, it } from "vitest";
import { overlaySpecFromBlueprint } from "./blueprint-overlay";
import { sampleBlueprint } from "./__fixtures/blueprint-fixtures";

describe("overlaySpecFromBlueprint", () => {
  it("uses per-slide text placement from blueprint", () => {
    const topList = {
      ...sampleBlueprint.slides[0],
      textZone: {
        placement: "top" as const,
        style: "list" as const,
        lengthHint: "medium" as const,
      },
    };
    const spec = overlaySpecFromBlueprint(topList);
    expect(spec.textPlacement).toBe("top");
    expect(spec.textStyle).toBe("list");
  });

  it("keeps chrome layouts like testimonial_card", () => {
    const slide = {
      ...sampleBlueprint.slides[0],
      layout: "testimonial_card" as const,
    };
    expect(overlaySpecFromBlueprint(slide).layout).toBe("testimonial_card");
  });

  it("maps misclassified notification slides to step cards", () => {
    const slide = {
      ...sampleBlueprint.slides[0],
      layout: "notification_mock" as const,
      composition: {
        ...sampleBlueprint.slides[0]!.composition,
        hasUIChrome: false,
      },
      textZone: {
        placement: "card" as const,
        style: "body" as const,
        lengthHint: "medium" as const,
      },
    };
    expect(overlaySpecFromBlueprint(slide).layout).toBe("testimonial_card");
  });

  it("infers notes-app chrome on body card slides", () => {
    const slide = {
      ...sampleBlueprint.slides[0],
      layout: "testimonial_card" as const,
      composition: {
        ...sampleBlueprint.slides[0]!.composition,
        hasUIChrome: false,
      },
      textZone: {
        placement: "card" as const,
        style: "body" as const,
        lengthHint: "medium" as const,
      },
    };
    expect(overlaySpecFromBlueprint(slide).hasUIChrome).toBe(true);
  });

  it("remaps misclassified journal stacks from split_compare to editorial_split", () => {
    const slide = {
      ...sampleBlueprint.slides[0],
      layout: "split_compare" as const,
      composition: {
        ...sampleBlueprint.slides[0]!.composition,
        photoCount: 1 as const,
        photoLayout: "split_vertical" as const,
      },
      textZone: {
        placement: "top" as const,
        style: "headline" as const,
        lengthHint: "short" as const,
      },
      backgroundType: "solid" as const,
    };
    expect(overlaySpecFromBlueprint(slide).layout).toBe("editorial_split");
  });

  it("uses geometry renderer when AI measured regions exist", () => {
    const slide = {
      ...sampleBlueprint.slides[0],
      photoSlots: [{ x: 0, y: 0.5, w: 1, h: 0.5 }],
      textZone: {
        placement: "top" as const,
        style: "headline" as const,
        lengthHint: "short" as const,
        bbox: { x: 0, y: 0, w: 1, h: 0.45 },
      },
    };
    const spec = overlaySpecFromBlueprint(slide);
    expect(spec.layout).toBe("geometry");
    expect(spec.textBBox).toEqual({ x: 0, y: 0, w: 1, h: 0.45 });
  });
});
