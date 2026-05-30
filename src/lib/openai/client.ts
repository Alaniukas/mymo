import OpenAI from "openai";

/** EvoLink text model for captions, crawl parsing, etc. */
export const EVOLINK_TEXT_MODEL = "gemini-3.5-flash";

/**
 * gemini-3.5-flash allocates tokens to internal reasoning by default.
 * Use low reasoning effort and max_completion_tokens so output text is returned.
 */
export const EVOLINK_CHAT_DEFAULTS = {
  model: EVOLINK_TEXT_MODEL,
  reasoning_effort: "low" as const,
  max_completion_tokens: 1024,
  temperature: 0.7,
};

let instance: OpenAI | null = null;

/**
 * Returns an OpenAI-compatible client routed through EvoLink.
 * Uses `direct.evolink.ai` which supports chat completions in OpenAI SDK format.
 */
export function getOpenAIClient(): OpenAI {
  if (!instance) {
    const apiKey = process.env.EVOLINK_API_KEY;
    if (!apiKey) {
      throw new Error("EVOLINK_API_KEY is not configured");
    }
    instance = new OpenAI({
      apiKey,
      baseURL: "https://direct.evolink.ai/v1",
    });
  }
  return instance;
}

export function extractMessageText(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): string {
  return completion.choices[0]?.message?.content?.trim() ?? "";
}
