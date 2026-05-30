/**
 * Renders community seed slides: real Unsplash photos + story copy overlays.
 * Mimics popular IG carousel patterns (photo + gradient + bold hook text).
 *
 * Usage: node scripts/generate-carousel-seed-slides.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "community-templates");
const W = 1080;
const H = 1350;
const SIZE = "w=1080&h=1350&fit=crop&q=85";
const HEADERS = { "User-Agent": "Mymo/1.0 (community template seed)" };

/** Curated Unsplash IDs per template (lifestyle / creator / product shots). */
const PHOTO_MANIFEST = {
  "pov-discovered": {
    photos: [
      "1555396273-367ea4eb4db5",
      "1516321318423-f06f85e504b3",
      "1497366216548-37526070297c",
      "1506905925346-21bda4d32df4",
      "1469334031218-e382a71b716b",
      "1522202176988-66273c2fd55f",
    ],
    tags: ["cafe", "smartphone", "workspace", "travel", "aesthetic", "coffee"],
  },
  "five-lessons": {
    photos: [
      "1450101499163-c8848c66ca85",
      "1507003211169-0a1dd7228f2d",
      "1556761175-5973dc0f32e7",
      "1542744173-8e7e53415bb0",
      "1517245386807-bb43f82c33c4",
      "1522202176988-66273c2fd55f",
      "1497366216548-37526070297c",
    ],
    tags: ["books", "portrait", "startup", "meeting", "writing", "study", "notebook"],
  },
  "myth-vs-reality": {
    photos: [
      "1571019613454-1cb2f99b2d8b",
      "1486312338219-ce68d2c6f44d",
      "1554224155-6726b3ff858f",
      "1521791136064-7986c2920216",
      "1551288049-bebda4e38f71",
    ],
    tags: ["gym", "conference", "laptop", "calendar", "handshake"],
  },
  "before-after": {
    photos: [
      "1556228578-0d85b1a4d571",
      "1523275335684-37898b6baf30",
      "1556742049-0cfed4f6a45d",
      "1571019613454-1cb2f99b2d8b",
      "1466844430638-7b6a1c046362",
      "1556742049-0cfed4f6a45d",
    ],
    tags: ["skincare", "product", "shopping", "fitness", "makeover", "retail"],
  },
  "step-by-step": {
    photos: [
      "1551288049-bebda4e38f71",
      "1555949963-aa79dcee981c",
      "1504384308090-c894fdcc538d",
      "1460925895917-afdab827c52f",
      "1551288049-bebda4e38f71",
      "1555949963-aa79dcee981c",
      "1504384308090-c894fdcc538d",
      "1460925895917-afdab827c52f",
    ],
    tags: ["coding", "developer", "dashboard", "iphone", "macbook", "tutorial", "office", "analytics"],
  },
  "red-green-flags": {
    photos: [
      "1529626455594-4ff0802cfb7e",
      "1519345182560-3f2917c472ef",
      "1506794778202-cad84cf45f1d",
      "1600880292203-757bb62b4baf",
      "1517245386807-bb43f82c33c4",
      "1529626455594-4ff0802cfb7e",
    ],
    tags: ["portrait", "friends", "businessman", "meeting", "date", "woman"],
  },
  "hot-take": {
    photos: [
      "1500648767791-00dcc994a43e",
      "1472099645785-5658abf4ff4e",
      "1534528741775-53994a69daeb",
      "1544005313-94ddf0286df2",
      "1500648767791-00dcc994a43e",
    ],
    tags: ["portrait", "fashion", "man", "woman", "editorial"],
  },
  framework: {
    photos: [
      "1553877522-43269d4ea984",
      "1552664730-d307ca884978",
      "1497366216548-37526070297c",
      "1553877522-43269d4ea984",
      "1552664730-d307ca884978",
      "1497366216548-37526070297c",
      "1553877522-43269d4ea984",
    ],
    tags: ["whiteboard", "brainstorm", "strategy", "teamwork", "analytics", "planning", "office"],
  },
  "us-vs-them": {
    photos: [
      "1523275335684-37898b6baf30",
      "1556742049-0cfed4f6a45d",
      "1558618666-fcd25c85cd64",
      "1523275335684-37898b6baf30",
      "1556742049-0cfed4f6a45d",
    ],
    tags: ["product", "checkout", "sneakers", "handmade", "shopping"],
  },
  "save-checklist": {
    photos: [
      "1450101499163-c8848c66ca85",
      "1554224155-6726b3ff858f",
      "1522202176988-66273c2fd55f",
      "1497366216548-37526070297c",
      "1556761175-5973dc0f32e7",
      "1542744173-8e7e53415bb0",
      "1450101499163-c8848c66ca85",
      "1554224155-6726b3ff858f",
    ],
    tags: ["checklist", "planner", "desk", "organizer", "office", "study", "notepad", "schedule"],
  },
  "pas-framework": {
    photos: [
      "1516321318423-f06f85e504b3",
      "1504384308090-c894fdcc538d",
      "1600880292203-757bb62b4baf",
      "1554224155-6726b3ff858f",
      "1522202176988-66273c2fd55f",
      "1556761175-5973dc0f32e7",
    ],
    tags: ["phone", "stress", "meeting", "finance", "teamwork", "success"],
  },
  "feature-walkthrough": {
    photos: [
      "1551288049-bebda4e38f71",
      "1460925895917-afdab827c52f",
      "1555949963-aa79dcee981c",
      "1497366216548-37526070297c",
      "1553877522-43269d4ea984",
      "1512941937669-90a1b58e7e9c",
      "1553877522-43269d4ea984",
    ],
    tags: ["dashboard", "analytics", "mobile", "saas", "demo", "iphone", "software"],
  },
};

