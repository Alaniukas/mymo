"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { HookTemplate, HookTemplateKind } from "@/lib/hook-templates/types";

const emptyForm = {
  title: "",
  hook_line: "",
  creator_prompt: "",
  motion_prompt: "",
  preview_image_url: "",
  preview_video_url: "",
  kind: "premade" as HookTemplateKind,
  published: true,
  sort_order: 0,
};

export function HookTemplatesAdmin() {
  const [templates, setTemplates] = useState<HookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hook-templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTemplates(data.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        preview_image_url: form.preview_image_url.trim() || null,
        preview_video_url: form.preview_video_url.trim() || null,
      };
      const res = await fetch(
        editingId ? `/api/admin/hook-templates/${editingId}` : "/api/admin/hook-templates",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this hook?")) return;
    const res = await fetch(`/api/admin/hook-templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Delete failed");
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  function startEdit(t: HookTemplate) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      hook_line: t.hook_line,
      creator_prompt: t.creator_prompt,
      motion_prompt: t.motion_prompt,
      preview_image_url: t.preview_image_url ?? "",
      preview_video_url: t.preview_video_url ?? "",
      kind: t.kind,
      published: t.published,
      sort_order: t.sort_order,
    });
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSave}
        className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] space-y-4"
      >
        <h2 className="font-bold text-lg">
          {editingId ? "Edit hook" : "Add hook"}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div>
            <label className="text-xs font-semibold">Kind</label>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as HookTemplateKind })
              }
              className="mt-1 w-full rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
            >
              <option value="premade">Premade (our A/B set)</option>
              <option value="template">Template (library)</option>
            </select>
          </div>
        </div>

        <Field
          label="Hook line (on-screen)"
          value={form.hook_line}
          onChange={(v) => setForm({ ...form, hook_line: v })}
        />
        <Field
          label="Creator prompt (first frame)"
          value={form.creator_prompt}
          onChange={(v) => setForm({ ...form, creator_prompt: v })}
          multiline
        />
        <Field
          label="Motion prompt (animation)"
          value={form.motion_prompt}
          onChange={(v) => setForm({ ...form, motion_prompt: v })}
          multiline
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Preview image URL (optional)"
            value={form.preview_image_url}
            onChange={(v) => setForm({ ...form, preview_image_url: v })}
          />
          <Field
            label="Preview video URL (optional, skips AI gen)"
            value={form.preview_video_url}
            onChange={(v) => setForm({ ...form, preview_video_url: v })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Published
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Sort</span>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) || 0 })
              }
              className="w-20 rounded-lg border-2 border-black/15 px-2 py-1"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ember)] px-4 py-2 text-sm font-semibold text-white border-2 border-black"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border-2 border-black/20 px-4 py-2 text-sm"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="font-bold">All hooks ({templates.length})</h2>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--ember)]" />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-xl border-2 border-black/10 bg-white p-4"
              >
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-semibold text-sm">
                    {t.title}{" "}
                    <span className="text-[#999] font-normal">({t.kind})</span>
                  </p>
                  <p className="text-xs text-[#555] mt-0.5 line-clamp-1">
                    {t.hook_line}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="shrink-0 rounded-lg border border-red-200 p-2 text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
