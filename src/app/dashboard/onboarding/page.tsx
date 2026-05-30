"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, Loader2, RefreshCw, ImageIcon, Dna, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import { NicheSelect } from "@/components/dashboard/niche-select";
import { BrandQuiz } from "@/components/dashboard/brand-quiz";
import { BrandIdentityCard } from "@/components/dashboard/brand-identity-card";
import { BrandImagesPanel } from "@/components/dashboard/brand-images-panel";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { type AppIdentityProfile } from "@/components/dashboard/brain-profile-editor";

type BrandTab = "identity" | "images";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId } = useActiveProject();
  const [url, setUrl] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [importSocialPhotos, setImportSocialPhotos] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialPreview, setSocialPreview] = useState<
    { id: string; caption: string; image_url: string }[]
  >([]);
  const [niche, setNiche] = useState<NicheSlug | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AppIdentityProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);
  const [importedAssets, setImportedAssets] = useState<{
    count: number;
    preview_urls: string[];
    logo_url: string | null;
    brand_color: string | null;
  } | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab: BrandTab = tabParam === "images" ? "images" : "identity";

  function setTab(tab: BrandTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "images") {
      params.set("tab", "images");
    } else {
      params.delete("tab");
    }
    const q = params.toString();
    router.replace(q ? `/dashboard/onboarding?${q}` : "/dashboard/onboarding", {
      scroll: false,
    });
  }

  const loadExisting = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    let ws: { id: string; app_url: string | null; niche?: string | null } | null =
      null;
    const withNiche = await supabase
      .from("workspaces")
      .select("id, app_url, niche")
      .eq("id", activeProjectId)
      .maybeSingle();

    if (withNiche.error) {
      const fallback = await supabase
        .from("workspaces")
        .select("id, app_url")
        .eq("id", activeProjectId)
        .maybeSingle();
      ws = fallback.data;
    } else {
      ws = withNiche.data;
    }

    const ident = ws
      ? (
          await supabase
            .from("app_identities")
            .select("*")
            .eq("workspace_id", activeProjectId)
            .limit(1)
            .maybeSingle()
        ).data
      : null;

    setUrl(ws?.app_url ?? "");
    setNiche(ws && isNiche(ws.niche) ? ws.niche : null);
    setIdentity((ident as AppIdentityProfile | null) ?? null);
    setPageLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    setPageLoading(true);
    loadExisting();
  }, [loadExisting]);

  async function handleSocialScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!niche) {
      setError("Pick what you're creating content for first.");
      return;
    }
    if (!socialUrl.trim()) {
      setError("Paste your Instagram or TikTok profile link.");
      return;
    }
    setError(null);
    setSocialLoading(true);
    setSocialPreview([]);

    try {
      const res = await fetch("/api/social/scrape-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_url: socialUrl,
          niche,
          import_photos: importSocialPhotos,
          post_limit: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Social scrape failed");
        return;
      }

      setIdentity(data.identity as AppIdentityProfile);
      setSocialPreview(data.preview_posts ?? []);
      if (data.assets_imported?.count > 0) {
        setImportedAssets({
          count: data.assets_imported.count,
          preview_urls: data.assets_imported.preview_urls ?? [],
          logo_url: null,
          brand_color: data.identity?.brand_color ?? null,
        });
      }
      setProfileVersion((v) => v + 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleCrawl(e: React.FormEvent) {
    e.preventDefault();
    if (!niche) {
      setError("Pick what you're creating content for first.");
      return;
    }
    if (!url.trim()) {
      setError("Enter your website URL, or skip this and take the quiz below.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, niche, workspaceName: "My Workspace" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setIdentity(data.identity as AppIdentityProfile);
      setImportedAssets(
        data.assets_imported
          ? {
              count: data.assets_imported.count ?? 0,
              preview_urls: data.assets_imported.preview_urls ?? [],
              logo_url: data.assets_imported.logo_url ?? null,
              brand_color: data.assets_imported.brand_color ?? null,
            }
          : null,
      );
      setProfileVersion((v) => v + 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  const urlStepDisabled = !niche;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand setup</h1>
        <p className="text-[#666] mt-1">
          Define your brand voice and add images in one place — everything you
          need before creating carousels.
        </p>
      </div>

      <div
        className="flex gap-1 p-1 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0_0_#000]"
        role="tablist"
        aria-label="Brand setup sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "identity"}
          onClick={() => setTab("identity")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            activeTab === "identity"
              ? "bg-[var(--ember)] text-white border-2 border-black shadow-[2px_2px_0_0_#000]"
              : "text-[#666] hover:bg-gray-50",
          )}
        >
          <Dna className="w-4 h-4 shrink-0" />
          Identity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "images"}
          onClick={() => setTab("images")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            activeTab === "images"
              ? "bg-[var(--ember)] text-white border-2 border-black shadow-[2px_2px_0_0_#000]"
              : "text-[#666] hover:bg-gray-50",
          )}
        >
          <ImageIcon className="w-4 h-4 shrink-0" />
          Images
        </button>
      </div>

      {activeTab === "images" ? (
        <BrandImagesPanel workspaceId={activeProjectId} />
      ) : (
        <div className="space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <StepBadge n={1} />
              <h2 className="text-lg font-bold">
                What are you creating content for?
              </h2>
            </div>
            <NicheSelect value={niche} onChange={setNiche} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <StepBadge n={2} active={!urlStepDisabled} />
              <h2
                className={cn(
                  "text-lg font-bold",
                  urlStepDisabled && "text-[#999]",
                )}
              >
                Add your website
              </h2>
              <span className="rounded-full border border-black/15 bg-black/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#666]">
                Optional
              </span>
            </div>

            <form
              onSubmit={handleCrawl}
              className={cn(
                "bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] transition-opacity",
                urlStepDisabled && "opacity-60",
              )}
            >
              <label htmlFor="app-url" className="block text-sm font-medium mb-2">
                Your Website / Product URL
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999]" />
                  <input
                    id="app-url"
                    type="url"
                    disabled={urlStepDisabled}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yoursite.com"
                    className="w-full pl-11 pr-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:border-[var(--ember)] disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || urlStepDisabled}
                  className="px-6 py-3 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2 shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : identity ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : null}
                  {loading
                    ? "Analyzing..."
                    : identity
                      ? "Re-analyze"
                      : "Analyze & import"}
                </button>
              </div>

              {urlStepDisabled && (
                <p className="mt-2 text-xs text-[#999]">
                  Choose a content type above to continue.
                </p>
              )}

              {importedAssets && importedAssets.count > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    Imported {importedAssets.count} image
                    {importedAssets.count === 1 ? "" : "s"} into your library
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {importedAssets.logo_url && (
                      <img
                        src={importedAssets.logo_url}
                        alt="Logo"
                        className="h-10 w-10 rounded border border-black/10 bg-white object-contain p-1"
                      />
                    )}
                    {importedAssets.preview_urls.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className="h-14 w-14 rounded border border-black/10 object-cover"
                      />
                    ))}
                  </div>
                  {importedAssets.brand_color && (
                    <p className="mt-2 text-xs flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded border border-black/20"
                        style={{ backgroundColor: importedAssets.brand_color }}
                      />
                      Brand color {importedAssets.brand_color}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setTab("images")}
                    className="mt-3 text-sm font-semibold text-emerald-900 underline hover:no-underline"
                  >
                    View in Images tab →
                  </button>
                </div>
              )}
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <StepBadge n={3} active={!urlStepDisabled} />
              <h2
                className={cn(
                  "text-lg font-bold",
                  urlStepDisabled && "text-[#999]",
                )}
              >
                Connect your social account
              </h2>
              <span className="rounded-full border border-black/15 bg-black/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#666]">
                Recommended
              </span>
            </div>
            <p className="text-sm text-[#666]">
              Paste your IG or TikTok profile — we scrape real posts, voice, fonts
              vibe and fill your brand identity automatically.
            </p>

            <form
              onSubmit={handleSocialScrape}
              className={cn(
                "bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] transition-opacity",
                urlStepDisabled && "opacity-60",
              )}
            >
              <label htmlFor="social-url" className="block text-sm font-medium mb-2">
                Instagram / TikTok profile URL
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999]" />
                  <input
                    id="social-url"
                    type="url"
                    disabled={urlStepDisabled}
                    value={socialUrl}
                    onChange={(e) => setSocialUrl(e.target.value)}
                    placeholder="https://instagram.com/yourbrand or tiktok.com/@you"
                    className="w-full pl-11 pr-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:border-[var(--ember)] disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={socialLoading || urlStepDisabled}
                  className="px-5 py-3 rounded-lg bg-[#1a1a1a] hover:bg-black text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2 shrink-0"
                >
                  {socialLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  {socialLoading ? "Scanning…" : "Scrape & fill identity"}
                </button>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-[#555] cursor-pointer">
                <input
                  type="checkbox"
                  checked={importSocialPhotos}
                  onChange={(e) => setImportSocialPhotos(e.target.checked)}
                  disabled={urlStepDisabled}
                  className="rounded border-black/30"
                />
                Also import post photos into my library
              </label>

              {socialPreview.length > 0 && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
                  <p className="font-medium">
                    Analyzed {socialPreview.length} recent posts — brand identity updated
                  </p>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {socialPreview.map((p) => (
                      <div
                        key={p.id}
                        className="aspect-square overflow-hidden rounded border border-black/10 bg-white"
                        title={p.caption}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <StepBadge n={4} active={!urlStepDisabled} />
              <h2
                className={cn(
                  "text-lg font-bold",
                  urlStepDisabled && "text-[#999]",
                )}
              >
                Take the quiz
              </h2>
            </div>

            <BrandQuiz
              niche={niche}
              disabled={urlStepDisabled}
              hasProfile={!!identity}
              onComplete={(nextIdentity) => {
                setIdentity(nextIdentity);
                setProfileVersion((v) => v + 1);
              }}
            />
          </section>

          {identity && (
            <section className="space-y-3">
              <BrandIdentityCard
                key={profileVersion}
                identity={identity}
                niche={niche}
              />
            </section>
          )}

          <p className="text-sm text-[#666] text-center">
            Need to upload or manage photos?{" "}
            <button
              type="button"
              onClick={() => setTab("images")}
              className="font-semibold text-[var(--ember)] underline hover:no-underline"
            >
              Go to Images tab
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function StepBadge({ n, active = true }: { n: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 border-black",
        active ? "bg-black text-white" : "bg-white text-[#999]",
      )}
    >
      {n}
    </span>
  );
}
