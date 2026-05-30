import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  persistTemplateBlueprint,
  slideImageUrlsFromTemplate,
  TemplateBlueprintError,
} from "./persist-template-blueprint";

const mockAnalyze = vi.fn();
const mockParse = vi.fn();

vi.mock("./template-blueprint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./template-blueprint")>();
  return {
    ...actual,
    analyzeTemplateBlueprint: (...args: unknown[]) => mockAnalyze(...args),
    parseTemplateBlueprint: (...args: unknown[]) => mockParse(...args),
  };
});

function mockDb(blueprint: unknown = null) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        blueprint,
        blueprint_analyzed_at: blueprint ? "2026-01-01T00:00:00Z" : null,
      },
    }),
    update,
  };
  return {
    from: vi.fn().mockReturnValue(chain),
    update,
    updateEq,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slideImageUrlsFromTemplate", () => {
  it("returns ordered public URLs", () => {
    expect(
      slideImageUrlsFromTemplate([
        { position: 2, image_url: "b.jpg" },
        { position: 1, image_url: "a.jpg" },
      ]),
    ).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("persistTemplateBlueprint", () => {
  it("throws when there are no image URLs", async () => {
    await expect(
      persistTemplateBlueprint(mockDb(), "id", { imageUrls: [] }),
    ).rejects.toBeInstanceOf(TemplateBlueprintError);
  });

  it("returns cached blueprint without re-analyzing", async () => {
    const cached = { slides: [{ position: 1 }] };
    mockParse.mockReturnValue({
      slides: [
        {
          position: 1,
          photoSlots: [{ x: 0, y: 0, w: 1, h: 1 }],
        },
      ],
      slideCount: 1,
    });
    const db = mockDb(cached);

    const result = await persistTemplateBlueprint(db, "tpl-1", {
      imageUrls: ["a.jpg"],
    });

    expect(result.blueprint.slides).toHaveLength(1);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("re-analyzes legacy blueprints missing geometry", async () => {
    mockParse.mockReturnValue({ slides: [{ position: 1 }], slideCount: 1 });
    mockAnalyze.mockResolvedValue({ slides: [{ position: 1 }], slideCount: 1 });
    const db = mockDb({ slides: [{ position: 1 }] });

    await persistTemplateBlueprint(db, "tpl-1", {
      imageUrls: ["a.jpg"],
    });

    expect(mockAnalyze).toHaveBeenCalled();
  });

  it("analyzes and saves when no blueprint exists", async () => {
    mockParse.mockReturnValueOnce(null).mockReturnValueOnce({
      slides: [{ position: 1 }],
      slideCount: 1,
    });
    mockAnalyze.mockResolvedValue({ slides: [{ position: 1 }], slideCount: 1 });
    const db = mockDb(null);

    const result = await persistTemplateBlueprint(db, "tpl-1", {
      imageUrls: ["a.jpg"],
      caption: "ctx",
      force: true,
    });

    expect(mockAnalyze).toHaveBeenCalledWith(["a.jpg"], "ctx", undefined);
    expect(result.blueprint.slides).toHaveLength(1);
  });

  it("uses fallback blueprint when vision analysis fails", async () => {
    mockParse.mockReturnValueOnce(null);
    mockAnalyze.mockResolvedValue(null);
    const db = mockDb(null);

    const result = await persistTemplateBlueprint(db, "tpl-1", {
      imageUrls: ["a.jpg", "b.jpg"],
      force: true,
    });

    expect(result.blueprint.slides).toHaveLength(2);
  });
});
