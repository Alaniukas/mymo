/**
 * Extract and parse JSON from LLM completions. Handles markdown fences,
 * trailing commas, and mildly truncated objects (common when output is cut off).
 */
export function extractJsonCandidate(text: string): string {
  let s = text.trim();
  if (!s) return s;

  const fenced = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenced) s = fenced[1].trim();

  const start = s.indexOf("{");
  if (start === -1) return s;

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end !== -1) return s.slice(start, end + 1);
  return s.slice(start);
}

/** Best-effort repair for truncated or slightly malformed LLM JSON. */
export function repairJson(text: string): string {
  let s = text.trim();
  s = s.replace(/,\s*([}\]])/g, "$1");

  if (!s.endsWith("}") && !s.endsWith("]")) {
    // Drop a dangling partial property at the end (truncated mid-value).
    s = s.replace(/,?\s*"[^"]*"\s*:\s*("(?:[^"\\]|\\.)*)?$/, "");
    s = s.replace(/,\s*$/, "");
  }

  // Close an unterminated string literal.
  const quoteCount = (s.match(/(?<!\\)"/g) ?? []).length;
  if (quoteCount % 2 !== 0) s += '"';

  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/]/g) ?? []).length;
  const openBraces = (s.match(/{/g) ?? []).length;
  const closeBraces = (s.match(/}/g) ?? []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) s += "}";

  return s;
}

export function parseJsonFromLlm<T>(text: string): T {
  const candidate = extractJsonCandidate(text);
  try {
    return JSON.parse(candidate) as T;
  } catch (firstErr) {
    try {
      return JSON.parse(repairJson(candidate)) as T;
    } catch {
      const msg =
        firstErr instanceof Error ? firstErr.message : "Invalid JSON";
      throw new SyntaxError(
        `Could not parse brand analysis JSON: ${msg}`,
      );
    }
  }
}
