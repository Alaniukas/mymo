import { describe, expect, it } from "vitest";
import {
  assetUrlForSlide,
  assetUrlsForSlide,
  buildStudioReferenceUrls,
  orderAssetsByIds,
} from "./studio-asset-references";
import {
  overlayLayoutFromBlueprint,
  photoRegionsForBlueprint,
  slideNeedsMultiAssetCompose,
} from "./compose-asset-slide";
import { sampleBlueprint } from "./__fixtures/blueprint-fixtures";

describe("orderAssetsByIds", () => {
  it("preserves picker selection order", () => {
    const rows = [
      { id: "b", public_url: "b.jpg" },
      { id: "a", public_url: "a.jpg" },
      { id: "c", public_url: "c.jpg" },
    ];
    expect(orderAssetsByIds(["a", "c", "b"], rows).map((r) => r.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("assetUrlForSlide", () => {
  const assets = [{ public_url: "1.jpg" }, { public_url: "2.jpg" }];

  it("maps slide index to asset", () => {
    expect(assetUrlForSlide(assets, 0)).toBe("1.jpg");
    expect(assetUrlForSlide(assets, 1)).toBe("2.jpg");
  });
});

describe("buildStudioReferenceUrls", () => {
  it("puts user asset before template", () => {
    expect(
      buildStudioReferenceUrls({
        slideAssetUrl: "user.jpg",
        templateUrl: "tpl.jpg",
      }),
    ).toEqual(["user.jpg", "tpl.jpg"]);
  });
});

describe("assetUrlsForSlide", () => {
  const assets = [{ public_url: "1.jpg" }, { public_url: "2.jpg" }, { public_url: "3.jpg" }];

  it("returns one URL for single-photo slides", () => {
    expect(assetUrlsForSlide(assets, 0, 1)).toEqual(["1.jpg"]);
  });

  it("returns two URLs for split slides", () => {
    expect(
      assetUrlsForSlide(assets, 0, 2, "split_horizontal"),
    ).toEqual(["1.jpg", "2.jpg"]);
  });
});

describe("photoRegionsForBlueprint", () => {
  it("reserves top banner band for split_compare", () => {
    const regions = photoRegionsForBlueprint(
      sampleBlueprint.slides[1]!,
      1080,
      1080,
      "1:1",
    );
    expect(regions).toHaveLength(2);
    expect(regions[0]!.y).toBeGreaterThan(100);
    expect(regions[0]!.w).toBe(regions[1]!.w);
    expect(regions[0]!.x + regions[0]!.w).toBe(regions[1]!.x);
  });

  it("returns no sharp photo panels for card chrome layouts", () => {
    const cardSlide = {
      ...sampleBlueprint.slides[2]!,
      layout: "testimonial_card" as const,
      backgroundType: "photo" as const,
    };
    expect(
      photoRegionsForBlueprint(cardSlide, 1080, 1080, "1:1"),
    ).toEqual([]);
  });

  it("prefers AI photoSlots over layout heuristics", () => {
    const regions = photoRegionsForBlueprint(
      {
        ...sampleBlueprint.slides[0]!,
        layout: "split_compare" as const,
        photoSlots: [{ x: 0, y: 0.55, w: 1, h: 0.45 }],
      },
      1080,
      1920,
      "9:16",
    );
    expect(regions).toHaveLength(1);
    expect(regions[0]!.y).toBeCloseTo(1056, 0);
    expect(regions[0]!.h).toBeCloseTo(864, 0);
  });
});

describe("slideNeedsMultiAssetCompose", () => {
  it("detects split compare slides", () => {
    expect(
      slideNeedsMultiAssetCompose(sampleBlueprint.slides[1], 2),
    ).toBe(true);
    expect(
      slideNeedsMultiAssetCompose(sampleBlueprint.slides[0], 2),
    ).toBe(false);
  });
});

describe("overlayLayoutFromBlueprint", () => {
  it("returns chrome layout from blueprint", () => {
    expect(overlayLayoutFromBlueprint(sampleBlueprint.slides[0])).toBe(
      sampleBlueprint.slides[0].layout,
    );
  });
});
