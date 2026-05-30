import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseTemplateBlueprint,
  analyzeTemplateBlueprint,
  selectBlueprintReferences,
  buildBlueprintImagePrompt,
} from "./template-blueprint";
import {
  sampleBlueprint,
  sampleBlueprintJson,
} from "./__fixtures/blueprint-fixtures";
import type { AssetRef } from "./prompts";

vi.mock("@/lib/openai/client", () => ({
  EVOLINK_CHAT_DEFAULTS: { model: "gemini-3.5-flash" },
  extractMessageText: vi.fn(),
  getOpenAIClient: vi.fn(),
}));

vi.mock("./storage", () => ({
  fetchMediaBuffer: vi.fn(),
}));

vi.mock("@napi-rs/canvas", () => ({
  createCanvas: vi.fn(),
  loadImage: vi.fn(),
}));

import {
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { fetchMediaBuffer } from "./storage";
import { loadImage } from "@napi-rs/canvas";

const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenAIClient).mockReturnValue({
    chat: { completions: { create: mockCreate } },
  } as never);
  vi.mocked(fetchMediaBuffer).mockResolvedValue({
    buffer: Buffer.from("fake-image"),
    contentType: "image/jpeg",
  });
  vi.mocked(loadImage).mockResolvedValue({
    width: 800,
    height: 800,
  } as never);
});

