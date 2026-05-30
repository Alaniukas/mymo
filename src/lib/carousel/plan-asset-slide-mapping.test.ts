import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveAssetSlideMapping } from "./plan-asset-slide-mapping";
import { resolveStudioSlidePlan } from "./studio-slide-count";
import type { TemplateSlideBlueprint } from "./template-blueprint";

vi.mock("@/lib/openai/client", () => ({
  EVOLINK_CHAT_DEFAULTS: { model: "test-model" },
  getOpenAIClient: vi.fn(),
  extractMessageText: vi.fn(),
}));

import { getOpenAIClient, extractMessageText } from "@/lib/openai/client";

function slide(
  position: number,
  role: TemplateSlideBlueprint["role"],
): TemplateSlideBlueprint {
  return {
    position,
    role,
    narrativePurpose: role === "hook" ? "Stop scroll" : "Value",
    layout: "fullbleed_dark_overlay",
    composition: {
      photoCount: 1,
      photoLayout: "single_full",
      subjectZone: "center",
      hasPerson: role === "hook",
      hasProduct: false,
      hasScreenshot: false,
      hasUIChrome: false,
    },
    textZone: { placement: "center", style: "headline", lengthHint: "short" },
    visualStyle: "",
    backgroundType: "photo",
  };
}

describe("resolveAssetSlideMapping", () => {
  beforeEach(() => {
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({}),
        },
      },
    } as never);
  });

  it("uses AI assignments when valid", async () => {
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        assignments: [
          { slidePosition: 1, assetId: "a1", subjectZone: "center" },
          { slidePosition: 2, assetId: "a2", subjectZone: "bottom" },
        ],
      }),
    );

    const slides = [slide(1, "hook"), slide(2, "cta")];
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
          shortDescription: "speaker at event",
        },
      },
      {
        id: "a2",
        public_url: "2.jpg",
        analysis: {
          hasPerson: false,
          suggestedRoles: ["cta"],
          subjectZone: "full",
          hasProduct: false,
          hasScreenshot: false,
          shortDescription: "wide office",
        },
      },
    ];
    const plan = resolveStudioSlidePlan(2, 2, false);
    const map = await resolveAssetSlideMapping(slides, assets, plan);

    expect(map.get(1)?.assetIds).toEqual(["a1"]);
    expect(map.get(2)?.assetIds).toEqual(["a2"]);
    expect(map.get(2)?.subjectZone).toBe("bottom");
  });

  it("falls back to heuristic when AI returns invalid ids", async () => {
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        assignments: [{ slidePosition: 1, assetId: "missing" }],
      }),
    );

    const slides = [slide(1, "hook"), slide(2, "value")];
    const assets = [
      {
        id: "a1",
        public_url: "1.jpg",
        analysis: {
          subjectZone: "center",
          hasPerson: false,
          hasProduct: false,
          hasScreenshot: false,
          suggestedRoles: ["value"],
        },
      },
      {
        id: "a2",
        public_url: "2.jpg",
        analysis: {
          subjectZone: "center",
          hasPerson: false,
          hasProduct: false,
          hasScreenshot: false,
          suggestedRoles: ["value"],
        },
      },
    ];
    const plan = resolveStudioSlidePlan(2, 2, false);
    const map = await resolveAssetSlideMapping(slides, assets, plan);

    const assigned = [...map.values()].flatMap((v) => v.assetIds);
    expect(new Set(assigned).size).toBe(2);
  });
});
