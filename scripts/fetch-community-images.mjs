/**
 * Downloads real stock photos for community seed templates.
 * Primary: Unsplash CDN. Fallback: Lorem Flickr (tagged Flickr photos).
 *
 * Usage: node scripts/fetch-community-images.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "community-templates");

const SIZE = "w=1080&h=1350&fit=crop&q=85";

const MANIFEST = {
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

const HEADERS = { "User-Agent": "Mymo/1.0 (community template seed)" };

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

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

let ok = 0;
let fail = 0;

for (const [slug, { photos, tags }] of Object.entries(MANIFEST)) {
  const dir = join(outDir, slug);
  mkdirSync(dir, { recursive: true });

  for (let i = 0; i < photos.length; i++) {
    const dest = join(dir, `slide-${i + 1}.jpg`);
    const label = `${slug}/slide-${i + 1}`;

    try {
      let buf;
      try {
        buf = await downloadUnsplash(photos[i]);
      } catch {
        const tag = tags[i] ?? tags[0];
        buf = await downloadFlickr(tag, hash(`${slug}-${i}-${tag}`));
      }
      writeFileSync(dest, buf);
      console.log(`✓ ${label}.jpg (${Math.round(buf.length / 1024)} KB)`);
      ok++;
    } catch (err) {
      console.error(`✗ ${label}: ${err.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed → ${outDir}`);
