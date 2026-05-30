import { describe, expect, it } from "vitest";
import { extractPageAssets, resolvePageUrl } from "./page-assets";

describe("resolvePageUrl", () => {
  it("resolves relative paths against the page URL", () => {
    expect(resolvePageUrl("/img/hero.png", "https://example.com/about")).toBe(
      "https://example.com/img/hero.png",
    );
  });
});

describe("extractPageAssets", () => {
  it("pulls og image, theme color, and apple touch icon", () => {
    const html = `
      <html>
        <head>
          <meta name="theme-color" content="#5B3DF5" />
          <meta property="og:image" content="https://cdn.example.com/hero.jpg" />
          <link rel="apple-touch-icon" href="/icons/touch.png" />
        </head>
        <body><img src="/photos/product-a.png" alt="Our product" /></body>
      </html>
    `;
    const out = extractPageAssets(html, "https://shop.example.com/");
    expect(out.brandColor).toBe("#5B3DF5");
    expect(out.imageUrls[0]).toBe("https://cdn.example.com/hero.jpg");
    expect(out.imageUrls.some((u) => u.includes("product-a.png"))).toBe(true);
    expect(out.logoUrl).toContain("touch.png");
    expect(out.assetHints).toContain("Primary brand color");
  });

  it("skips junk tracking pixels", () => {
    const html = `
      <img src="https://evil.com/pixel.gif" alt="tracking" />
      <meta property="og:image" content="https://brand.io/cover.webp" />
    `;
    const out = extractPageAssets(html, "https://brand.io");
    expect(out.imageUrls).toEqual(["https://brand.io/cover.webp"]);
  });
});
