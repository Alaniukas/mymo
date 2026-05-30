import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "community-templates");

/** @typedef {{ slug: string; layout: string; palette: Record<string,string>; slideLabels: string[] }} TemplateDef */

/** @type {TemplateDef[]} */
const SEED_TEMPLATES = [
  {
    slug: "pov-discovered",
    layout: "pov",
    palette: { bg: "#0f172a", accent: "#34d399", text: "#f8fafc", muted: "#94a3b8" },
    slideLabels: [
      "POV: You just discovered this",
      "Nobody told you this part",
      "Here's what changes everything",
      "The moment it clicked",
      "Save this before it's gone",
      "Follow for part 2 →",
    ],
  },
  {
    slug: "five-lessons",
    layout: "numbered",
    palette: { bg: "#faf5ff", accent: "#9333ea", text: "#1e1b4b", muted: "#7c3aed" },
    slideLabels: [
      "5 lessons I wish I knew sooner",
      "Start before you're ready",
      "Consistency beats talent",
      "Your niche finds you",
      "Document, don't create",
      "Ship ugly, refine later",
      "Save + follow for more",
    ],
  },
  {
    slug: "myth-vs-reality",
    layout: "myth",
    palette: { myth: "#fef2f2", reality: "#ecfdf5", mythText: "#991b1b", realityText: "#065f46" },
    slideLabels: [
      "MYTH vs REALITY",
      "Myth: You need 10K followers",
      "Reality: You need 10 true fans",
      "Myth: Post every day",
      "Reality: Post when you have value",
    ],
  },
  {
    slug: "before-after",
    layout: "beforeafter",
    palette: { before: "#374151", after: "#fef3c7", beforeText: "#d1d5db", afterText: "#92400e", accent: "#f59e0b" },
    slideLabels: [
      "BEFORE → AFTER",
      "The problem (before)",
      "What we tried first",
      "The turning point",
      "The result (after)",
      "Shop the transformation →",
    ],
  },
  {
    slug: "step-by-step",
    layout: "steps",
    palette: { bg: "#eff6ff", accent: "#2563eb", text: "#1e3a8a", card: "#ffffff" },
    slideLabels: [
      "How to do X in 7 steps",
      "Set up your account",
      "Connect your data",
      "Choose a template",
      "Customize the layout",
      "Preview on mobile",
      "Export & publish",
      "Track results",
    ],
  },
  {
    slug: "red-green-flags",
    layout: "flags",
    palette: { red: "#fee2e2", green: "#dcfce7", redText: "#b91c1c", greenText: "#15803d" },
    slideLabels: [
      "Red flags vs Green flags",
      "They ghost after the hook",
      "They reply within 24h",
      "No social proof",
      "Real testimonials",
      "Save this checklist",
    ],
  },
  {
    slug: "hot-take",
    layout: "hottake",
    palette: { bg: "#09090b", accent: "#f472b6", text: "#fafafa", highlight: "#fde047" },
    slideLabels: [
      "Hot take nobody talks about",
      "Everyone says do this...",
      "But the data says otherwise",
      "Here's what actually works",
      "Agree or disagree?",
    ],
  },
  {
    slug: "framework",
    layout: "framework",
    palette: { bg: "#1e3a8a", accent: "#60a5fa", text: "#ffffff", node: "#3b82f6" },
    slideLabels: [
      "The FRAMEWORK",
      "Phase 1 — Discover",
      "Phase 2 — Define",
      "Phase 3 — Design",
      "Phase 4 — Deploy",
      "Phase 5 — Iterate",
      "Steal this framework →",
    ],
  },
  {
    slug: "us-vs-them",
    layout: "versus",
    palette: { them: "#f3f4f6", us: "#fff7ed", themText: "#6b7280", usText: "#c2410c", accent: "#ea580c" },
    slideLabels: [
      "Us vs Them",
      "Their approach",
      "Our approach",
      "The difference is clear",
      "Try us risk-free →",
    ],
  },
  {
    slug: "save-checklist",
    layout: "checklist",
    palette: { bg: "#f0fdfa", accent: "#0d9488", text: "#134e4a", check: "#14b8a6" },
    slideLabels: [
      "Save this checklist",
      "Audit your hook",
      "Fix your CTA",
      "Add social proof",
      "Optimize slide 1",
      "Test 3 variants",
      "Track saves",
      "Repurpose winners",
    ],
  },
  {
    slug: "pas-framework",
    layout: "pas",
    palette: { problem: "#1c1917", agitate: "#44403c", solution: "#059669", text: "#fafaf9" },
    slideLabels: [
      "Sound familiar?",
      "The PROBLEM",
      "Why it keeps happening",
      "The cost of doing nothing",
      "The SOLUTION",
      "Start here →",
    ],
  },
  {
    slug: "feature-walkthrough",
    layout: "app",
    palette: { bg: "#f8fafc", accent: "#0284c7", text: "#0f172a", screen: "#e2e8f0" },
    slideLabels: [
      "See it in action",
      "Dashboard overview",
      "Analytics at a glance",
      "Automations built-in",
      "Integrations hub",
      "Mobile app ready",
      "Try free for 14 days →",
    ],
  },
];

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text, max = 22) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function textBlock(lines, x, y, opts = {}) {
  const {
    fill = "#fff",
    size = 44,
    anchor = "middle",
    weight = "800",
    lineHeight = 52,
  } = opts;
  const tspans = lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="-0.02em">${tspans}</text>`;
}

function progress(i, total, color = "#fff") {
  const w = 880;
  const fill = (w * (i + 1)) / total;
  return `
  <rect x="100" y="1240" width="${w}" height="8" rx="4" fill="rgba(255,255,255,0.2)"/>
  <rect x="100" y="1240" width="${fill}" height="8" rx="4" fill="${color}"/>
  <text x="540" y="1285" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="system-ui" font-size="24" font-weight="600">${i + 1} / ${total}</text>`;
}

function swipeArrow() {
  return `<polygon points="1010,660 1055,675 1010,690" fill="rgba(255,255,255,0.45)"/>`;
}

function phoneMock(x, y, w, h, screenColor, label) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="#1e293b"/>
  <rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="28" fill="${screenColor}"/>
  <circle cx="${x + w / 2}" cy="${y + h - 28}" r="18" fill="#334155"/>
  ${label ? `<rect x="${x + 40}" y="${y + 80}" width="${w - 80}" height="12" rx="6" fill="rgba(255,255,255,0.5)"/><rect x="${x + 40}" y="${y + 110}" width="${w - 120}" height="8" rx="4" fill="rgba(255,255,255,0.3)"/>` : ""}`;
}