describe("parseTemplateBlueprint", () => {
  it("returns null for empty or invalid input", () => {
    expect(parseTemplateBlueprint(null)).toBeNull();
    expect(parseTemplateBlueprint(undefined)).toBeNull();
    expect(parseTemplateBlueprint({})).toBeNull();
    expect(parseTemplateBlueprint({ slides: [] })).toBeNull();
  });

  it("parses camelCase LLM output", () => {
    const result = parseTemplateBlueprint({
      summary: "Test carousel",
      arcType: "listicle",
      slideCount: 1,
      globalVisualStyle: "Bright",
      copyPattern: "Hook → tips → CTA",
      slides: [
        {
          position: 1,
          role: "hook",
          narrativePurpose: "Grab attention",
          layout: "split_compare",
          composition: {
            photoCount: 2,
            photoLayout: "split_horizontal",
            subjectZone: "left",
            hasPerson: true,
            hasProduct: true,
            hasScreenshot: false,
            hasUIChrome: false,
          },
          textZone: {
            placement: "top",
            style: "headline",
            lengthHint: "short",
          },
          visualStyle: "High contrast",
          backgroundType: "photo",
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Test carousel");
    expect(result!.slides).toHaveLength(1);
    expect(result!.slides[0].layout).toBe("split_compare");
    expect(result!.slides[0].composition.photoCount).toBe(2);
    expect(result!.slides[0].composition.hasPerson).toBe(true);
  });

  it("parses snake_case DB output", () => {
    const result = parseTemplateBlueprint(sampleBlueprintJson);

    expect(result).not.toBeNull();
    expect(result!.arcType).toBe("listicle");
    expect(result!.globalVisualStyle).toBe("Bright pastel gradients");
    expect(result!.slides).toHaveLength(2);
    expect(result!.slides[0].layout).toBe("text_only");
    expect(result!.slides[1].layout).toBe("testimonial_card");
    expect(result!.slides[1].textZone.style).toBe("quote");
    expect(result!.slides[1].backgroundType).toBe("blurred");
  });

  it("defaults unknown layout to fullbleed_dark_overlay", () => {
    const result = parseTemplateBlueprint({
      slides: [{ layout: "unknown_layout", composition: {} }],
    });

    expect(result!.slides[0].layout).toBe("fullbleed_dark_overlay");
  });

  it("infers roles from position when missing", () => {
    const result = parseTemplateBlueprint({
      slides: [{ composition: {} }, { composition: {} }, { composition: {} }],
    });

    expect(result!.slides[0].role).toBe("hook");
    expect(result!.slides[1].role).toBe("value");
    expect(result!.slides[2].role).toBe("cta");
  });
});

describe("analyzeTemplateBlueprint", () => {
  it("returns null when no image URLs provided", async () => {
    expect(await analyzeTemplateBlueprint([])).toBeNull();
    expect(await analyzeTemplateBlueprint(["", "  "])).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns parsed blueprint on successful LLM response", async () => {
    const llmJson = {
      summary: "Analyzed carousel",
      arcType: "story-hook",
      slideCount: 2,
      globalVisualStyle: "Moody dark",
      copyPattern: "Hook → story → CTA",
      slides: sampleBlueprint.slides.slice(0, 2),
    };

    mockCreate.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    vi.mocked(extractMessageText).mockReturnValue(JSON.stringify(llmJson));

    const result = await analyzeTemplateBlueprint(
      ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      "Original caption for context",
    );

    expect(result).not.toBeNull();
    expect(result!.slideCount).toBe(2);
    expect(result!.slides[0].position).toBe(1);
    expect(result!.slides[0].role).toBe("hook");
    expect(result!.slides[1].role).toBe("cta");
    expect(mockCreate).toHaveBeenCalledOnce();

    const call = mockCreate.mock.calls[0][0];
    expect(call.response_format).toEqual({ type: "json_object" });
    const userContent = call.messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    expect(JSON.stringify(userContent)).toContain("Original caption");
  });

  it("returns null when LLM returns empty text", async () => {
    mockCreate.mockResolvedValue({ choices: [] });
    vi.mocked(extractMessageText).mockReturnValue("");

    expect(await analyzeTemplateBlueprint(["https://example.com/1.jpg"])).toBeNull();
  });

  it("returns null when LLM throws", async () => {
    mockCreate.mockRejectedValue(new Error("API down"));

    expect(await analyzeTemplateBlueprint(["https://example.com/1.jpg"])).toBeNull();
  });

  it("caps image URLs at 20", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue("");

    const urls = Array.from({ length: 25 }, (_, i) => `https://example.com/${i}.jpg`);
    await analyzeTemplateBlueprint(urls);

    expect(fetchMediaBuffer).toHaveBeenCalledTimes(20);
  });
});

describe("selectBlueprintReferences", () => {
  const hookAsset: AssetRef = {
    type: "hook",
    name: "Creator",
    public_url: "https://assets/hook.jpg",
  };
  const demoAsset: AssetRef = {
    type: "demo",
    name: "Product",
    public_url: "https://assets/demo.jpg",
  };
  const demo2: AssetRef = {
    type: "demo",
    name: "Product 2",
    public_url: "https://assets/demo2.jpg",
  };

  it("uses brand hook asset when no per-slide user photo", () => {
    const refs = selectBlueprintReferences({
      templateUrl: "https://template/1.jpg",
      slideBlueprint: sampleBlueprint.slides[0],
      assets: [hookAsset],
    });

    expect(refs).toEqual(["https://assets/hook.jpg"]);
    expect(refs).not.toContain("https://template/1.jpg");
  });

  it("returns only user photos when slideAssetUrl is set", () => {
    const refs = selectBlueprintReferences({
      templateUrl: "https://template/1.jpg",
      slideAssetUrl: "https://assets/hook.jpg",
      slideBlueprint: sampleBlueprint.slides[0],
      assets: [hookAsset],
    });

    expect(refs).toEqual(["https://assets/hook.jpg"]);
  });

  it("includes hook asset when slide has person", () => {
    const refs = selectBlueprintReferences({
      templateUrl: "https://template/1.jpg",
      slideBlueprint: sampleBlueprint.slides[0],
      assets: [hookAsset, demoAsset],
    });

    expect(refs).toContain("https://assets/hook.jpg");
    expect(refs.length).toBeLessThanOrEqual(4);
  });

  it("includes up to two demo assets for split/compare slides", () => {
    const refs = selectBlueprintReferences({
      templateUrl: "https://template/2.jpg",
      slideBlueprint: sampleBlueprint.slides[1],
      assets: [hookAsset, demoAsset, demo2],
    });

    expect(refs).toContain("https://assets/demo.jpg");
    expect(refs).toContain("https://assets/demo2.jpg");
  });

  it("includes screenshot demo on notification slide", () => {
    const refs = selectBlueprintReferences({
      templateUrl: "https://template/3.jpg",
      slideBlueprint: sampleBlueprint.slides[2],
      assets: [demoAsset],
    });

    expect(refs).toContain("https://assets/demo.jpg");
  });

  it("deduplicates and caps at 4 references", () => {
    const sameUrl = "https://assets/same.jpg";
    const refs = selectBlueprintReferences({
      templateUrl: sameUrl,
      slideBlueprint: sampleBlueprint.slides[0],
      assets: [
        { type: "hook", name: "H", public_url: sameUrl },
        { type: "demo", name: "D1", public_url: "https://a/1.jpg" },
        { type: "demo", name: "D2", public_url: "https://a/2.jpg" },
        { type: "demo", name: "D3", public_url: "https://a/3.jpg" },
        { type: "demo", name: "D4", public_url: "https://a/4.jpg" },
      ],
    });

    expect(refs.length).toBeLessThanOrEqual(4);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe("buildBlueprintImagePrompt", () => {
  it("includes aspect ratio, layout, and no-text constraint", () => {
    const prompt = buildBlueprintImagePrompt({
      brief: "Founder working on laptop in cafe",
      role: "hook",
      position: 1,
      totalSlides: 3,
      platform: "tiktok",
      brandTone: "Bold",
      slideBlueprint: sampleBlueprint.slides[0],
      globalVisualStyle: "Dark moody palette",
    });

    expect(prompt).toContain("9:16");
    expect(prompt).toContain("slide 1/3");
    expect(prompt).toContain("single full-bleed photo");
    expect(prompt).toContain("NO text");
    expect(prompt).toContain("person from reference photo");
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });

  it("uses split layout description for compare slides", () => {
    const prompt = buildBlueprintImagePrompt({
      brief: "Before and after product results",
      role: "value",
      position: 2,
      totalSlides: 3,
      platform: "instagram",
      brandTone: "Professional",
      slideBlueprint: sampleBlueprint.slides[1],
      globalVisualStyle: "Clean white aesthetic",
    });

    expect(prompt).toContain("1:1");
    expect(prompt).toContain("side-by-side");
    expect(prompt).toContain("product from reference");
    expect(prompt).toContain("Photos in frame: 2");
  });

  it("reserves UI space for notification mock slides", () => {
    const prompt = buildBlueprintImagePrompt({
      brief: "App screenshot with notification overlay area",
      role: "cta",
      position: 3,
      totalSlides: 3,
      platform: "both",
      brandTone: "Friendly",
      slideBlueprint: sampleBlueprint.slides[2],
      globalVisualStyle: "Soft pastels",
    });

    expect(prompt).toContain("4:5");
    expect(prompt).toContain("UI card/notification");
    expect(prompt).toContain("app/product screenshot");
  });
});
