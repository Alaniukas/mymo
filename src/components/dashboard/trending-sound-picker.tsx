"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  Loader2,
  Search,
  Music,
  Play,
  Pause,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { deriveKeywords } from "@/lib/trends/keywords";
import { useActiveProject } from "@/components/dashboard/project-provider";
import type { TrendingSound } from "@/lib/trends/types";

interface TrendingSoundPickerProps {
  selected: TrendingSound | null;
  onSelect: (sound: TrendingSound | null) => void;
}

// EnsembleData has no keyword-free "trending" endpoint — the closest proxy is
// Music Search sorted by most-used. So we seed the picker with broad, popular
// "vibe" terms (which actually match song titles) to surface suggested sounds.
// Brand names like a workspace title rarely match any track, so they can't
// drive the default suggestions.
const VIBE_SUGGESTIONS = [
  "viral",
  "aesthetic",
  "phonk",
  "chill",
  "upbeat",
  "vlog",
  "trending",
  "motivational",
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TrendingSoundPicker({
  selected,
  onSelect,
}: TrendingSoundPickerProps) {
  const { activeProjectId, activeProject } = useActiveProject();
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sounds, setSounds] = useState<TrendingSound[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandChips, setBrandChips] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const didInit = useRef(false);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setError(null);
    setKeyword(q);
    try {
      const res = await fetch(`/api/trends?keyword=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.configured === false) {
        setConfigured(false);
        setSounds([]);
        return;
      }
      setConfigured(true);
      if (!res.ok) {
        // Surface the real provider problem (e.g. unverified token, expired
        // plan, quota) instead of a misleading "no results" message that sends
        // users on a fruitless keyword hunt.
        setError(data.error || "Couldn't load sounds. Please try again.");
        setSounds([]);
        return;
      }
      setSounds(data.sounds ?? []);
    } catch {
      setError("Couldn't reach the trends service. Please try again.");
      setSounds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Show suggested (popular) sounds immediately so the picker is never empty —
  // the user can grab a trend without having to guess an exact song title.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setInput(VIBE_SUGGESTIONS[0]);
    runSearch(VIBE_SUGGESTIONS[0]);
  }, [runSearch]);

  // Pull a few brand-flavored keyword ideas from the active project, offered as
  // extra chips next to the vibe suggestions (they may not match song titles,
  // so they never drive the default load).
  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();

      const { data: identity } = await supabase
        .from("app_identities")
        .select("product_terminology, target_audience")
        .eq("workspace_id", activeProjectId)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      setBrandChips(
        deriveKeywords(
          activeProject?.name ?? null,
          identity?.product_terminology,
          identity?.target_audience ?? null,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, activeProject?.name]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function togglePlay(sound: TrendingSound) {
    if (!sound.playUrl) return;
    if (playingId === sound.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(sound.playUrl);
    audio.addEventListener("ended", () => setPlayingId(null));
    audioRef.current = audio;
    audio.play().catch(() => setPlayingId(null));
    setPlayingId(sound.id);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(input);
  }

  // Vibe suggestions first (they reliably return sounds), then any brand-flavored
  // ideas, de-duplicated and capped so the chip row stays tidy.
  const suggestionChips = Array.from(
    new Set([...VIBE_SUGGESTIONS, ...brandChips]),
  ).slice(0, 10);

  return (
    <div className="space-y-3">
      {selected && (
        <div className="flex items-center gap-3 bg-[var(--ember)]/5 border-2 border-[var(--ember)] rounded-lg px-3 py-2">
          {selected.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={selected.coverUrl}
              alt={selected.title}
              className="w-10 h-10 rounded object-cover border border-black/10"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
              <Music className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold line-clamp-1">{selected.title}</p>
            <p className="text-xs text-[#666] line-clamp-1">{selected.author}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="p-1.5 rounded-md hover:bg-white transition-colors"
            aria-label="Remove sound"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search sounds by niche or vibe (e.g. skincare, gym)"
            className="w-full pl-9 pr-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </button>
      </form>

      {suggestionChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#999]">Suggested</span>
          {suggestionChips.map((s) => {
            const active = keyword.toLowerCase() === s.toLowerCase();
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setInput(s);
                  runSearch(s);
                }}
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full border-2 capitalize transition-colors",
                  active
                    ? "bg-black text-white border-black"
                    : "border-gray-200 hover:border-black",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      {!configured ? (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Trending sounds aren&apos;t connected yet (set{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">
              ENSEMBLE_DATA_TOKEN
            </code>
            ). You can still generate without a sound.
          </span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ember)]" />
        </div>
      ) : sounds.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {sounds.slice(0, 9).map((sound) => {
            const isSel = selected?.id === sound.id;
            return (
              <button
                key={sound.id}
                type="button"
                onClick={() => onSelect(isSel ? null : sound)}
                className={cn(
                  "relative text-left rounded-lg border-2 overflow-hidden transition-colors bg-white",
                  isSel
                    ? "border-[var(--ember)] ring-2 ring-[var(--ember)]"
                    : "border-gray-200 hover:border-black",
                )}
              >
                <div className="relative aspect-square bg-gray-100">
                  {sound.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={sound.coverUrl}
                      alt={sound.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Music className="w-6 h-6 text-gray-300" />
                    </div>
                  )}

                  {sound.playUrl && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay(sound);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          togglePlay(sound);
                        }
                      }}
                      className="absolute bottom-1 left-1 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-black shadow-sm"
                    >
                      {playingId === sound.id ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 translate-x-px" />
                      )}
                    </span>
                  )}

                  {isSel && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--ember)] text-white border border-black">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold line-clamp-1" title={sound.title}>
                    {sound.title}
                  </p>
                  <p className="text-[11px] text-[#666] line-clamp-1">
                    {formatCount(sound.usageCount)} videos
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : searched ? (
        <p className="text-xs text-[#999] py-4 text-center">
          No sounds found for “{keyword}”. Try another keyword.
        </p>
      ) : null}
    </div>
  );
}
