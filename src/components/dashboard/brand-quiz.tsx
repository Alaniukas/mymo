"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Check, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NicheSlug } from "@/lib/carousel/niches";
import {
  quizForNiche,
  type QuizResponse,
} from "@/lib/carousel/brand-quiz-questions";
import type { AppIdentityProfile } from "./brain-profile-editor";

// Step-by-step quiz that fills the brand identity without a website crawl. The
// questions adapt to the selected niche (see brand-quiz-questions.ts): brand
// name is typed, the rest are tap-to-select, and a final optional box captures
// anything the choices can't. Answers run through the same brand-analysis LLM as
// the URL crawl and merge into the profile.
export function BrandQuiz({
  niche,
  disabled = false,
  hasProfile = false,
  onComplete,
}: {
  niche: NicheSlug | null;
  disabled?: boolean;
  hasProfile?: boolean;
  onComplete: (identity: AppIdentityProfile) => void;
}) {
  const questions = useMemo(() => quizForNiche(niche), [niche]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = questions.length;
  const isLast = step === total - 1;
  const current = questions[step];
  const canSubmit = Object.values(answers).some((v) => v.trim().length > 0);

  // Close on Escape, unless a submit is in flight.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading]);

  function start() {
    setStep(0);
    setAnswers({});
    setError(null);
    setOpen(true);
  }

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setDone(false);
  }

  function goNext() {
    setStep((s) => Math.min(total - 1, s + 1));
  }

  // Tapping a choice records it and advances — keeps the quiz a few quick taps.
  function selectOption(value: string) {
    setAnswer(current.id, value);
    if (!isLast) window.setTimeout(goNext, 160);
  }

  async function submit() {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);

    const responses: QuizResponse[] = questions
      .map((q) => ({ prompt: q.prompt, value: (answers[q.id] ?? "").trim() }))
      .filter((r) => r.value.length > 0);

    try {
      const res = await fetch("/api/brand-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, answers: responses }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setDone(true);
      setOpen(false);
      onComplete(data.identity as AppIdentityProfile);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (isLast) submit();
    else goNext();
  }

  return (
    <div
      className={cn(
        "bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] transition-opacity",
        disabled && "opacity-60",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-[#666]">
            Answer a few quick questions and we&apos;ll build your brand identity.
          </p>
          {done && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Check className="w-4 h-4" />
              Brand identity updated from your answers.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={start}
          className="shrink-0 px-6 py-3 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {hasProfile || done ? "Retake the quiz" : "Take the quiz"}
        </button>
      </div>

      {disabled && (
        <p className="mt-3 text-xs text-[#999]">
          Choose a content type above to continue.
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={loading ? undefined : () => setOpen(false)}
        >
          <form
            onSubmit={handleNext}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_#000]"
          >
            <div className="flex items-center justify-between border-b-2 border-black px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Build your brand identity</h2>
                <p className="mt-0.5 text-xs text-[#666]">
                  Question {step + 1} of {total}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-md p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-1.5 bg-black/10">
              <div
                className="h-full bg-[var(--ember)] transition-[width] duration-300"
                style={{ width: `${((step + 1) / total) * 100}%` }}
              />
            </div>

            <div className="space-y-3 p-5">
              <label
                htmlFor="quiz-field"
                className="block text-base font-semibold"
              >
                {current.prompt}
              </label>

              {current.type === "select" ? (
                <div className="grid grid-cols-1 gap-2">
                  {current.options?.map((option) => {
                    const selected = answers[current.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => selectOption(option)}
                        aria-pressed={selected}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-[transform,box-shadow,border-color]",
                          selected
                            ? "border-[var(--ember)] bg-[var(--ember)]/5 shadow-[2px_2px_0_0_#000]"
                            : "border-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]",
                        )}
                      >
                        {option}
                        {selected && (
                          <Check className="h-4 w-4 shrink-0 text-[var(--ember)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : current.type === "textarea" ? (
                <textarea
                  id="quiz-field"
                  key={step}
                  autoFocus
                  rows={5}
                  value={answers[current.id] ?? ""}
                  onChange={(e) => setAnswer(current.id, e.target.value)}
                  placeholder={current.placeholder}
                  className="w-full resize-y rounded-lg border-2 border-black px-4 py-3 text-sm focus:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
                />
              ) : (
                <input
                  id="quiz-field"
                  key={step}
                  autoFocus
                  type="text"
                  value={answers[current.id] ?? ""}
                  onChange={(e) => setAnswer(current.id, e.target.value)}
                  placeholder={current.placeholder}
                  className="w-full rounded-lg border-2 border-black px-4 py-3 text-sm focus:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
                />
              )}

              {current.helper && (
                <p className="text-xs text-[#999]">{current.helper}</p>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t-2 border-black px-5 py-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || loading}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-medium text-[#666] transition-colors hover:bg-gray-100 hover:text-black disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex items-center gap-2">
                {!isLast && <span className="text-xs text-[#999]">Optional</span>}
                <button
                  type="submit"
                  disabled={loading || (isLast && !canSubmit)}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-[var(--ember)] px-6 py-2.5 font-semibold text-white shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[var(--ember-hover)] hover:shadow-[1px_1px_0_0_#000] disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isLast ? (
                    <Sparkles className="h-4 w-4" />
                  ) : null}
                  {loading
                    ? "Building profile..."
                    : isLast
                      ? "Build my profile"
                      : "Next"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
