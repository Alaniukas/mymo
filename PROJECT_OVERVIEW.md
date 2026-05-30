# Mymo — Project Overview

> Repository codename: **CarouselAI** 

This document is the single source of truth for what we're building, why, and how the
pieces fit together. It covers the value proposition, the business model, and the full
technical/business logic of the application as it exists in the code today.

---

## 1. TL;DR

Mymo is an **AI content engine for DTC/Shopify brands, SaaS companies, and agencies**. A
user points it at their website, Mymo learns their brand voice, and then generates
ready-to-post social content — and publishes it straight to LinkedIn, Instagram,
TikTok and more (via WoopSocial).

There are effectively **two layers** in this repo, and it's important to understand both:


| Layer                                  | What it says / does                                                                                                             | State                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Marketing site** (`/`, `/pricing`)   | Position as an **AI UGC video-ad generator** — 1000+ templates, 100+ AI actors, product videos, Meta-ready exports.             | Live, polished                |
| **Application** (`/dashboard/*` + API) | An **AI social-carousel generator + auto-publisher** — crawl → brand brain → captions → AI slide images → publish to IG/TikTok. | Functional core, several gaps |


> ⚠️ **Important divergence to be aware of:** the public marketing promises *UGC video
> ads with AI actors*, while the implemented backend produces *static carousel image
> posts*. Treat the marketing as the aspirational/positioning narrative and the dashboard
> pipeline as the shipped capability. See [§12 Current status & gaps](#12-current-status--known-gaps).

---

## 2. Value proposition

**"Get 1000+ UGC ads and product videos for just $19. Add your product. Pick your
winners. Done in 2 minutes. Scale."**

The core promise is **speed + volume + on-brand quality at near-zero marginal cost**:

- **Replace the UGC creator pipeline.** No briefing creators, paying $500/video, chasing
deliverables, or waiting weeks. The landing page contrasts the "before" (Stripe payouts
to creators, Slack chaos, creators who flake) against the "after" (a steady stream of
Shopify order + Meta Ads notifications).
- **On-brand automatically.** Mymo crawls your site once and builds a reusable brand
"brain" (tone, audience, value props, terminology) that powers every generation.
- **From idea to published in minutes.** Generation + review + one-click publishing to
Instagram and TikTok are built into the same workspace.
- **Volume for testing.** The "combinatorial" model (every hook × every demo) is designed
to mass-produce creative variations so brands can test many angles cheaply.

### Who it's for (from `src/lib/nav-menus.ts`)

- **E-commerce / DTC** — scale UGC, run ads for every SKU, test new markets, scale winning hooks.
- **SaaS** — find product-market fit, test new angles, launch UGC at scale.
- **Agencies** — deliver 5× more ads, save on creators, test large volumes of variations.

---

## 3. Business model & pricing


| Item             | Detail                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Intro offer**  | **$19 for 7 days** of full access (40 credits, 5 video downloads, 5 B-roll generations) |
| **Subscription** | Auto-renews at **$49/month** after the 7-day intro                                      |
| **Guarantee**    | 14-day money-back guarantee; cancel anytime                                             |
| **Ownership**    | Users own all output for commercial use — no royalties/attribution                      |
| **Social proof** | Trustpilot 4.8 / 147 reviews; "Join 1,000+ brands & creators"                           |


- Pricing is encoded in structured data (`SoftwareApplication` / `AggregateOffer`,
`lowPrice: 19`, `highPrice: 49`) for SEO in `src/app/page.tsx` and `src/app/pricing/page.tsx`.
- Primary CTA links to `**/checkout?type=intro`** (see gaps — checkout/billing is not yet implemented).

---

## 4. Tech stack


| Concern             | Choice                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Next.js 16.2.6** (App Router, Turbopack)                                                                                    |
| Language            | TypeScript 5, React 19.2.4                                                                                                    |
| Styling             | Tailwind CSS v4 (`@tailwindcss/postcss`), custom "neo-brutalist" theme (hard black borders, offset shadows, `--ember` accent) |
| Auth + DB + Storage | **Supabase** (`@supabase/ssr`, Postgres + RLS, Storage buckets)                                                               |
| AI gateway          | **EvoLink** via the OpenAI SDK (`openai` npm pkg)                                                                             |
| Icons               | `lucide-react`                                                                                                                |
| Fonts               | Geist, Inter, Instrument Serif, Caveat (`next/font`); Satoshi + Gambarino (Fontshare)                                         |
| Hosting             | Vercel                                                                                                                        |


---

## 5. High-level architecture

```
Browser (marketing + dashboard, React/Next App Router)
        │
        ├── Auth middleware (src/proxy.ts) ── guards /dashboard/*, /auth/*
        │
        ▼
Next.js Route Handlers (src/app/api/*)
        │
        ├── Supabase (Postgres + RLS, Auth, Storage)   ← workspaces, identities, assets,
        │                                                 combinations, carousels, slides,
        │                                                 social connections/posts, images
        │
        ├── EvoLink (AI gateway)
        │     ├── direct.evolink.ai/v1  → text  (gemini-3.5-flash): crawl parsing, captions
        │     └── api.evolink.ai/v1     → images (gpt-image-2 / nanobanana-2): slide images
        │
        └── WoopSocial (managed publishing backend, one API key)
              └── upload media → validate → create PUBLISH_NOW post
                  (LinkedIn, LinkedIn Pages, Instagram, Facebook, TikTok, X)
```

---

## 6. The product pipeline (core business logic)

The dashboard is a linear pipeline. The home screen (`/dashboard`) tracks completion of
each step via live counts (identity, hooks, demos, combinations, carousels, connections).

### Step 0 — Auth

- Email auth via Supabase (`/auth/login`, `/auth/signup`, callback at `/auth/callback`).
- `src/proxy.ts` middleware: unauthenticated users hitting `/dashboard/*` are redirected
to login (with `?next=`); authenticated users on `/auth/login|signup` are bounced to the dashboard.

### Step 1 — App Identity ("the Brain") · `/dashboard/onboarding`

- User submits their website URL → `**POST /api/crawl**`.
- The route creates a `workspace` (first time) or updates `app_url`, fetches the page,
strips HTML to ~15k chars, and sends it to the LLM with a brand-analyst prompt.
- Extracts and **upserts** into `app_identities`: `brand_tone`, `target_audience`,
`value_propositions[]`, `product_terminology` (jsonb), `llm_summary`, plus `raw_crawl_text`.
- The user can inline-edit every field. This profile is injected into every downstream prompt.

### Step 2 — Assets · `/dashboard/assets`

- Upload two asset types to Supabase Storage (`assets` bucket):
  - **Hooks** — lifestyle / attention-grabbing imagery.
  - **Demos** — product screenshots / demonstration imagery.

### Step 3 — Generate combinations · `/dashboard/generate`

- `**POST /api/generate-captions`** builds the **cartesian product** of every hook × every
demo (skipping pairs that already exist) and writes `combinations` rows.
- For each pair without a caption, it calls the LLM (brand context + asset names) with a
copywriter prompt to produce one scroll-stopping caption (≤150 words, brand-matched,
anti-"AI-slop" guardrails). Processed in **batches of 5** with `Promise.allSettled`;
successes → `ready`, failures → revert to `pending`.
- UI shows the combinatorial math: `Hooks × Demos = N combinations`.

### Step 4 — Review · `/dashboard/review`

- Approve / edit / reject captions individually or in bulk ("Approve All Ready", multi-select).
- Filter by status (`all / ready / approved / rejected / pending`). Status lifecycle:
`pending → generating → ready → approved | rejected`.

### Step 5 — Carousel generation · `/dashboard/carousels`

- `**POST /api/generate-carousel`** takes a set of slides (`position`, `role`, `caption`)
  - a `platform` and optional `combination_id` / `custom_topic`.
- Slide captions themselves can be authored by `**POST /api/generate-slide-captions**`
(`generateSlideCaptions`), which assigns roles automatically: slide 1 = **hook**, last = **cta**, middle = **value**.
- For each slide, `buildImagePrompt` composes an image prompt that bakes the caption in as
a **text overlay**, sets the aspect ratio per platform, injects brand tone, and adds
role-specific styling (hook = striking, value = clean/informative, cta = warm/action).
- Submits each slide to EvoLink `**gpt-image-2`** (quality `medium`). Up to **16** reference
images are passed as `image_urls` — when remixing a template, the matching template slide
image goes **first**, followed by uploaded brand assets. Persists `evolink_task_id` per slide.
- Creates a `carousels` row (`status = generating`) and `carousel_slides` rows
(`status = generating`). If all submissions fail, carousel reverts to `draft`.

**Platform → aspect ratio** (`src/lib/carousel/prompts.ts`):


| Platform    | Aspect |
| ----------- | ------ |
| `instagram` | `1:1`  |
| `tiktok`    | `9:16` |
| `both`      | `4:5`  |


### Templates & remix · `/dashboard/templates`

- A **template** is a public IG/TikTok carousel imported as a reusable **style reference**
(not a publishable carousel). `**POST /api/templates/import**` (5 req/min) validates a niche,
scrapes the post (Apify, reused from the importer), re-hosts each slide image to the
`templates` bucket, and writes a `carousel_templates` row. `**DELETE /api/templates/[id]**`
removes a template + its storage objects.
- **Niches**: `ecomm`, `app`, `personal_brand`, `viral` (`src/lib/carousel/niches.ts`).
- **Scope**: templates are either **global** (admin-curated, `workspace_id = null`, visible to
everyone, written with the service-role client) or **private** to the importing workspace.
RLS returns *global + own*; only admins create/delete global templates.
- **Remix**: in `/dashboard/carousels/new`, a *Niche → Template* start lets the user pick one
template + a topic. Generation passes the template slide images as references so each
generated slide echoes its layout/style slide-by-slide (slide *i* mimics template slide *i*,
modulo length) while using the brand + AI captions. The remixed carousel is a normal,
publishable `carousels` record.

### Step 6 — Async status polling

- EvoLink image generation is asynchronous (`pending → processing → completed/failed`).
- `**GET /api/carousel-status/[carouselId]`** (polled by the client, 120 req/min) checks
each generating slide's EvoLink task. On completion it **downloads the result image and
re-uploads it to the Supabase `carousels` bucket** (so we own a stable public URL;
falls back to the raw EvoLink URL if upload fails). Slides stuck >20 min, or whose task
404s, are marked `failed`. The carousel rolls up to `ready` once nothing is generating
and at least one slide completed.
- Related routes: `GET /api/generation-status/[taskId]`, `POST /api/generate-image`
(generic single-image generation), `/api/carousel/[carouselId]` and
`/api/carousel/[carouselId]/regenerate-slide` (per-slide retry).

### Step 7 — Connect socials · `/dashboard/connections`

- Publishing is handled by **WoopSocial** (`src/lib/social/woopsocial.ts`), a single
managed provider that owns the per-platform OAuth apps. The app holds one API key
(`WOOPSOCIAL_API_KEY`) — there are no Meta/TikTok/LinkedIn developer apps to register.
- Supported platforms: **LinkedIn, LinkedIn Pages, Instagram, Facebook, TikTok, X**.
- Connect flow: `GET /api/auth/woopsocial?platform=<p>` ensures a WoopSocial project for
the workspace (stored on `workspaces.woopsocial_project_id`), then redirects to
WoopSocial's hosted OAuth. On return, `/api/auth/woopsocial/callback` persists each
connected account into `social_connections` (`provider='woopsocial'`,
`woopsocial_account_id`, `woopsocial_project_id`, plus username/avatar). WoopSocial
holds the platform credentials, so no user access token is stored locally.


### Step 8 — Publish

- `**POST /api/publish/[carouselId]`** (5 req/min) validates ownership, gathers the
`completed` slide image URLs + a caption (from the linked combination, else carousel
title), and writes a `social_posts` record (`publishing`). It then publishes through
WoopSocial (`src/lib/social/woopsocial.ts`):
  1. Upload each slide image into the workspace's WoopSocial media library → `mediaId`s.
  2. `POST /posts/validate` to surface platform-specific issues (image counts, etc.).
  3. `POST /posts` with a `PUBLISH_NOW` schedule targeting the connected account, with
  per-platform fields (e.g. Instagram `postType=POST`, Facebook `IMAGE`, TikTok photo
  settings; LinkedIn/X need none).
- On success: `social_posts → published` (+ WoopSocial `platform_post_id`,
`published_at`) and `carousels → published`. On failure: `social_posts → failed` with
the error message.

---

## 7. The AI layer (EvoLink)

EvoLink is an OpenAI-compatible **AI gateway** used for both text and images.

- **Text** (`src/lib/openai/client.ts`): model `**gemini-3.5-flash`** via
`https://direct.evolink.ai/v1`, called with the OpenAI Chat Completions SDK. Defaults use
`reasoning_effort: "low"` and explicit `max_completion_tokens` so the model returns text
rather than spending the budget on hidden reasoning. Used for crawl parsing + all captions.
- **Images** (`src/lib/evolink/`): a typed client + model registry.


| Model slug                       | Name         | Notable                                                                                        |
| -------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `gpt-image-2`                    | GPT Image 2  | up to 16 reference images, prompt ≤32k chars — **default for carousel slides**                 |
| `gemini-3.1-flash-image-preview` | Nanobanana 2 | aliases `nanobanana`, `nanobanana-2`; supports model params (web/image search, thinking level) |


- `buildImagePayload` validates & clamps size/quality/resolution/n and reference-image
counts against the per-model config.
- Async lifecycle (`src/lib/evolink/types.ts`): submit → `EvolinkTask` with status &
progress → poll `tasks/{id}` → `results[]` URLs. `EvolinkError` distinguishes retryable
(server/quota/timeout) from terminal (content policy, invalid params) error codes;
`pollUntilComplete` supports a server-side polling helper (3s interval, 5min timeout).

---

## 8. Data model (Supabase Postgres)

All tables have **Row Level Security** scoped to the owning user through the workspace
ownership chain. Migrations live in `supabase/migrations/`.


| Table                | Purpose                           | Key fields                                                                                                                                              |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`         | One per user; the tenant boundary | `user_id`, `name`, `app_url`                                                                                                                            |
| `app_identities`     | The brand "brain"                 | `brand_tone`, `target_audience`, `value_propositions[]`, `product_terminology` (jsonb), `raw_crawl_text`, `llm_summary`                                 |
| `assets`             | Uploaded hooks & demos            | `type` (`hook`|`demo`), `storage_path`, `public_url`, `mime_type`, `file_size`                                                                          |
| `combinations`       | Hook × demo pairs + caption       | `hook_id`, `demo_id`, `caption`, `status` (`pending`|`generating`|`ready`|`approved`|`rejected`)                                                        |
| `carousels`          | A generated post                  | `title`, `platform`, `slide_count`, `status` (`draft`|`generating`|`ready`|`published`)                                                                 |
| `carousel_slides`    | Individual AI images              | `position`, `caption`, `prompt`, `image_url`, `storage_path`, `status` (`pending`|`generating`|`completed`|`failed`), `evolink_task_id`                 |
| `carousel_templates` | Reusable niche style templates    | `workspace_id` (null = **global**), `niche` (`ecomm`|`app`|`personal_brand`|`viral`), `title`, `source_url`, `source_platform`, `caption`, `slides` (jsonb: `{position, image_url, storage_path}[]`) |
| `social_connections` | Connected accounts (via WoopSocial) | `platform`, `provider` (`woopsocial`), `woopsocial_account_id`, `woopsocial_project_id`, `platform_username`, `avatar_url` — unique per `(workspace, platform)`. `access_token` is now optional (WoopSocial holds the platform credentials) |
| `social_posts`       | Publishing history                | `platform_post_id`, `status` (`pending`|`publishing`|`published`|`failed`), `error_message`, `published_at`                                             |


**Storage buckets** (public): `assets` (uploads), `carousels` (generated slide images), and
`templates` (re-hosted template slide images). An `updated_at` trigger keeps timestamps fresh
on the mutable tables.

---

## 9. Security

- **RLS everywhere** — every read/write is constrained to rows owned by `auth.uid()` via
the workspace chain.
- **Auth middleware** (`src/proxy.ts`) protects all dashboard routes server-side.
- **Rate limiting** (`src/lib/rate-limit.ts`) — in-memory token-bucket limiter keyed by
`IP:path` (or arbitrary key), with structured `security:rate_limit_exceeded` logging:
  - `generate-carousel`: 10/min
  - `publish`: 5/min
  - `carousel-status`: 120/min
- API routes re-verify the Supabase user and workspace ownership independently of the client.

> Note: the rate limiter is process-local in-memory, which is fine for a single instance
> but does not coordinate across serverless instances — see gaps.

---

## 10. Route map

**Pages**

- `/` — marketing landing (hero video marquee, before/after, FAQ, final CTA)
- `/pricing` — pricing, scale features, testimonials, trust, FAQ, sticky CTA
- `/auth/login`, `/auth/signup`, `/auth/callback`
- `/dashboard` — pipeline overview + quick actions
- `/dashboard/onboarding` — app identity / brand brain
- `/dashboard/assets` — hook & demo uploads
- `/dashboard/generate` — combination + caption generation
- `/dashboard/review` — approve / edit / reject
- `/dashboard/carousels`, `/dashboard/carousels/new`, `/dashboard/carousels/[id]`
- `/dashboard/templates` — import & manage niche style templates
- `/dashboard/connections` — connect socials (LinkedIn, IG, Facebook, TikTok, X) via WoopSocial

**API (route handlers)**

- `POST /api/crawl` — website → brand identity
- `POST /api/generate-captions` — hook×demo combinations + captions
- `POST /api/generate-slide-captions` — per-slide carousel copy
- `POST /api/generate-carousel` — submit slide image generations (optional `template_id` for remix)
- `POST /api/templates/import` — import a public IG/TikTok carousel as a niche **template** (scrape via Apify, re-host to the `templates` bucket); admin `scope=global` writes a shared template via the service-role client
- `DELETE /api/templates/[templateId]` — delete a template + its storage objects
- `POST /api/generate-image` — generic single image
- `GET  /api/carousel-status/[carouselId]` — poll + persist slide images
- `GET  /api/generation-status/[taskId]` — poll a single EvoLink task
- `GET/… /api/carousel/[carouselId]`, `…/regenerate-slide`
- `GET  /api/auth/woopsocial` + `/callback` — connect a social account via WoopSocial
- `POST /api/publish/[carouselId]` — publish a carousel via WoopSocial

---

## 11. Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=         # service-role key; required for admin settings + global templates

# Admin allowlist (comma-separated emails). Unset in non-prod = any signed-in user is admin
ADMIN_EMAILS=

# EvoLink AI gateway
EVOLINK_API_KEY=
EVOLINK_BASE_URL=            # optional, defaults to https://api.evolink.ai/v1

# App URL (used to build OAuth redirect URIs)
NEXT_PUBLIC_APP_URL=         # falls back to VERCEL_PROJECT_PRODUCTION_URL, then localhost:3000

# Social publishing — WoopSocial (single managed backend for all platforms)
WOOPSOCIAL_API_KEY=
WOOPSOCIAL_BASE_URL=         # optional, defaults to https://api.woopsocial.com/v1

# Apify (import a public IG/TikTok carousel as a template)
APIFY_TOKEN=                 # required for /api/templates/import
APIFY_INSTAGRAM_ACTOR=       # optional, defaults to apify~instagram-scraper
APIFY_TIKTOK_ACTOR=          # optional, defaults to clockworks~tiktok-scraper
```

---

## 12. Current status & known gaps

**Working today**

- Marketing site (landing + pricing) — polished and SEO-instrumented.
- Auth, workspace creation, website crawl → brand brain.
- Asset uploads, combination + caption generation, review workflow.
- Carousel slide image generation via EvoLink + async status/persistence.
- Social publishing via WoopSocial (LinkedIn, LinkedIn Pages, Instagram, Facebook,
  TikTok, X) — connect + one-click publish, no per-platform developer apps required.

**Gaps / things to reconcile**

1. **Positioning vs. implementation** — marketing sells *UGC video ads with AI actors*;
  the app generates *static image carousels*. Either build the video pipeline or align
   the marketing with the carousel capability.
2. **No checkout / billing** — the primary CTA points to `/checkout?type=intro`, but no
  checkout route or payment integration (e.g. Stripe) exists yet, despite the Stripe
   emblem appearing in landing imagery.
3. **No video generation** — there is no actor/video model wired up; only image models.
4. **Rate limiter is in-memory** — not shared across serverless instances; consider a
  durable store (e.g. Upstash/Redis) for production correctness.
5. **README** is still the default `create-next-app` boilerplate (this file supersedes it
  as the project overview).

---

## 13. Local development

```bash
npm install
npm run dev          # Next.js dev server on http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
```

Requires a populated `.env` (see §11) and a Supabase project with the migrations in
`supabase/migrations/` applied.