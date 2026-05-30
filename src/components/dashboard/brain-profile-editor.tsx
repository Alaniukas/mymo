"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BrandFeature, UserQuote } from "@/lib/carousel/variables";
import { type NicheSlug } from "@/lib/carousel/niches";
import { FeaturesEditor, QuotesEditor } from "./brain-list-editors";
import { resolveFieldLabel } from "./brain-field-labels";

export interface AppIdentityProfile {
  id: string;
  app_name?: string | null;
  app_category?: string | null;
  app_tagline?: string | null;
  social_handle?: string | null;
  brand_tone?: string | null;
  target_audience?: string | null;
  value_propositions?: string[] | null;
  core_problem?: string | null;
  key_outcome?: string | null;
  features?: BrandFeature[] | null;
  competitor_name?: string | null;
  competitor_weakness?: string | null;
  user_quotes?: UserQuote[] | null;
  metric_result?: string | null;
  cta_text?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  brand_dna?: string | null;
  llm_summary?: string | null;
  product_terminology?: Record<string, string> | null;
}

// The editable Brand "Brain" profile — the source of every [bracket] the
// content templates inject. Persists each field independently so partial edits
// never clobber the rest of the dictionary.
//
// `embedded` drops the standalone card chrome + heading so it can sit inside a
// modal that supplies its own. `onChange` reports each saved field back to the
// parent (e.g. so a Brand DNA preview stays in sync).
export function BrainProfileEditor({
  initial,
  niche,
  embedded = false,
  onChange,
}: {
  initial: AppIdentityProfile;
  niche?: NicheSlug | null;
  embedded?: boolean;
  onChange?: (identity: AppIdentityProfile) => void;
}) {
  const [identity, setIdentity] = useState<AppIdentityProfile>(initial);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Adapt the human-facing field labels to the niche (DB keys unchanged).
  const L = (field: string, fallback: string) =>
    resolveFieldLabel(niche, field, fallback);

  async function save(field: keyof AppIdentityProfile, value: unknown) {
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("app_identities")
      .update({ [field]: value })
      .eq("id", identity.id);

    if (dbError) {
      // A missing column means migration 009 hasn't been applied yet.
      setError(`Couldn't save ${String(field)}. ${dbError.message}`);
      return;
    }
    setError(null);
    const next = { ...identity, [field]: value } as AppIdentityProfile;
    setIdentity(next);
    onChange?.(next);
  }

  function saveScalar(field: string, value: string) {
    save(field as keyof AppIdentityProfile, value);
    setEditingField(null);
  }

  const valueProps = identity.value_propositions ?? [];

  return (
    <div
      className={cn(
        "space-y-8",
        !embedded &&
          "bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000]",
      )}
    >
      {!embedded && (
        <div>
          <h2 className="text-lg font-bold">Your Brand Identity</h2>
          <p className="text-sm text-[#666] mt-0.5">
            Everything from your quiz and website crawl lives here — edit any
            field to refine it.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Brand DNA — the brand's essence, generated from the crawl/quiz and the
          first thing the content engine leans on. Highlighted + editable. */}
      <div className="rounded-xl border-2 border-[var(--ember)] bg-[var(--ember)]/5 p-4">
        <ScalarField
          label="Brand DNA"
          field="brand_dna"
          value={identity.brand_dna ?? ""}
          multiline
          placeholder="Crawl your website to generate your Brand DNA, or write it yourself."
          {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }}
        />
      </div>

      <Section title="Identity">
        <ScalarField label={L("app_name", "App Name")} field="app_name" value={identity.app_name ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label={L("app_category", "Category")} field="app_category" value={identity.app_category ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Tagline" field="app_tagline" value={identity.app_tagline ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Social Handle" field="social_handle" value={identity.social_handle ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Brand Tone / Voice" field="brand_tone" value={identity.brand_tone ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Target Audience" field="target_audience" value={identity.target_audience ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
      </Section>

      <Section title="Value & Problem">
        <ScalarField label={L("core_problem", "Core Problem")} field="core_problem" value={identity.core_problem ?? ""} multiline {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label={L("key_outcome", "Key Outcome")} field="key_outcome" value={identity.key_outcome ?? ""} multiline {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ListField
          label="Value Propositions"
          field="value_propositions"
          values={valueProps}
          editing={editingField === "value_propositions"}
          editValue={editValue}
          onEdit={() => {
            setEditingField("value_propositions");
            setEditValue(valueProps.join("\n"));
          }}
          onChange={setEditValue}
          onSave={() => {
            save(
              "value_propositions",
              editValue.split("\n").map((v) => v.trim()).filter(Boolean),
            );
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />
        <FeaturesEditor value={identity.features ?? []} onSave={(next) => save("features", next)} />
      </Section>

      <Section title="Persuasion & Proof">
        <ScalarField label="Competitor / Old Way" field="competitor_name" value={identity.competitor_name ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Competitor Weakness" field="competitor_weakness" value={identity.competitor_weakness ?? ""} multiline {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <QuotesEditor value={identity.user_quotes ?? []} onSave={(next) => save("user_quotes", next)} />
        <ScalarField label="Metric Result" field="metric_result" value={identity.metric_result ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label={L("cta_text", "CTA Text")} field="cta_text" value={identity.cta_text ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
      </Section>

      <Section title="Brand Assets">
        <ScalarField label="Brand Color (hex)" field="brand_color" value={identity.brand_color ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
        <ScalarField label="Logo URL" field="logo_url" value={identity.logo_url ?? ""} {...{ editingField, editValue, setEditingField, setEditValue, saveScalar }} />
      </Section>

      {identity.llm_summary && (
        <div>
          <span className="text-sm font-medium text-[#666] block mb-2">Summary</span>
          <p className="text-sm leading-relaxed bg-gray-50 rounded-lg p-4">{identity.llm_summary}</p>
        </div>
      )}

      {identity.product_terminology && Object.keys(identity.product_terminology).length > 0 && (
        <div>
          <span className="text-sm font-medium text-[#666] block mb-2">Product Terminology</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(identity.product_terminology).map(([term, def]) => (
              <div key={term} className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold">{term}</span>
                <p className="text-xs text-[#666] mt-0.5">{def}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#999]">{title}</h3>
      {children}
    </div>
  );
}

interface ScalarFieldProps {
  label: string;
  field: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  editingField: string | null;
  editValue: string;
  setEditingField: (f: string | null) => void;
  setEditValue: (v: string) => void;
  saveScalar: (field: string, value: string) => void;
}

function ScalarField({
  label,
  field,
  value,
  multiline,
  placeholder,
  editingField,
  editValue,
  setEditingField,
  setEditValue,
  saveScalar,
}: ScalarFieldProps) {
  const editing = editingField === field;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-[#666]">{label}</span>
        <button
          type="button"
          onClick={() => {
            setEditingField(field);
            setEditValue(value);
          }}
          className="p-1 rounded hover:bg-gray-100"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="w-3.5 h-3.5 text-[#999]" />
        </button>
      </div>
      {editing ? (
        <div className="flex gap-2">
          {multiline ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={2}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] resize-none"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
            />
          )}
          <button type="button" onClick={() => saveScalar(field, editValue)} className="p-1.5 rounded hover:bg-green-50 self-start" aria-label="Save">
            <Check className="w-4 h-4 text-green-600" />
          </button>
          <button type="button" onClick={() => setEditingField(null)} className="p-1.5 rounded hover:bg-red-50 self-start" aria-label="Cancel">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ) : value ? (
        <p className="text-sm font-medium whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-[#999] italic">{placeholder ?? "Not set"}</p>
      )}
    </div>
  );
}

interface ListFieldProps {
  label: string;
  field: string;
  values: string[];
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ListField({ label, values, editing, editValue, onEdit, onChange, onSave, onCancel }: ListFieldProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-[#666]">{label}</span>
        <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-gray-100" aria-label={`Edit ${label}`}>
          <Pencil className="w-3.5 h-3.5 text-[#999]" />
        </button>
      </div>
      {editing ? (
        <div className="flex gap-2">
          <textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            placeholder="One per line"
            className="flex-1 px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
          />
          <div className="flex flex-col gap-1">
            <button type="button" onClick={onSave} className="p-1.5 rounded hover:bg-green-50" aria-label="Save">
              <Check className="w-4 h-4 text-green-600" />
            </button>
            <button type="button" onClick={onCancel} className="p-1.5 rounded hover:bg-red-50" aria-label="Cancel">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      ) : values.length > 0 ? (
        <ul className="space-y-1.5">
          {values.map((vp, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--ember)] shrink-0" />
              {vp}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#999] italic">Not set</p>
      )}
    </div>
  );
}