/** Layout renderers — each returns full SVG string */
const LAYOUTS = {
  pov(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 20);
    const isHook = i === 0;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><radialGradient id="v" cx="50%" cy="30%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="${p.bg}"/></radialGradient></defs>
  <rect width="1080" height="1350" fill="url(#v)"/>
  <ellipse cx="540" cy="420" rx="280" ry="280" fill="${p.accent}" opacity="0.12"/>
  ${isHook ? `<text x="540" y="200" text-anchor="middle" fill="${p.accent}" font-family="system-ui" font-size="32" font-weight="700" letter-spacing="0.15em">POV</text>` : ""}
  ${textBlock(lines, 540, isHook ? 520 : 580, { fill: p.text, size: isHook ? 58 : 42 })}
  <rect x="120" y="900" width="840" height="200" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <circle cx="200" cy="1000" r="48" fill="${p.accent}" opacity="0.35"/>
  <rect x="280" y="960" width="400" height="14" rx="7" fill="rgba(255,255,255,0.15)"/>
  <rect x="280" y="990" width="280" height="10" rx="5" fill="rgba(255,255,255,0.08)"/>
  ${progress(i, total, p.accent)}
  ${i < total - 1 ? swipeArrow() : `<rect x="340" y="1150" width="400" height="64" rx="32" fill="${p.accent}"/><text x="540" y="1192" text-anchor="middle" fill="${p.bg}" font-family="system-ui" font-size="26" font-weight="700">Follow →</text>`}
</svg>`;
  },

  numbered(tpl, label, i, total) {
    const p = tpl.palette;
    const num = i === 0 ? null : i;
    const lines = wrap(label, 18);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  <rect x="0" y="0" width="1080" height="180" fill="${p.accent}" opacity="0.12"/>
  ${num !== null ? `<text x="120" y="320" fill="${p.accent}" font-family="system-ui" font-size="180" font-weight="900" opacity="0.25">${num}</text><text x="120" y="200" fill="${p.accent}" font-family="system-ui" font-size="28" font-weight="700">LESSON ${num}</text>` : `<text x="120" y="200" fill="${p.accent}" font-family="system-ui" font-size="28" font-weight="700">PERSONAL BRAND</text>`}
  ${textBlock(lines, num !== null ? 120 : 540, num !== null ? 520 : 620, { fill: p.text, size: num !== null ? 48 : 52, anchor: num !== null ? "start" : "middle" })}
  <rect x="80" y="880" width="920" height="280" rx="24" fill="#fff" stroke="${p.accent}" stroke-width="3"/>
  <rect x="120" y="920" width="200" height="200" rx="16" fill="${p.accent}" opacity="0.15"/>
  <rect x="360" y="940" width="500" height="16" rx="8" fill="${p.accent}" opacity="0.3"/>
  <rect x="360" y="980" width="380" height="12" rx="6" fill="${p.accent}" opacity="0.15"/>
  <rect x="360" y="1020" width="420" height="12" rx="6" fill="${p.accent}" opacity="0.15"/>
  <text x="1000" y="1300" text-anchor="end" fill="${p.muted}" font-family="system-ui" font-size="24" font-weight="600">${i + 1}/${total}</text>
  ${i < total - 1 ? `<polygon points="1020,675 1060,675 1040,710" fill="${p.accent}" opacity="0.5"/>` : ""}
</svg>`;
  },

  myth(tpl, label, i, total) {
    const p = tpl.palette;
    const isTitle = i === 0;
    const isMyth = i % 2 === 1 && i > 0;
    const lines = wrap(label, 16);
    if (isTitle) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect x="0" y="0" width="540" height="1350" fill="${p.myth}"/>
  <rect x="540" y="0" width="540" height="1350" fill="${p.reality}"/>
  <text x="270" y="620" text-anchor="middle" fill="${p.mythText}" font-family="system-ui" font-size="56" font-weight="900">MYTH</text>
  <text x="810" y="620" text-anchor="middle" fill="${p.realityText}" font-family="system-ui" font-size="56" font-weight="900">REALITY</text>
  <line x1="540" y1="80" x2="540" y2="1270" stroke="#d1d5db" stroke-width="4"/>
  <text x="540" y="200" text-anchor="middle" fill="#374151" font-family="system-ui" font-size="36" font-weight="800">vs</text>
  ${swipeArrow()}
</svg>`;
    }
    const bg = isMyth ? p.myth : p.reality;
    const col = isMyth ? p.mythText : p.realityText;
    const badge = isMyth ? "MYTH" : "REALITY";
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  <rect x="80" y="80" width="200" height="56" rx="28" fill="${col}"/>
  <text x="180" y="118" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="24" font-weight="800">${badge}</text>
  ${isMyth ? `<text x="540" y="400" text-anchor="middle" fill="${col}" font-size="120">✗</text>` : `<text x="540" y="400" text-anchor="middle" fill="${col}" font-size="120">✓</text>`}
  ${textBlock(lines, 540, 680, { fill: col, size: 46 })}
  <text x="540" y="1280" text-anchor="middle" fill="${col}" font-family="system-ui" font-size="24" opacity="0.6">${i + 1} / ${total}</text>
  ${swipeArrow()}
</svg>`;
  },

  beforeafter(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 16);
    const phases = ["intro", "before", "mid", "turn", "after", "cta"];
    const phase = phases[i] ?? "mid";
    const showSplit = phase === "before" || phase === "after" || phase === "intro";
    if (showSplit && phase !== "intro") {
      const leftDark = phase === "before";
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect x="0" y="0" width="540" height="1350" fill="${leftDark ? p.before : p.after}"/>
  <rect x="540" y="0" width="540" height="1350" fill="${leftDark ? p.after : p.before}"/>
  <text x="270" y="120" text-anchor="middle" fill="${leftDark ? p.beforeText : p.afterText}" font-family="system-ui" font-size="28" font-weight="800">${leftDark ? "BEFORE" : "AFTER"}</text>
  <text x="810" y="120" text-anchor="middle" fill="${leftDark ? p.afterText : p.beforeText}" font-family="system-ui" font-size="28" font-weight="800">${leftDark ? "AFTER" : "BEFORE"}</text>
  ${textBlock(lines, 540, 640, { fill: leftDark ? p.beforeText : p.afterText, size: 40 })}
  <polygon points="520,600 560,640 520,680" fill="${p.accent}"/>
  ${swipeArrow()}
</svg>`;
    }
    const bg = phase === "intro" || phase === "cta" ? p.accent : i % 2 === 0 ? p.before : p.after;
    const txt = phase === "intro" || phase === "cta" ? "#fff" : i % 2 === 0 ? p.beforeText : p.afterText;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  ${phase === "cta" ? "" : `<rect x="100" y="200" width="880" height="500" rx="24" fill="rgba(255,255,255,0.15)"/>`}
  ${textBlock(lines, 540, phase === "cta" ? 600 : 520, { fill: txt, size: phase === "intro" ? 56 : 44 })}
  ${phase === "cta" ? `<rect x="290" y="900" width="500" height="72" rx="36" fill="#fff"/><text x="540" y="946" text-anchor="middle" fill="${p.accent}" font-family="system-ui" font-size="28" font-weight="800">Shop now →</text>` : progress(i, total, txt)}
  ${swipeArrow()}
</svg>`;
  },

  steps(tpl, label, i, total) {
    const p = tpl.palette;
    const stepNum = i;
    const lines = wrap(label, 18);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  ${i > 0 ? `<circle cx="120" cy="160" r="56" fill="${p.accent}"/><text x="120" y="175" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="48" font-weight="900">${stepNum}</text>` : ""}
  <text x="220" y="175" fill="${p.text}" font-family="system-ui" font-size="28" font-weight="700">${i === 0 ? "TUTORIAL" : `STEP ${stepNum}`}</text>
  <rect x="80" y="260" width="920" height="720" rx="28" fill="${p.card}" stroke="${p.accent}" stroke-width="3"/>
  ${phoneMock(340, 340, 400, 520, p.bg, true)}
  ${textBlock(lines, 540, i === 0 ? 980 : 1050, { fill: p.text, size: i === 0 ? 44 : 36 })}
  <rect x="80" y="1220" width="${(920 * (i + 1)) / total}" height="12" rx="6" fill="${p.accent}"/>
  <rect x="80" y="1220" width="920" height="12" rx="6" fill="${p.accent}" opacity="0.2"/>
  ${swipeArrow()}
</svg>`;
  },

  flags(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label.replace(/🚩|✅/g, "").trim(), 16);
    const isRed = i > 0 && i % 2 === 1;
    const isGreen = i > 0 && i % 2 === 0;
    if (i === 0) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect x="0" y="0" width="540" height="1350" fill="${p.red}"/>
  <rect x="540" y="0" width="540" height="1350" fill="${p.green}"/>
  <text x="270" y="580" text-anchor="middle" font-size="80">🚩</text>
  <text x="270" y="700" text-anchor="middle" fill="${p.redText}" font-family="system-ui" font-size="40" font-weight="900">RED FLAGS</text>
  <text x="810" y="580" text-anchor="middle" font-size="80">✅</text>
  <text x="810" y="700" text-anchor="middle" fill="${p.greenText}" font-family="system-ui" font-size="40" font-weight="900">GREEN FLAGS</text>
  ${swipeArrow()}
</svg>`;
    }
    const bg = isRed ? p.red : p.green;
    const col = isRed ? p.redText : p.greenText;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  <text x="120" y="200" font-size="72">${isRed ? "🚩" : "✅"}</text>
  <rect x="80" y="280" width="920" height="640" rx="24" fill="#fff" opacity="0.85"/>
  ${textBlock(lines, 540, 620, { fill: col, size: 48 })}
  <rect x="80" y="280" width="12" height="640" rx="6" fill="${col}"/>
  <text x="540" y="1280" text-anchor="middle" fill="${col}" font-family="system-ui" font-size="24" opacity="0.7">${i}/${total}</text>
  ${swipeArrow()}
