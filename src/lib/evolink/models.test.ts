import { describe, it, expect } from "vitest";
import { buildImagePayload } from "./models";

describe("buildImagePayload", () => {
  it("truncates prompts that exceed Nano Banana 2 limit", () => {
    const longPrompt = "A".repeat(2500);
    const { payload, errors } = buildImagePayload(
      "gemini-3.1-flash-image-preview",
      longPrompt,
      { size: "1:1", quality: "medium" },
    );

    expect(errors.some((e) => e.includes("Prompt exceeds max length"))).toBe(true);
    expect(payload.prompt.length).toBe(2000);
    expect(payload.prompt).toBe("A".repeat(2000));
  });

  it("does not truncate prompts within limit", () => {
    const prompt = "Create a clean carousel background with warm tones.";
    const { payload, errors } = buildImagePayload(
      "gemini-3.1-flash-image-preview",
      prompt,
    );

    expect(errors.filter((e) => e.includes("Prompt exceeds"))).toHaveLength(0);
    expect(payload.prompt).toBe(prompt);
  });

  it("clamps reference image count to model max", () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://img/${i}.jpg`);
    const { payload, errors } = buildImagePayload("gemini-3.1-flash-image-preview", "test", {
      image_urls: urls,
    });

    expect(errors.some((e) => e.includes("Too many images"))).toBe(true);
    expect(payload.image_urls).toHaveLength(14);
  });

  it("resolves nanobanana alias to gemini flash image model", () => {
    const { payload } = buildImagePayload("nanobanana-2", "short prompt");
    expect(payload.model).toBe("gemini-3.1-flash-image-preview");
  });

  it("maps platform aspect sizes for instagram/tiktok/both", () => {
    const ig = buildImagePayload("gemini-3.1-flash-image-preview", "p", { size: "1:1" });
    const tt = buildImagePayload("gemini-3.1-flash-image-preview", "p", { size: "9:16" });
    const both = buildImagePayload("gemini-3.1-flash-image-preview", "p", { size: "4:5" });

    expect(ig.payload.size).toBe("1:1");
    expect(tt.payload.size).toBe("9:16");
    expect(both.payload.size).toBe("4:5");
  });
});