/** @typedef {{ slug: string; handle: string; layout: string; theme: Record<string,string>; slides: { role: string; lines: string[]; badge?: string }[] }} CarouselSeed */

/** @type {CarouselSeed[]} */
const CAROUSELS = [
  {
    slug: "pov-discovered",
    handle: "@creatorhub",
    layout: "pov",
    theme: { accent: "#facc15", text: "#fafafa" },
    slides: [
      { role: "hook", lines: ["POV: you finally", "crack the hook formula", "everyone gatekeeps"] },
      { role: "body", lines: ["You've posted 47 times.", "Still stuck at 200 views.", "It's not the algorithm."] },
      { role: "body", lines: ["Slide 1 decides", "if anyone swipes.", "Not your caption.", "Not your hashtags."] },
      { role: "body", lines: ["Pattern interrupt", "+ one clear promise", "= people stay"] },
      { role: "body", lines: ["Save this before", "your next post"] },
      { role: "cta", lines: ["Follow for the", "full swipe script →"], badge: "PART 2" },
    ],
  },
  {
    slug: "five-lessons",
    handle: "Maya K.",
    layout: "numbered",
    theme: { accent: "#7c3aed", text: "#1e1b4b", card: "#ffffff" },
    slides: [
      { role: "hook", lines: ["5 lessons I wish", "I knew before", "building an audience"] },
      { role: "step", lines: ["Start before", "you feel ready"], badge: "1" },
      { role: "step", lines: ["Consistency beats", "talent every time"], badge: "2" },
      { role: "step", lines: ["Your niche finds you", "when you ship"], badge: "3" },
      { role: "step", lines: ["Document the process,", "don't wait for perfect"], badge: "4" },
      { role: "step", lines: ["Ship ugly.", "Refine in public."], badge: "5" },
      { role: "cta", lines: ["Save + follow", "for weekly scripts"] },
    ],
  },
  {
    slug: "myth-vs-reality",
    handle: "@growthlab",
    layout: "myth",
    theme: { mythText: "#fecaca", realText: "#bbf7d0", accent: "#fff" },
    slides: [
      { role: "hook", lines: ["MYTH vs", "REALITY", "(save this)"] },
      { role: "myth", lines: ["MYTH", "You need 10K", "followers to monetize"] },
      { role: "real", lines: ["REALITY", "You need 10 people", "who'd pay tomorrow"] },
      { role: "myth", lines: ["MYTH", "Post every single day"] },
      { role: "real", lines: ["REALITY", "Post when you have", "something worth saving"] },
    ],
  },
  {
    slug: "before-after",
    handle: "@shopflow",
    layout: "transform",
    theme: { accent: "#ea580c", text: "#fff" },
    slides: [
      { role: "hook", lines: ["BEFORE → AFTER", "Same product.", "Different story."] },
      { role: "before", lines: ["BEFORE", "Feature list.", "Zero emotion.", "No reason to swipe."] },
      { role: "body", lines: ["We tried:", "specs, discounts,", "influencer unboxings"] },
      { role: "turn", lines: ["Then we led with", "the transformation", "customers actually want"] },
      { role: "after", lines: ["AFTER", "Problem → result", "in 5 slides", "3× save rate"] },
      { role: "cta", lines: ["Steal this arc", "for your next drop →"] },
    ],
  },
  {
    slug: "step-by-step",
    handle: "DevTips Daily",
    layout: "tutorial",
    theme: { accent: "#2563eb", text: "#1e3a8a", card: "rgba(255,255,255,0.94)" },
    slides: [
      { role: "hook", lines: ["How to launch", "a carousel that", "actually converts"] },
      { role: "step", lines: ["Pick one painful", "problem your buyer", "already googles"], badge: "1" },
      { role: "step", lines: ["Write slide 1", "like a headline,", "not a title card"], badge: "2" },
      { role: "step", lines: ["One idea", "per slide.", "No paragraphs."], badge: "3" },
      { role: "step", lines: ["Use contrast:", "big number or", "bold claim"], badge: "4" },
      { role: "step", lines: ["End with save CTA", "+ one comment hook"], badge: "5" },
      { role: "step", lines: ["Repurpose top slide", "as a Reel hook"], badge: "6" },
      { role: "cta", lines: ["Track saves,", "not likes →"], badge: "7" },
    ],
  },
  {
    slug: "red-green-flags",
    handle: "@viralvault",
    layout: "flags",
    theme: { red: "#fca5a5", green: "#86efac", text: "#fff" },
    slides: [
      { role: "hook", lines: ["Red flags 🚩", "vs", "Green flags ✅", "in your hooks"] },
      { role: "red", lines: ["🚩", "Starts with", "Hey guys welcome back"] },
      { role: "green", lines: ["✅", "Opens with a", "specific painful moment"] },
      { role: "red", lines: ["🚩", "No reason to", "swipe to slide 2"] },
      { role: "green", lines: ["✅", "Slide 1 promises", "a payoff by slide 5"] },
      { role: "cta", lines: ["Save this checklist", "before you post"] },
    ],
  },
  {
    slug: "hot-take",
    handle: "Jordan Lee",
    layout: "hottake",
    theme: { accent: "#f472b6", text: "#fafafa" },
    slides: [
      { role: "hook", lines: ["Hot take:", "your carousel", "isn't flopping", "because of timing"] },
      { role: "body", lines: ["Everyone says:", "post at 7am", "use 30 hashtags"] },
      { role: "body", lines: ["The data says:", "slide 1 clarity", "beats everything"] },
      { role: "body", lines: ["If slide 2 doesn't", "pay off slide 1's promise,", "they're gone"] },
      { role: "cta", lines: ["Agree or disagree?", "Comment 👇"] },
    ],
  },
  {
    slug: "framework",
    handle: "@saasstudio",
    layout: "framework",
    theme: { accent: "#38bdf8", text: "#f8fafc" },
    slides: [
      { role: "hook", lines: ["The D.R.I.P.", "framework for", "carousels that get saved"] },
      { role: "phase", lines: ["D — Disrupt", "Pattern break on slide 1"], badge: "1" },
      { role: "phase", lines: ["R — Relate", "Name their exact pain"], badge: "2" },
      { role: "phase", lines: ["I — Inform", "Give 3–5 sharp steps"], badge: "3" },
      { role: "phase", lines: ["P — Push", "One CTA: save or DM"], badge: "4" },
      { role: "body", lines: ["Use this on every", "educational post"] },
      { role: "cta", lines: ["Screenshot slide 3", "for your next draft →"] },
    ],
  },
  {
    slug: "us-vs-them",
    handle: "@brandcompare",
    layout: "versus",
    theme: { themText: "#d1d5db", usText: "#fdba74", accent: "#ea580c" },
    slides: [
      { role: "hook", lines: ["THEM", "vs", "US", "why saves differ"] },
      { role: "them", lines: ["THEM ❌", "Wall of text", "on slide 1"] },
      { role: "us", lines: ["US ✅", "One bold claim", "+ visual proof"] },
      { role: "body", lines: ["Same offer.", "Different packaging.", "Different shares."] },
      { role: "cta", lines: ["Try the US format", "on your next launch →"] },
    ],
  },
  {
    slug: "save-checklist",
    handle: "@saveworthy",
    layout: "checklist",
    theme: { accent: "#0d9488", text: "#134e4a", card: "rgba(255,255,255,0.92)" },
    slides: [
      { role: "hook", lines: ["Save this checklist 📌", "Before you publish", "your next carousel"] },
      { role: "check", lines: ["☐ Hook promises", "a specific outcome"] },
      { role: "check", lines: ["☐ Each slide earns", "the next swipe"] },
      { role: "check", lines: ["☐ One stat or proof", "by slide 3"] },
      { role: "check", lines: ["☐ Text readable", "on mobile"] },
      { role: "check", lines: ["☐ CTA tells them", "exactly what to do"] },
      { role: "check", lines: ["☐ Repurpose slide 1", "as Reel cover"] },
      { role: "cta", lines: ["Done? Post it.", "Track saves for 48h."] },
    ],
  },
  {
    slug: "pas-framework",
    handle: "Copy Coach Ana",
    layout: "pas",
    theme: { accent: "#059669", text: "#fff" },
    slides: [
      { role: "hook", lines: ["Sound familiar?", "High clicks.", "Zero saves."] },
      { role: "problem", lines: ["THE PROBLEM", "Your carousel", "teaches nothing", "worth bookmarking"] },
      { role: "agitate", lines: ["So the algorithm", "shows it once", "and kills reach"] },
      { role: "agitate", lines: ["Every flop post", "trains the feed", "to ignore you"] },
      { role: "solution", lines: ["THE FIX", "Problem → steps →", "save CTA in 6 slides"] },
      { role: "cta", lines: ["Start with slide 1", "rewrite today →"] },
    ],
  },
  {
    slug: "feature-walkthrough",
    handle: "ProductPulse",
    layout: "product",
    theme: { accent: "#0284c7", text: "#0f172a", card: "rgba(255,255,255,0.93)" },
    slides: [
      { role: "hook", lines: ["Stop explaining", "your product", "in one static image"] },
      { role: "feature", lines: ["Slide 2:", "Show the pain", "in 8 words max"], badge: "Hook" },
      { role: "feature", lines: ["Slide 3–5:", "One feature =", "one outcome"], badge: "Demo" },
      { role: "feature", lines: ["Slide 6:", "Social proof", "or metric"], badge: "Proof" },
      { role: "feature", lines: ["Slide 7:", "Free trial /", "demo CTA"], badge: "CTA" },
      { role: "body", lines: ["Carousels beat", "single images", "for SaaS demos"] },
      { role: "cta", lines: ["Copy this structure", "for your launch →"] },
    ],
  },
];

