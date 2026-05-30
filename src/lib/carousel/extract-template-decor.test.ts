import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cropDecorAssetFromSlide,
  sanitizeBlueprintDecor,
} from "./extract-template-decor";
import { normalizeDecorAssets } from "./template-blueprint";
import { sampleBlueprint } from "./__fixtures/blueprint-fixtures";

vi.mock("@napi-rs/canvas", () => {
  const toBuffer = vi.fn(() => Buffer.from("png"));
  return {
    createCanvas: vi.fn(() => ({
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBuffer,
    })),
    loadImage: vi.fn(async () => ({ width: 1080, height: 1080 })),
  };
});

function decorAssetsToExtract(
  assets: { containsText?: boolean; bbox: { x: number; y: number; w: number; h: number } }[],
) {
  return assets.filter((a) => !a.containsText && a.bbox);
}

describe("normalizeDecorAssets", () => {
  it("parses valid decor entries with normalized bbox", () => {
    const assets = normalizeDecorAssets([
      {
        id: "python-logo",
        kind: "logo",
        bbox: { x: 0.1, y: 0.2, w: 0.15, h: 0.12 },
        containsText: false,
        label: "Python logo",
      },
    ]);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.id).toBe("python-logo");
    expect(assets[0]!.kind).toBe("logo");
    expect(assets[0]!.bbox.w).toBeCloseTo(0.15);
  });

  it("converts percentage bboxes to 0–1", () => {
    const assets = normalizeDecorAssets([
      {
        id: "sticker-1",
        kind: "sticker",
        bbox: { x: 10, y: 20, w: 15, h: 12 },
        containsText: false,
      },
    ]);
    expect(assets[0]!.bbox.x).toBeCloseTo(0.1);
    expect(assets[0]!.bbox.y).toBeCloseTo(0.2);
  });

  it("skips tiny or invalid bboxes", () => {
    expect(
      normalizeDecorAssets([
        { id: "x", kind: "icon", bbox: { x: 0, y: 0, w: 0.005, h: 0.01 } },
      ]),
    ).toHaveLength(0);
  });
});

describe("sanitizeBlueprintDecor", () => {
  it("re-normalizes decor on all slides", () => {
    const bp = {
      ...sampleBlueprint,
      slides: [
        {
          ...sampleBlueprint.slides[0]!,
          decorAssets: [
            {
              id: "star",
              kind: "sticker" as const,
              bbox: { x: 70, y: 30, w: 20, h: 20 },
              containsText: false,
            },
          ],
        },
      ],
    };
    const out = sanitizeBlueprintDecor(bp);
    expect(out.slides[0]!.decorAssets![0]!.bbox.x).toBeCloseTo(0.7);
  });
});

describe("cropDecorAssetFromSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for text regions", async () => {
    const buf = await cropDecorAssetFromSlide(Buffer.from("x"), {
      id: "t",
      kind: "graphic",
      bbox: { x: 0, y: 0, w: 0.2, h: 0.2 },
      containsText: true,
    });
    expect(buf).toBeNull();
  });

  it("crops a PNG buffer for graphic assets", async () => {
    const buf = await cropDecorAssetFromSlide(Buffer.from("x"), {
      id: "logo",
      kind: "logo",
      bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      containsText: false,
    });
    expect(buf).toBeInstanceOf(Buffer);
  });
});

describe("decorAssetsToExtract filter", () => {
  it("filters out text regions", () => {
    const list = decorAssetsToExtract([
      {
        id: "a",
        kind: "logo",
        bbox: { x: 0, y: 0, w: 0.1, h: 0.1 },
        containsText: false,
      },
      {
        id: "b",
        kind: "graphic",
        bbox: { x: 0, y: 0, w: 0.1, h: 0.1 },
        containsText: true,
      },
    ] as never);
    expect(list).toHaveLength(1);
  });
});