</svg>`;
  },

  hottake(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 18);
    const isHook = i === 0;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  ${isHook ? `<rect x="60" y="60" width="960" height="8" fill="${p.accent}"/>` : ""}
  <text x="120" y="160" fill="${p.accent}" font-family="system-ui" font-size="24" font-weight="800" letter-spacing="0.2em">UNPOPULAR OPINION</text>
  ${textBlock(lines, isHook ? 120 : 540, isHook ? 480 : 580, { fill: p.text, size: isHook ? 64 : 46, anchor: isHook ? "start" : "middle" })}
  ${!isHook && i === 2 ? `<rect x="120" y="780" width="840" height="4" fill="${p.highlight}"/>` : ""}
  <rect x="120" y="1050" width="180" height="180" rx="90" fill="${p.accent}" opacity="0.2"/>
  <text x="210" y="1155" text-anchor="middle" fill="${p.accent}" font-size="64">🔥</text>
  <text x="960" y="1280" text-anchor="end" fill="${p.accent}" font-family="system-ui" font-size="22" font-weight="700">${i + 1}/${total}</text>
  ${swipeArrow()}
</svg>`;
  },

  framework(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 16);
    const phase = i;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  ${Array.from({ length: total }, (_, j) => {
    const cx = 140 + j * (800 / Math.max(total - 1, 1));
    const active = j <= i;
    return `<circle cx="${cx}" cy="1100" r="28" fill="${active ? p.accent : p.node}" opacity="${active ? 1 : 0.4}"/><text x="${cx}" y="1108" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="22" font-weight="800">${j + 1}</text>${j < total - 1 ? `<line x1="${cx + 28}" y1="1100" x2="${cx + (800 / Math.max(total - 1, 1)) - 28}" y2="1100" stroke="${p.accent}" stroke-width="4" opacity="${j < i ? 1 : 0.3}"/>` : ""}`;
  }).join("")}
  <rect x="120" y="180" width="840" height="720" rx="20" fill="${p.node}" opacity="0.5"/>
  ${phase > 0 ? `<rect x="160" y="220" width="760" height="100" rx="12" fill="${p.accent}"/><text x="200" y="285" fill="#fff" font-family="system-ui" font-size="32" font-weight="800">PHASE ${phase}</text>` : ""}
  ${textBlock(lines, 540, phase === 0 ? 520 : 480, { fill: p.text, size: phase === 0 ? 52 : 40 })}
  ${swipeArrow()}
