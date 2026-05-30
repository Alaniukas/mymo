"use client";

import { useState } from "react";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import type { BrandFeature, UserQuote } from "@/lib/carousel/variables";

// Repeatable editors for the two structured Brain lists — Features (name +
// benefit) and Testimonials (quote + attribution). Both follow the page's
// edit/save/cancel pattern: a read view with a pencil, then a draft view with
// add/remove rows and a single Save that persists the whole list.

interface ListHeaderProps {
  label: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function ListHeader({ label, editing, onEdit, onSave, onCancel }: ListHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium text-[#666]">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSave}
            className="p-1 rounded hover:bg-green-50"
            aria-label="Save"
          >
            <Check className="w-3.5 h-3.5 text-green-600" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-red-50"
            aria-label="Cancel"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="p-1 rounded hover:bg-gray-100"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="w-3.5 h-3.5 text-[#999]" />
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]";

export function FeaturesEditor({
  value,
  onSave,
}: {
  value: BrandFeature[];
  onSave: (next: BrandFeature[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BrandFeature[]>(value);

  function begin() {
    setDraft(value.length ? value : [{ name: "", benefit: "" }]);
    setEditing(true);
  }

  function commit() {
    onSave(draft.map((f) => ({ name: f.name.trim(), benefit: f.benefit.trim() })).filter((f) => f.name));
    setEditing(false);
  }

  return (
    <div>
      <ListHeader
        label="Features"
        editing={editing}
        onEdit={begin}
        onSave={commit}
        onCancel={() => setEditing(false)}
      />
      {editing ? (
        <div className="space-y-2">
          {draft.map((f, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <input
                  value={f.name}
                  onChange={(e) =>
                    setDraft((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="Feature name"
                  className={inputCls}
                />
                <input
                  value={f.benefit}
                  onChange={(e) =>
                    setDraft((d) => d.map((x, j) => (j === i ? { ...x, benefit: e.target.value } : x)))
                  }
                  placeholder="Why it matters to the user"
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                className="p-1.5 rounded hover:bg-red-50 mt-0.5"
                aria-label="Remove feature"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => [...d, { name: "", benefit: "" }])}
            className="flex items-center gap-1 text-sm font-medium text-[var(--ember)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add feature
          </button>
        </div>
      ) : value.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {value.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold">{f.name}</span>
              {f.benefit && <p className="text-xs text-[#666] mt-0.5">{f.benefit}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#999] italic">No features yet</p>
      )}
    </div>
  );
}

export function QuotesEditor({
  value,
  onSave,
}: {
  value: UserQuote[];
  onSave: (next: UserQuote[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserQuote[]>(value);

  function begin() {
    setDraft(value.length ? value : [{ quote: "", name: "", title: "" }]);
    setEditing(true);
  }

  function commit() {
    onSave(
      draft
        .map((q) => ({
          quote: q.quote.trim(),
          name: (q.name ?? "").trim(),
          title: (q.title ?? "").trim(),
        }))
        .filter((q) => q.quote),
    );
    setEditing(false);
  }

  return (
    <div>
      <ListHeader
        label="Testimonials"
        editing={editing}
        onEdit={begin}
        onSave={commit}
        onCancel={() => setEditing(false)}
      />
      {editing ? (
        <div className="space-y-2">
          {draft.map((q, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <textarea
                  value={q.quote}
                  onChange={(e) =>
                    setDraft((d) => d.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)))
                  }
                  rows={2}
                  placeholder="Short testimonial line"
                  className={`${inputCls} resize-none`}
                />
                <div className="flex gap-2">
                  <input
                    value={q.name ?? ""}
                    onChange={(e) =>
                      setDraft((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Name"
                    className={inputCls}
                  />
                  <input
                    value={q.title ?? ""}
                    onChange={(e) =>
                      setDraft((d) => d.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder="Title"
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                className="p-1.5 rounded hover:bg-red-50 mt-0.5"
                aria-label="Remove testimonial"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => [...d, { quote: "", name: "", title: "" }])}
            className="flex items-center gap-1 text-sm font-medium text-[var(--ember)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add testimonial
          </button>
        </div>
      ) : value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((q, i) => (
            <li key={i} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-sm italic">&ldquo;{q.quote}&rdquo;</p>
              {(q.name || q.title) && (
                <p className="text-xs text-[#666] mt-1">
                  {[q.name, q.title].filter(Boolean).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#999] italic">No testimonials yet</p>
      )}
    </div>
  );
}
