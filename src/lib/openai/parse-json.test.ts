import { describe, it, expect } from "vitest";
import {
  extractJsonCandidate,
  repairJson,
  parseJsonFromLlm,
} from "./parse-json";

describe("extractJsonCandidate", () => {
  it("strips markdown fences", () => {
    const raw = '```json\n{"app_name":"Mymo"}\n```';
    expect(extractJsonCandidate(raw)).toBe('{"app_name":"Mymo"}');
  });

  it("extracts the outermost object when extra text surrounds it", () => {
    const raw = 'Here is the profile:\n{"brand_tone":"bold"}\nDone.';
    expect(extractJsonCandidate(raw)).toBe('{"brand_tone":"bold"}');
  });
});

describe("repairJson", () => {
  it("removes trailing commas", () => {
    expect(repairJson('{"a":1,}')).toBe('{"a":1}');
  });

  it("closes truncated objects", () => {
    const truncated = '{"app_name":"Test","brand_tone":"bold","summary":"A great';
    const repaired = repairJson(truncated);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
});

describe("parseJsonFromLlm", () => {
  it("parses valid JSON", () => {
    const result = parseJsonFromLlm<{ app_name: string }>(
      '{"app_name":"Acme"}',
    );
    expect(result.app_name).toBe("Acme");
  });

  it("repairs and parses truncated brand-like JSON", () => {
    const truncated = `{
  "app_name": "Mymo",
  "brand_tone": "Bold",
  "value_propositions": ["Fast", "On-brand"],
  "summary": "AI carousel tool for brands`;
    const result = parseJsonFromLlm<Record<string, unknown>>(truncated);
    expect(result.app_name).toBe("Mymo");
    expect(result.brand_tone).toBe("Bold");
  });

  it("throws SyntaxError on completely invalid input", () => {
    expect(() => parseJsonFromLlm("not json at all")).toThrow(SyntaxError);
  });
});
