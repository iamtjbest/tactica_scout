"use client";
import { useState } from "react";
import clsx from "clsx";
import { createTournament } from "@/lib/api";

/**
 * Three steps, in the order the decisions actually get made:
 *
 *   1 Details   who's running it, when, where, and the proof it's real
 *   2 Format    the shape of the competition
 *   3 Setup     confirm, create the draft, then add teams
 *
 * Proof is collected in step 1 rather than buried later, because it is
 * part of "is this a real competition", not an afterthought once
 * everything else is typed in.
 */

const LEVELS = [
  { id: "university",        label: "University / college" },
  { id: "school",            label: "School" },
  { id: "youth",             label: "Youth / academy" },
  { id: "amateur",           label: "Amateur" },
  { id: "semi_professional", label: "Semi-professional" },
  { id: "professional",      label: "Professional" },
  { id: "corporate",         label: "Corporate / workplace" },
  { id: "community",         label: "Community / local" },
];

const FORMATS = [
  {
    id: "league",
    name: "Round robin",
    blurb: "One table, everyone plays everyone.",
    example: "English Premier League",
  },
  {
    id: "groups_knockout",
    name: "Groups + knockout",
    blurb: "Group stage feeds a final bracket.",
    example: "EURO / Copa América",
  },
  {
    id: "knockout",
    name: "Knockout",
    blurb: "Single-elimination bracket.",
    example: "English FA Cup",
  },
];

const PROOF_TYPES = [
  { id: "link",       label: "Link" },
  { id: "document",   label: "Document" },
  { id: "screenshot", label: "Screenshot" },
];

/** The earliest start date we'll accept, mirroring MIN_LEAD_DAYS on the
 *  backend. Shown in the input's `min` so the picker won't even offer
 *  an earlier day, rather than rejecting it after they've filled in
 *  the whole form. */
const MIN_LEAD_DAYS = 14;
function earliestStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + MIN_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}

type Proof = { type: string; url: string; note: string };

