import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildFullBrandContext,
  planSlidesFromBlueprint,
  generateCaptionsFromBlueprint,
} from "./prompts";
import {
  sampleBlueprint,
  sampleBrandProfile,
} from "./__fixtures/blueprint-fixtures";

vi.mock("@/lib/openai/client", () => ({
  EVOLINK_CHAT_DEFAULTS: { model: "gemini-3.5-flash" },
  extractMessageText: vi.fn(),
  getOpenAIClient: vi.fn(),
}));

import {
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";

const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenAIClient).mockReturnValue({
    chat: { completions: { create: mockCreate } },
  } as never);
});

describe("buildFullBrandContext", () => {
  it("includes populated Variable Dictionary keys", () => {
    const context = buildFullBrandContext(sampleBrandProfile);

    expect(context).toContain("[App_Name]: Mymo");
    expect(context).toContain("[Core_Problem]: Creating content takes forever");
    expect(context).toContain("[CTA_Text]: Try free");
    expect(context).toContain("[Handle]: @mymo");
    expect(context).toContain("Product summary: AI carousel generator for brands");
  });

  it("falls back to legacy brand fields when dictionary is empty", () => {
    const context = buildFullBrandContext({
      app_name: null,
      app_category: null,
      app_tagline: null,
      social_handle: null,
      brand_tone: "Casual",
      target_audience: "Creators",
      value_propositions: ["Fast"],
      core_problem: null,
      key_outcome: null,
      features: null,
      competitor_name: null,
      competitor_weakness: null,
      user_quotes: null,
      metric_result: null,
      cta_text: null,
      brand_color: null,
      logo_url: null,
      llm_summary: "Summary only",
    });

    expect(context).toContain("[Brand_Voice]: Casual");
    expect(context).toContain("[Target_Audience]: Creators");
    expect(context).toContain("Product summary: Summary only");
  });
});

describe("planSlidesFromBlueprint", () => {
  it("maps LLM briefs onto blueprint slides with layout metadata", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        visual_theme: "Dark editorial",
        beats: [
          { position: 1, brief: "Bold founder portrait in moody light" },
          { position: 2, brief: "Split screen product before and after" },
          { position: 3, brief: "App screenshot with blurred background" },
        ],
      }),
    );

    const storyline = await planSlidesFromBlueprint(
      sampleBlueprint,
      sampleBrandProfile,
      "How Mymo saves time",
      "instagram",
    );

    expect(storyline.visualTheme).toBe(sampleBlueprint.globalVisualStyle);
    expect(storyline.beats).toHaveLength(3);
    expect(storyline.beats[0].brief).toContain("founder portrait");
    expect(storyline.beats[0].layout).toBe("fullbleed_dark_overlay");
    expect(storyline.beats[1].layout).toBe("split_compare");
    expect(storyline.beats[1].slideBlueprint?.composition.photoCount).toBe(2);
    expect(storyline.beats[2].layout).toBe("notification_mock");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("uses topic fallback when LLM returns fewer briefs", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        beats: [{ position: 1, brief: "Only one brief" }],
      }),
    );

    const storyline = await planSlidesFromBlueprint(
      sampleBlueprint,
      sampleBrandProfile,
      "Launch week promo",
      "tiktok",
    );

    expect(storyline.beats[2].brief).toBe("Only one brief");
  });

  it("includes brand dictionary in the LLM user message", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({ beats: [] }),
    );

    await planSlidesFromBlueprint(
      sampleBlueprint,
      sampleBrandProfile,
      "Topic",
      "both",
    );

    const userMsg = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userMsg).toContain("[App_Name]: Mymo");
    expect(userMsg).toContain(sampleBlueprint.copyPattern);
  });
});

describe("generateCaptionsFromBlueprint", () => {
  const slideRefs = [
    {
      position: 1,
      role: "hook",
      prompt: "Founder portrait",
      imageUrl: "https://cdn/slide1.png",
    },
    {
      position: 2,
      role: "value",
      prompt: "Split compare",
      imageUrl: "https://cdn/slide2.png",
    },
    {
      position: 3,
      role: "cta",
      prompt: "Notification mock",
      imageUrl: "https://cdn/slide3.png",
    },
  ];

  it("returns captions aligned to slide positions", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        captions: [
          { position: 1, caption: "Still doing this manually?" },
          { position: 2, caption: "Before vs after Mymo" },
          { position: 3, caption: "Try free today" },
        ],
      }),
    );

    const captions = await generateCaptionsFromBlueprint(
      sampleBrandProfile,
      "instagram",
      slideRefs,
      "Save time on content",
      sampleBlueprint,
    );

    expect(captions).toHaveLength(3);
    expect(captions[0].caption).toBe("Still doing this manually?");
    expect(captions[2].caption).toBe("Try free today");
    expect(captions[0].role).toBe("hook");
  });

  it("returns empty array when no slides provided", async () => {
    expect(
      await generateCaptionsFromBlueprint(
        sampleBrandProfile,
        "instagram",
        [],
        "Topic",
        sampleBlueprint,
      ),
    ).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls back to text-only when multimodal call fails", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("Images rejected"))
      .mockResolvedValueOnce({});

    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        captions: [{ position: 1, caption: "Fallback caption" }],
      }),
    );

    const captions = await generateCaptionsFromBlueprint(
      sampleBrandProfile,
      "instagram",
      [slideRefs[0]],
      "Topic",
      sampleBlueprint,
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(captions[0].caption).toBe("Fallback caption");
  });

  it("includes blueprint copy pattern in the prompt", async () => {
    mockCreate.mockResolvedValue({});
    vi.mocked(extractMessageText).mockReturnValue(
      JSON.stringify({
        captions: [{ position: 1, caption: "Hook" }],
      }),
    );

    await generateCaptionsFromBlueprint(
      sampleBrandProfile,
      "instagram",
      [slideRefs[0]],
      "Topic",
      sampleBlueprint,
    );

    const userContent = mockCreate.mock.calls[0][0].messages[1].content;
    const serialized = JSON.stringify(userContent);
    expect(serialized).toContain(sampleBlueprint.copyPattern);
    expect(serialized).toContain("https://cdn/slide1.png");
  });
});