</svg>`;
  },

  versus(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 14);
    if (i === 0) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect x="0" y="0" width="540" height="1350" fill="${p.them}"/>
  <rect x="540" y="0" width="540" height="1350" fill="${p.us}"/>
  <text x="270" y="600" text-anchor="middle" fill="${p.themText}" font-family="system-ui" font-size="48" font-weight="900">THEM</text>
  <text x="810" y="600" text-anchor="middle" fill="${p.usText}" font-family="system-ui" font-size="48" font-weight="900">US</text>
  <circle cx="540" cy="675" r="48" fill="${p.accent}"/><text x="540" y="688" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="28" font-weight="900">VS</text>
  ${swipeArrow()}
</svg>`;
    }
    const isThem = i === 1 || i === 3;
    const bg = isThem ? p.them : p.us;
    const col = isThem ? p.themText : p.usText;
    const icon = isThem ? "✗" : "✓";
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  <text x="540" y="320" text-anchor="middle" fill="${col}" font-size="100">${icon}</text>
  <text x="540" y="420" text-anchor="middle" fill="${col}" font-family="system-ui" font-size="32" font-weight="800">${isThem ? "THEIR APPROACH" : "OUR APPROACH"}</text>
  ${textBlock(lines, 540, 680, { fill: col, size: 44 })}
  ${i === total - 1 ? `<rect x="290" y="980" width="500" height="72" rx="36" fill="${p.accent}"/><text x="540" y="1026" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="26" font-weight="800">Try free →</text>` : swipeArrow()}
