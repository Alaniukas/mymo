// Derives short, search-friendly keyword chips from a workspace's brand data
// (name, product terminology, target audience) to seed trending-sound lookups.

export function deriveKeywords(
  workspaceName: string | null,
  productTerminology: unknown,
  targetAudience: string | null,
): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length >= 2 && t.length <= 28) out.add(t);
    }
  };

  add(workspaceName);
  if (productTerminology && typeof productTerminology === "object") {
    if (Array.isArray(productTerminology)) {
      productTerminology.forEach(add);
    } else {
      Object.keys(productTerminology as Record<string, unknown>).forEach(add);
    }
  }
  add(targetAudience);

  return Array.from(out).slice(0, 6);
}