// ── Photo download ──

const photoCache = new Map();

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function downloadUnsplash(photoId) {
  const url = `https://images.unsplash.com/photo-${photoId}?${SIZE}&auto=format&fm=jpg`;
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) throw new Error("Too small");
  return buf;
}

async function downloadFlickr(tag, lock) {
  const url = `https://loremflickr.com/1080/1350/${tag}?lock=${lock}`;
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Flickr ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) throw new Error("Too small");
  return buf;
}

async function fetchPhoto(slug, index) {
  const key = `${slug}:${index}`;
  if (photoCache.has(key)) return photoCache.get(key);

  const manifest = PHOTO_MANIFEST[slug];
  if (!manifest) return null;

  let buf;
  try {
    buf = await downloadUnsplash(manifest.photos[index] ?? manifest.photos[0]);
  } catch {
    const tag = manifest.tags[index] ?? manifest.tags[0];
    buf = await downloadFlickr(tag, hash(`${slug}-${index}-${tag}`));
  }
  photoCache.set(key, buf);
  await new Promise((r) => setTimeout(r, 200));
  return buf;
}

// ── Drawing helpers ──

function drawCover(ctx, img, zone = "center") {
  const scale = Math.max(W / img.width, H / img.height);
  const sw = W / scale;
  const sh = H / scale;
  let sx = (img.width - sw) / 2;
  let sy = (img.height - sh) / 2;
  if (zone === "top") sy = 0;
  else if (zone === "bottom") sy = Math.max(0, img.height - sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

function drawCoverHalf(ctx, img, side) {
  const halfW = W / 2;
  const scale = Math.max(halfW / img.width, H / img.height);
  const sw = halfW / scale;
  const sh = H / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  const dx = side === "left" ? 0 : halfW;
  ctx.drawImage(img, sx, sy, sw, sh, dx, 0, halfW, H);
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function scrimBottom(ctx, strength = 0.72, color = "#000") {
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
  g.addColorStop(0, hexToRgba(color, 0));
  g.addColorStop(0.45, hexToRgba(color, strength * 0.4));
  g.addColorStop(1, hexToRgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function scrimFull(ctx, strength = 0.55, color = "#000") {
  ctx.fillStyle = hexToRgba(color, strength);
  ctx.fillRect(0, 0, W, H);
}

function tint(ctx, color, strength = 0.55) {
  ctx.fillStyle = hexToRgba(color, strength);
  ctx.fillRect(0, 0, W, H);
}

function drawTextCard(ctx, y, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(48, y, W - 96, h, 28);
  ctx.fill();
}

function wrapLines(ctx, text, maxWidth, maxLines = 4) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function drawMultiline(ctx, lines, x, y, lineH, opts = {}) {
  const { align = "center", color = "#fff", font, maxWidth = W - 160, shadow = true } = opts;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const fs = font ?? "bold 64px Segoe UI, Arial, sans-serif";
  ctx.font = fs;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, maxWidth, 3));
  const startY = y - ((wrapped.length - 1) * lineH) / 2;

  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = color;
  wrapped.forEach((line, i) => ctx.fillText(line, x, startY + i * lineH));
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawProgress(ctx, i, total, color = "#fff") {
  const barW = W - 160;
  const x = 80;
  const y = H - 72;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.roundRect(x, y, barW, 10, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, (barW * (i + 1)) / total, 10, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 26px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${i + 1} / ${total}`, W / 2, y + 48);
}

function drawSwipe(ctx) {
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(W - 52, H / 2 - 18);
  ctx.lineTo(W - 18, H / 2);
  ctx.lineTo(W - 52, H / 2 + 18);
  ctx.closePath();
  ctx.fill();
}

function drawHandle(ctx, handle) {
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(108, 88, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 28px Segoe UI, Arial";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(handle, 160, 96);
  ctx.shadowColor = "transparent";
}

async function renderSlide(carousel, slide, index, total, photoBuf, extraPhotoBuf) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const t = carousel.theme;
  const layout = carousel.layout;

  // ── Photo background ──
  if (photoBuf) {
    const img = await loadImage(photoBuf);
    if (layout === "myth" && slide.role === "hook" && extraPhotoBuf) {
      const img2 = await loadImage(extraPhotoBuf);
      drawCoverHalf(ctx, img, "left");
      drawCoverHalf(ctx, img2, "right");
      scrimFull(ctx, 0.35);
    } else if (layout === "versus" && slide.role === "hook" && extraPhotoBuf) {
      const img2 = await loadImage(extraPhotoBuf);
      drawCoverHalf(ctx, img, "left");
      ctx.filter = "grayscale(80%) brightness(0.7)";
      drawCoverHalf(ctx, img2, "right");
      ctx.filter = "none";
      scrimFull(ctx, 0.25);
    } else if (layout === "transform" && slide.role === "before") {
      ctx.filter = "grayscale(100%) brightness(0.55)";
      drawCover(ctx, img);
      ctx.filter = "none";
      scrimFull(ctx, 0.45);
    } else if (layout === "transform" && slide.role === "after") {
      ctx.filter = "saturate(1.35) contrast(1.08)";
      drawCover(ctx, img, "center");
      ctx.filter = "none";
      scrimBottom(ctx, 0.5);
    } else {
      drawCover(ctx, img, slide.role === "hook" ? "top" : "center");
    }
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);
  }

  // ── Layout overlays + text ──
  if (layout === "pov") {
    scrimBottom(ctx, slide.role === "hook" ? 0.65 : 0.78);
    if (slide.role === "hook") {
      drawHandle(ctx, carousel.handle);
      ctx.fillStyle = t.accent;
      ctx.font = "800 36px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      ctx.fillText("POV", W / 2, 300);
      ctx.shadowColor = "transparent";
      drawMultiline(ctx, slide.lines, W / 2, 620, 78, { color: t.text, font: "800 72px Segoe UI, Arial" });
    } else if (slide.role === "cta") {
      drawMultiline(ctx, slide.lines, W / 2, 520, 70, { color: t.text, font: "800 64px Segoe UI, Arial" });
      ctx.fillStyle = t.accent;
      ctx.beginPath();
      ctx.roundRect(280, 780, 520, 88, 44);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "800 32px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillText(slide.badge ?? "FOLLOW →", W / 2, 828);
    } else {
      drawMultiline(ctx, slide.lines, W / 2, H / 2 + 40, 72, { color: t.text, font: "700 58px Segoe UI, Arial" });
    }
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "numbered") {
    if (slide.role === "hook") {
      scrimBottom(ctx, 0.75);
      drawMultiline(ctx, slide.lines, W / 2, 640, 76, { color: "#fff", font: "800 68px Segoe UI, Arial" });
    } else {
      drawTextCard(ctx, H - 520, 420, t.card);
      if (slide.badge) {
        ctx.globalAlpha = 0.1;
        ctx.font = "900 280px Segoe UI, Arial";
        ctx.fillStyle = t.accent;
        ctx.textAlign = "left";
        ctx.fillText(slide.badge, 72, H - 180);
        ctx.globalAlpha = 1;
        ctx.fillStyle = t.accent;
        ctx.font = "800 36px Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText(`LESSON ${slide.badge}`, 80, H - 460);
      }
      drawMultiline(ctx, slide.lines, 80, H - 300, 68, {
        align: "left",
        color: t.text,
        font: slide.role === "cta" ? "800 56px Segoe UI, Arial" : "700 52px Segoe UI, Arial",
        maxWidth: W - 160,
        shadow: false,
      });
    }
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "myth") {
    if (slide.role === "hook") {
      drawMultiline(ctx, slide.lines, W / 2, H / 2, 80, { color: "#fff", font: "900 64px Segoe UI, Arial" });
    } else if (slide.role === "myth") {
      tint(ctx, "#7f1d1d", 0.62);
      ctx.font = "900 100px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = t.mythText;
      ctx.fillText("✗", W / 2, 300);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 580, 68, { color: t.mythText, font: "800 54px Segoe UI, Arial" });
    } else if (slide.role === "real") {
      tint(ctx, "#14532d", 0.52);
      ctx.font = "900 100px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = t.realText;
      ctx.fillText("✓", W / 2, 300);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 580, 68, { color: t.realText, font: "800 54px Segoe UI, Arial" });
    }
    drawProgress(ctx, index, total, slide.role === "real" ? "#86efac" : slide.role === "myth" ? "#fca5a5" : "#fff");
  } else if (layout === "transform") {
    if (slide.role === "before") {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "800 44px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillText("BEFORE", W / 2, 200);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, H / 2, 68, { color: "#e5e7eb", font: "700 54px Segoe UI, Arial" });
    } else if (slide.role === "after") {
      ctx.fillStyle = t.accent;
      ctx.font = "800 44px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillText("AFTER", W / 2, 200);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 620, 68, { color: "#fff", font: "800 54px Segoe UI, Arial" });
    } else if (slide.role === "cta") {
      scrimFull(ctx, 0.5, t.accent);
      drawMultiline(ctx, slide.lines, W / 2, H / 2, 72, { color: "#fff", font: "800 62px Segoe UI, Arial" });
    } else {
      scrimBottom(ctx, 0.7);
      drawMultiline(ctx, slide.lines, W / 2, 620, 70, { color: t.text, font: "700 56px Segoe UI, Arial" });
    }
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "tutorial") {
    if (slide.role === "hook") {
      scrimBottom(ctx, 0.72);
      drawMultiline(ctx, slide.lines, W / 2, 640, 72, { color: "#fff", font: "800 64px Segoe UI, Arial" });
    } else {
      drawTextCard(ctx, 420, 720, t.card);
      if (slide.badge) {
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.arc(100, 480, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "900 44px Segoe UI, Arial";
        ctx.textAlign = "center";
        ctx.fillText(slide.badge, 100, 492);
        ctx.fillStyle = t.text;
        ctx.textAlign = "left";
        ctx.font = "800 34px Segoe UI, Arial";
        ctx.fillText(`STEP ${slide.badge}`, 170, 488);
      }
      drawMultiline(ctx, slide.lines, W / 2, 720, 68, {
        color: t.text,
        font: "700 50px Segoe UI, Arial",
        shadow: false,
      });
    }
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "flags") {
    const isGreen = slide.role === "green";
    const isRed = slide.role === "red";
    if (isRed) tint(ctx, "#450a0a", 0.58);
    else if (isGreen) tint(ctx, "#052e16", 0.48);
    else scrimFull(ctx, 0.45);

    if (slide.role === "hook") {
      drawMultiline(ctx, slide.lines, W / 2, H / 2, 80, { color: t.text, font: "800 62px Segoe UI, Arial" });
    } else {
      ctx.font = "900 100px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = isGreen ? t.green : t.red;
      ctx.fillText(slide.lines[0], W / 2, 280);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 560, 72, {
        color: isGreen ? t.green : t.red,
        font: "800 54px Segoe UI, Arial",
      });
    }
    drawProgress(ctx, index, total, isGreen ? t.green : isRed ? t.red : "#fff");
  } else if (layout === "hottake") {
    scrimBottom(ctx, 0.72);
    ctx.fillStyle = t.accent;
    ctx.fillRect(60, 60, 300, 8);
    ctx.font = "800 28px Segoe UI, Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = t.accent;
    ctx.fillText("UNPOPULAR OPINION", 60, 120);
    drawMultiline(ctx, slide.lines, slide.role === "hook" ? 80 : W / 2, slide.role === "hook" ? 520 : 620, 76, {
      align: slide.role === "hook" ? "left" : "center",
      color: t.text,
      font: "800 64px Segoe UI, Arial",
      maxWidth: W - (slide.role === "hook" ? 120 : 160),
    });
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "framework") {
    scrimFull(ctx, 0.52);
    if (slide.badge) {
      ctx.fillStyle = "rgba(56,189,248,0.2)";
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(80, 200, W - 160, 200, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.accent;
      ctx.font = "800 32px Segoe UI, Arial";
      ctx.textAlign = "left";
      ctx.fillText(`PHASE ${slide.badge}`, 120, 260);
    }
    drawMultiline(ctx, slide.lines, W / 2, slide.badge ? 340 : 520, 70, {
      color: t.text,
      font: slide.role === "hook" ? "800 62px Segoe UI, Arial" : "700 50px Segoe UI, Arial",
    });
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "versus") {
    if (slide.role === "hook") {
      drawMultiline(ctx, slide.lines, W / 2, H / 2, 80, { color: "#fff", font: "900 62px Segoe UI, Arial" });
    } else if (slide.role === "them") {
      tint(ctx, "#374151", 0.55);
      ctx.font = "900 80px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = t.themText;
      ctx.fillText("✗", W / 2, 280);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 560, 72, { color: t.themText, font: "800 52px Segoe UI, Arial" });
    } else if (slide.role === "us") {
      tint(ctx, "#ea580c", 0.35);
      ctx.font = "900 80px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = t.accent;
      ctx.fillText("✓", W / 2, 280);
      drawMultiline(ctx, slide.lines.slice(1), W / 2, 560, 72, { color: t.usText, font: "800 52px Segoe UI, Arial" });
    } else {
      scrimBottom(ctx, 0.65);
      drawMultiline(ctx, slide.lines, W / 2, 620, 72, { color: "#fff", font: "700 54px Segoe UI, Arial" });
    }
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "checklist") {
    drawTextCard(ctx, slide.role === "hook" ? 280 : 360, slide.role === "hook" ? 780 : 700, t.card);
    if (slide.role === "check") {
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(100, slide.role === "hook" ? 320 : 400, 56, 56, 10);
      ctx.stroke();
      if (index > 1) {
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(112, (slide.role === "hook" ? 320 : 400) + 30);
        ctx.lineTo(128, (slide.role === "hook" ? 320 : 400) + 48);
        ctx.lineTo(152, (slide.role === "hook" ? 320 : 400) + 12);
        ctx.stroke();
      }
    }
    drawMultiline(ctx, slide.lines, W / 2, slide.role === "hook" ? 480 : 620, 68, {
      color: t.text,
      font: slide.role === "hook" ? "800 58px Segoe UI, Arial" : "700 48px Segoe UI, Arial",
      shadow: false,
    });
    drawProgress(ctx, index, total, t.accent);
  } else if (layout === "pas") {
    if (slide.role === "solution" || slide.role === "cta") {
      tint(ctx, t.accent, 0.72);
      drawMultiline(ctx, slide.lines, W / 2, H / 2, 72, { color: t.text, font: "800 56px Segoe UI, Arial" });
    } else {
      scrimFull(ctx, slide.role === "agitate" ? 0.68 : 0.58);
      if (slide.role === "problem") {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "800 32px Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText("PROBLEM", 80, 160);
      }
      drawMultiline(ctx, slide.lines, W / 2, H / 2 + 40, 72, { color: t.text, font: "800 54px Segoe UI, Arial" });
    }
    drawProgress(ctx, index, total, "#fff");
  } else if (layout === "product") {
    if (slide.role === "hook") {
      scrimBottom(ctx, 0.7);
      drawMultiline(ctx, slide.lines, W / 2, 640, 72, { color: "#fff", font: "800 60px Segoe UI, Arial" });
    } else {
      drawTextCard(ctx, 520, 720, t.card);
      if (slide.badge) {
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.roundRect(80, 560, 200, 52, 26);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "800 28px Segoe UI, Arial";
        ctx.textAlign = "center";
        ctx.fillText(slide.badge.toUpperCase(), 180, 596);
      }
      drawMultiline(ctx, slide.badge ? slide.lines.slice(1) : slide.lines, W / 2, 780, 60, {
        color: t.text,
        font: "700 46px Segoe UI, Arial",
        shadow: false,
      });
      if (slide.badge) {
        ctx.fillStyle = t.text;
        ctx.font = "700 34px Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText(slide.lines[0], 80, 640);
      }
    }
    drawProgress(ctx, index, total, t.accent);
  }

  if (index < total - 1) drawSwipe(ctx);
  return canvas.toBuffer("image/jpeg", 92);
}

// ── Generate ──
let count = 0;
console.log("Downloading photos + rendering carousel slides…\n");

for (const carousel of CAROUSELS) {
  const dir = join(outDir, carousel.slug);
  mkdirSync(dir, { recursive: true });

  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const photoBuf = await fetchPhoto(carousel.slug, i);
    const extraPhotoBuf =
      (carousel.layout === "myth" || carousel.layout === "versus") && slide.role === "hook"
        ? await fetchPhoto(carousel.slug, (i + 1) % carousel.slides.length)
        : null;

    const buf = await renderSlide(carousel, slide, i, carousel.slides.length, photoBuf, extraPhotoBuf);
    writeFileSync(join(dir, `slide-${i + 1}.jpg`), buf);
    count++;
    console.log(`✓ ${carousel.slug}/slide-${i + 1}.jpg`);
  }
}

console.log(`\nRendered ${count} photo carousel slides → ${outDir}`);