</svg>`;
  },

  checklist(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 20);
    const items = Math.min(i, 5);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  <rect x="80" y="80" width="920" height="1190" rx="28" fill="#fff" stroke="${p.accent}" stroke-width="3"/>
  ${i === 0 ? textBlock(lines, 540, 280, { fill: p.text, size: 48 }) : ""}
  ${Array.from({ length: items }, (_, j) => {
    const y = 320 + j * 100;
    const checked = j < i - 1;
    return `<rect x="140" y="${y}" width="48" height="48" rx="8" fill="${checked ? p.check : "none"}" stroke="${p.accent}" stroke-width="3"/>${checked ? `<path d="M152 ${y + 24} L168 ${y + 40} L196 ${y + 12}" stroke="#fff" stroke-width="4" fill="none"/>` : ""}<rect x="210" y="${y + 14}" width="${400 - j * 30}" height="14" rx="7" fill="${p.accent}" opacity="0.25"/>`;
  }).join("")}
  ${i > 0 ? textBlock(lines, 540, 1050, { fill: p.text, size: 38 }) : `<text x="540" y="500" text-anchor="middle" fill="${p.accent}" font-size="64">📌</text>`}
  <text x="540" y="1280" text-anchor="middle" fill="${p.accent}" font-family="system-ui" font-size="24" font-weight="600">${i + 1} / ${total} — Save this</text>
  ${swipeArrow()}
</svg>`;
  },

  pas(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 16);
    const stages = ["hook", "problem", "agitate", "cost", "solution", "cta"];
    const stage = stages[i] ?? "mid";
    const bgMap = { hook: p.problem, problem: p.problem, agitate: p.agitate, cost: "#292524", solution: p.solution, cta: p.solution };
    const bg = bgMap[stage] ?? p.problem;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  ${stage === "problem" || stage === "agitate" || stage === "solution" ? `<text x="120" y="140" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="22" font-weight="800" letter-spacing="0.15em">${stage.toUpperCase()}</text>` : ""}
  ${stage === "agitate" ? `<path d="M120 900 Q540 700 960 900" stroke="rgba(255,255,255,0.2)" stroke-width="3" fill="none"/>` : ""}
  ${stage === "solution" ? `<circle cx="540" cy="400" r="120" fill="rgba(255,255,255,0.15)"/><text x="540" y="420" text-anchor="middle" fill="#fff" font-size="80">✓</text>` : ""}
  ${textBlock(lines, 540, stage === "hook" ? 620 : 580, { fill: p.text, size: stage === "hook" ? 52 : 44 })}
  ${stage === "cta" ? `<rect x="290" y="900" width="500" height="72" rx="36" fill="#fff"/><text x="540" y="946" text-anchor="middle" fill="${p.solution}" font-family="system-ui" font-size="28" font-weight="800">Get started →</text>` : progress(i, total, "#fff")}
  ${swipeArrow()}
