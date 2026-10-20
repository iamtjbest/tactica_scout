"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import { listTournaments, createTournament, type Tournament } from "@/lib/api";

const LEVELS = ["department", "faculty", "src", "open"];
const GENDERS = ["male", "female", "mixed"];
const FORMATS = [
  { id: "league", label: "League (round robin)" },
  { id: "knockout", label: "Knockout" },
  { id: "groups_knockout", label: "Groups then knockout" },
];

export default function Home() {
  return (
    <Guard>
      <Tournaments />
    </Guard>
  );
}

function Tournaments() {
  const [rows, setRows] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () =>
    listTournaments()
      .then((d) => { setRows(d.tournaments); setError(null); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-white">Your tournaments</h1>
          <p className="text-mt text-sm mt-1">
            Hosting is free and unlimited. Approval is what puts one on Scout.
          </p>
        </div>
        <button className="btn-volt" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "New tournament"}
        </button>
      </div>

      {creating && <CreateForm onDone={() => { setCreating(false); load(); }} />}

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {rows === null && !error && <p className="text-mt text-sm">Loading...</p>}

      {rows?.length === 0 && (
        <div className="card">
          <p className="text-white text-sm">No tournaments yet.</p>
          <p className="text-mt text-sm mt-1">
            Create one, add the teams, generate the fixtures, then submit it for review.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows?.map((t) => (
          <Link key={t.id} href={`/t/${t.id}`} className="card block hover:border-volt/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{t.name}</p>
                <p className="text-mt text-xs mt-1">
                  {t.organizing_body} • {t.level} • {t.format.replace("_", " + ")}
                </p>
                <p className="text-mt2 text-xs mt-1 font-mono">
                  {t.start_date} to {t.end_date}
                </p>
              </div>
              <StatusPill status={t.status} />
            </div>
            {t.status === "rejected" && t.rejection_reason && (
              <p className="text-red2 text-xs mt-3 border-t border-bd pt-3">
                {t.rejection_reason}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Record<string, string>>({
    name: "", level: "department", gender: "male",
    start_date: today, end_date: today, format: "league",
    organizing_body: "", organizer_phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await createTournament(f);
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <p className="section-label">New tournament</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input className="input-select" required minLength={3}
                 value={f.name} onChange={set("name")}
                 placeholder="Abusite Finalissima" />
        </Field>
        <Field label="Organising body">
          <input className="input-select" required
                 value={f.organizing_body} onChange={set("organizing_body")}
                 placeholder="NUESA ABU Zaria" />
        </Field>
        <Field label="Level">
          <select className="input-select" value={f.level} onChange={set("level")}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select className="input-select" value={f.gender} onChange={set("gender")}>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select className="input-select" value={f.format} onChange={set("format")}>
            {FORMATS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Contact phone">
          <input className="input-select" required
                 value={f.organizer_phone} onChange={set("organizer_phone")}
                 placeholder="080..." />
        </Field>
        <Field label="Starts">
          <input type="date" className="input-select" required
                 value={f.start_date} onChange={set("start_date")} />
        </Field>
        <Field label="Ends">
          <input type="date" className="input-select" required
                 value={f.end_date} onChange={set("end_date")} />
        </Field>
      </div>
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
      <button className="btn-volt" disabled={busy}>
        {busy ? "Creating..." : "Create draft"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-mt text-xs uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
