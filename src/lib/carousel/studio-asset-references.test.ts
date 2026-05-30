import { describe, expect, it } from "vitest";
import {
  assetUrlForSlide,
  buildStudioReferenceUrls,
  orderAssetsByIds,
} from "./studio-asset-references";

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

  it("cycles when more slides than assets", () => {
    expect(assetUrlForSlide(assets, 2)).toBe("1.jpg");
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
