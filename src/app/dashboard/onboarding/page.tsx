"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import { NicheSelect } from "@/components/dashboard/niche-select";
import { BrandQuiz } from "@/components/dashboard/brand-quiz";
import { BrandIdentityCard } from "@/components/dashboard/brand-identity-card";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { type AppIdentityProfile } from "@/components/dashboard/brain-profile-editor";

export default function OnboardingPage() {
  const { activeProjectId } = useActiveProject();
  const [url, setUrl] = useState("");
  const [niche, setNiche] = useState<NicheSlug | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AppIdentityProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  // Bumped whenever a crawl/quiz writes a fresh identity so the editor remounts
  // with the new values (it seeds its state from `initial` on mount only).
  const [profileVersion, setProfileVersion] = useState(0);

  const loadExisting = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    // Read the niche column too, falling back if migration 012 hasn't run yet.
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

    // Apply all state after the awaits (never synchronously inside the effect)
    // so switching projects fully resets the form instead of leaking the
    // previous project's URL / niche / identity.
    setUrl(ws?.app_url ?? "");
    setNiche(ws && isNiche(ws.niche) ? ws.niche : null);
    setIdentity((ident as AppIdentityProfile | null) ?? null);
    setPageLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

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
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Identity</h1>
        <p className="text-[#666] mt-1">
          Tell us what you&apos;re creating content for, then take a quick quiz —
          or add your website — and we&apos;ll build a brand voice profile that
          powers all your content.
        </p>
      </div>

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
              className="px-6 py-3 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : identity ? (
                <RefreshCw className="w-4 h-4" />
              ) : null}
              {loading ? "Analyzing..." : identity ? "Re-crawl" : "Analyze"}
            </button>
          </div>

          {urlStepDisabled && (
            <p className="mt-2 text-xs text-[#999]">
              Choose a content type above to continue.
            </p>
          )}

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={3} active={!urlStepDisabled} />
          <h2
            className={cn("text-lg font-bold", urlStepDisabled && "text-[#999]")}
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
    </div>
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