export default function CreateWizard({
  defaultEmail, onDone, onCancel,
}: {
  defaultEmail: string;
  onDone: (id: string, proofs: Proof[]) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<Record<string, string>>({
    name: "", level: "", gender: "male", country: "",
    start_date: "", end_date: "",
    organizing_body: "", organizer_phone: "",
    contact_email: defaultEmail || "",
    format: "",
  });
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [proofDraft, setProofDraft] = useState<Proof>({ type: "link", url: "", note: "" });

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  // Everything except the second contact is required, so the check is
  // "is anything blank" rather than a list that drifts out of date.
  const REQUIRED = [
    "name", "level", "gender", "country", "start_date", "end_date",
    "organizing_body", "organizer_phone", "contact_email",
  ];
  const missing = REQUIRED.filter((k) => !f[k]?.trim());
  const datesOk =
    !!f.start_date && !!f.end_date && f.end_date >= f.start_date &&
    f.start_date >= earliestStart();
  const step1Ok = missing.length === 0 && datesOk && proofs.length > 0;

  const addProof = () => {
    if (!proofDraft.url.trim()) return;
    setProofs([...proofs, { ...proofDraft, url: proofDraft.url.trim() }]);
    setProofDraft({ type: "link", url: "", note: "" });
  };

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const t = await createTournament({
        ...f,
        name: f.name.trim(),
        organizing_body: f.organizing_body.trim(),
      });
      onDone((t as any).id, proofs);
    } catch (e: any) {
      setError(e.message);
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Steps step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div>
              <p className="section-label">Details</p>
              <p className="text-mt text-sm mt-1">
                The essentials. You can refine everything later in settings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Competition name" required>
                <input className="input-select" value={f.name} onChange={set("name")}
                       placeholder="e.g. NUESA Dean's Cup" maxLength={120} />
              </Field>
              <Field label="Organising body" required>
                <input className="input-select" value={f.organizing_body}
                       onChange={set("organizing_body")} placeholder="Who runs it" />
              </Field>

              <Field label="Level of competition" required>
                <select className="input-select" value={f.level} onChange={set("level")}>
                  <option value="">Select a level</option>
                  {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Country" required>
                <input className="input-select" value={f.country} onChange={set("country")}
                       placeholder="e.g. Nigeria" />
              </Field>

              <Field label="Gender" required>
                <select className="input-select" value={f.gender} onChange={set("gender")}>
                  <option value="male">Men</option>
                  <option value="female">Women</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>
              <Field label="Age category">
                <input className="input-select" value={f.age_category || ""}
                       onChange={set("age_category")} placeholder="Optional, e.g. U20" />
              </Field>

              <Field label="Start date" required>
                <input type="date" className="input-select" value={f.start_date}
                       min={earliestStart()} onChange={set("start_date")} />
              </Field>
              <Field label="End date" required>
                <input type="date" className="input-select" value={f.end_date}
                       min={f.start_date || earliestStart()} onChange={set("end_date")} />
              </Field>
            </div>

            {/* Stated up front, not discovered on submit. */}
            <p className="text-amber text-xs">
              * The start date must be at least {MIN_LEAD_DAYS} days from today.
              We need time to review the competition, and you need time to fix
              anything we send back. Earliest you can start is {earliestStart()}.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-bd">
              <Field label="Contact email" required>
                <input type="email" className="input-select" value={f.contact_email}
                       onChange={set("contact_email")} placeholder="you@example.com" />
                <p className="text-mt2 text-xs mt-1">
                  This is where we write about the review.
                </p>
              </Field>
              <Field label="Contact phone" required>
                {/* Full international format: this is not a Nigeria-only
                    app, so a bare 080 number has no country. */}
                <input className="input-select" value={f.organizer_phone}
                       onChange={set("organizer_phone")} placeholder="+234 801 234 5678" />
                <p className="text-mt2 text-xs mt-1">
                  Include the country code.
                </p>
              </Field>
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <p className="section-label">Proof of legitimacy</p>
              <p className="text-mt text-sm mt-1">
                Helps us confirm the competition is real. A letter from the
                organising body, the fixture poster, or its official page.
                At least one is needed before you can submit for review.
              </p>
            </div>

            {proofs.length > 0 && (
              <div className="space-y-2">
                {proofs.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm border-t border-bd pt-2">
                    <span className="text-white truncate">{p.url}</span>
                    <button className="text-mt hover:text-red2 text-xs shrink-0"
                            onClick={() => setProofs(proofs.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className="input-select" value={proofDraft.type}
                      onChange={(e) => setProofDraft({ ...proofDraft, type: e.target.value })}>
                {PROOF_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <input className="input-select sm:col-span-2" value={proofDraft.url}
                     placeholder="Paste a verification link"
                     onChange={(e) => setProofDraft({ ...proofDraft, url: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addProof()} />
            </div>
            <button className="text-volt2 text-sm font-semibold" onClick={addProof}>
              Add proof
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button className="text-mt hover:text-white text-sm" onClick={onCancel}>
              Cancel
            </button>
            <div className="text-right">
              {!step1Ok && (
                <p className="text-mt2 text-xs mb-2">
                  {missing.length > 0
                    ? `${missing.length} field(s) still to fill`
                    : !datesOk
                    ? "Check the dates"
                    : "Add at least one proof"}
                </p>
              )}
              <button className="btn-volt" disabled={!step1Ok} onClick={() => setStep(2)}>
                Next step
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div>
              <p className="section-label">Format</p>
              <p className="text-mt text-sm mt-1">
                Pick the shape of the competition. You can use our fixture
                generator with random seeding, or enter your own draw after
                this.
              </p>
            </div>

            <div className="space-y-2">
              {FORMATS.map((x) => (
                <button key={x.id} onClick={() => setF({ ...f, format: x.id })}
                  className={clsx(
                    "w-full text-left card flex items-center justify-between gap-4 transition-colors",
                    f.format === x.id ? "border-volt/50" : "hover:border-bd2"
                  )}>
                  <div>
                    <p className="text-white font-semibold">{x.name}</p>
                    <p className="text-mt text-sm mt-0.5">{x.blurb}</p>
                  </div>
                  <span className="text-mt2 text-xs shrink-0">{x.example}</span>
                </button>
              ))}
            </div>

            <p className="text-mt2 text-xs">
              Already drawn your fixtures? Pick the closest shape here and
              choose &ldquo;I already have the draw&rdquo; on the Fixtures tab
              instead of generating them.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button className="text-mt hover:text-white text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn-volt" disabled={!f.format} onClick={() => setStep(3)}>
              Next step
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <p className="section-label">Setup</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Row k="Competition" v={f.name} />
              <Row k="Organising body" v={f.organizing_body} />
              <Row k="Level" v={LEVELS.find((l) => l.id === f.level)?.label || f.level} />
              <Row k="Country" v={f.country} />
              <Row k="Runs" v={`${f.start_date} to ${f.end_date}`} />
              <Row k="Format" v={FORMATS.find((x) => x.id === f.format)?.name || f.format} />
              <Row k="Contact" v={`${f.contact_email} · ${f.organizer_phone}`} />
              <Row k="Proof" v={`${proofs.length} attached`} />
            </dl>
            <p className="text-mt text-sm pt-2 border-t border-bd">
              This creates a draft. Next you add the teams and the fixtures,
              then submit it for approval. Nothing appears on Scout until an
              admin approves it.
            </p>
          </div>

          {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

          <div className="flex items-center justify-between gap-4">
            <button className="text-mt hover:text-white text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn-volt" disabled={busy} onClick={create}>
              {busy ? "Creating..." : "Create competition"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Details", "Format", "Setup"];
  return (
    <div className="flex items-center gap-3">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = step > n, now = step === n;
        return (
          <div key={l} className="flex items-center gap-3">
            <span className={clsx(
              "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center",
              now ? "bg-volt text-bg" : done ? "bg-volt/20 text-volt" : "bg-sur2 text-mt"
            )}>
              {done ? "✓" : n}
            </span>
            <span className={clsx("text-sm", now ? "text-white font-semibold" : "text-mt")}>
              {l}
            </span>
            {n < labels.length && <span className="w-8 h-px bg-bd" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-mt text-xs uppercase tracking-wide">
        {label}{required && <span className="text-volt ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-mt text-xs uppercase tracking-wide">{k}</dt>
      <dd className="text-white mt-0.5 break-words">{v || "—"}</dd>
    </div>
  );
}