</svg>`;
  },

  app(tpl, label, i, total) {
    const p = tpl.palette;
    const lines = wrap(label, 18);
    const screens = ["hero", "dash", "chart", "auto", "plug", "mobile", "cta"];
    const screen = screens[i] ?? "dash";
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${p.bg}"/>
  <rect x="0" y="0" width="1080" height="100" fill="#fff"/>
  <circle cx="80" cy="50" r="24" fill="${p.accent}"/>
  <rect x="130" y="38" width="200" height="24" rx="12" fill="${p.text}" opacity="0.15"/>
  ${phoneMock(screen === "mobile" ? 290 : 190, screen === "hero" ? 180 : 140, screen === "mobile" ? 500 : 700, screen === "hero" ? 700 : 780, p.screen, screen !== "hero")}
  ${screen === "chart" ? `<rect x="250" y="500" width="80" height="200" rx="8" fill="${p.accent}" opacity="0.6"/><rect x="360" y="420" width="80" height="280" rx="8" fill="${p.accent}"/><rect x="470" y="460" width="80" height="240" rx="8" fill="${p.accent}" opacity="0.8"/><rect x="580" y="380" width="80" height="320" rx="8" fill="${p.accent}"/>` : ""}
  ${screen === "auto" ? `<rect x="250" y="400" width="580" height="80" rx="16" fill="#fff" stroke="${p.accent}" stroke-width="2"/><rect x="250" y="520" width="580" height="80" rx="16" fill="#fff" stroke="${p.accent}" stroke-width="2"/><rect x="250" y="640" width="580" height="80" rx="16" fill="${p.accent}"/>` : ""}
  ${textBlock(lines, 540, screen === "cta" ? 520 : 1080, { fill: p.text, size: screen === "hero" ? 48 : 36, anchor: "middle" })}
  ${screen === "cta" ? `<rect x="290" y="720" width="500" height="72" rx="36" fill="${p.accent}"/><text x="540" y="766" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="26" font-weight="800">Start free trial</text>` : `<text x="960" y="80" text-anchor="end" fill="${p.accent}" font-family="system-ui" font-size="22" font-weight="700">${i + 1}/${total}</text>`}
  ${swipeArrow()}
</svg>`;
  },
};

let count = 0;
for (const tpl of SEED_TEMPLATES) {
  const render = LAYOUTS[tpl.layout];
  if (!render) throw new Error(`Unknown layout: ${tpl.layout}`);
  const dir = join(outDir, tpl.slug);
  mkdirSync(dir, { recursive: true });
  tpl.slideLabels.forEach((label, i) => {
    writeFileSync(
      join(dir, `slide-${i + 1}.svg`),
      render(tpl, label, i, tpl.slideLabels.length),
    );
    count++;
  });
}

console.log(`Generated ${count} distinct SVG slides in ${outDir}`);
