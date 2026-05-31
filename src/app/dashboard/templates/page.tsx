"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Video } from "lucide-react";
import {
  HookTemplatePicker,
  type HookTemplateOption,
} from "@/components/dashboard/hook-template-picker";

export default function HookTemplatesGalleryPage() {
  const [premades, setPremades] = useState<HookTemplateOption[]>([]);
  const [templates, setTemplates] = useState<HookTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pRes, tRes] = await Promise.all([
          fetch("/api/hook-templates?kind=premade"),
          fetch("/api/hook-templates?kind=template"),
        ]);
        const pData = await pRes.json();
        const tData = await tRes.json();
        setPremades(pData.templates ?? []);
        setTemplates(tData.templates ?? []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hook templates</h1>
          <p className="mt-1 text-sm text-[#555]">
            Viral hook openers you can stitch in front of your app demo clips.
            Pick them when creating a Founder Hook Reel.
          </p>
        </div>
        <Link
          href="/dashboard/founder-hooks/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-[var(--ember)] px-4 py-2 text-sm font-semibold text-white shadow-[2px_2px_0_0_#000]"
        >
          <Video className="h-4 w-4" />
          Create reel
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#666]">
          Our premade hooks
        </h2>
        <p className="mt-1 text-xs text-[#666] mb-4">
          Curated A/B set — select these on the Hook Reels page under &ldquo;Our
          premade hooks&rdquo;.
        </p>
        <HookTemplatePicker
          templates={premades}
          selectedIds={[]}
          onChange={() => {}}
          loading={loading}
          readOnly
          variant="gallery"
        />
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#666]">
          Template library
        </h2>
        <p className="mt-1 text-xs text-[#666] mb-4">
          Reusable viral hooks for founders.
        </p>
        <HookTemplatePicker
          templates={templates}
          selectedIds={[]}
          onChange={() => {}}
          loading={loading}
          readOnly
          autoPlay
          variant="gallery"
        />
      </section>

      <Link
        href="/dashboard/founder-hooks/new"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-black underline"
      >
        Use a hook in a new reel
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
