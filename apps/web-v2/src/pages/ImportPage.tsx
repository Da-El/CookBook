import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { v2, type ImportJob } from "../lib/api";

const KINDS = [
  { id: "website_url", label: "Website URL" },
  { id: "cookbook_scan", label: "Cookbook / scan (OCR text)" },
  { id: "handwritten_note", label: "Handwritten notes" },
  { id: "video_transcript", label: "Video transcript / captions" },
  { id: "social_post", label: "Social media post" },
  { id: "free_text", label: "Free text / messy paste" },
];

export function ImportPage() {
  const [kind, setKind] = useState("free_text");
  const [payload, setPayload] = useState("");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await v2.importRecipe({
        kind,
        payload,
        title_hint: title || undefined,
      });
      setJob(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Import recipe</h1>
      <p className="lede">
        Paste a URL, notes, captions, or anything messy. Today you get a <em>structured stub</em>;
        later SpaceXAI fills the real schema.
      </p>

      <form className="card" style={{ marginTop: 18 }} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="kind">Source type</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">Title hint (optional)</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Grandma's chili"
          />
        </div>
        <div className="field">
          <label htmlFor="payload">Content</label>
          <textarea
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Paste recipe text, URL, OCR dump, TikTok caption…"
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !payload.trim()}>
          {busy ? "Importing…" : "Import (stub LLM)"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {job && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Import job</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Status: <strong>{job.status}</strong> · {job.message}
          </p>
          {job.recipe && (
            <div style={{ marginTop: 12 }}>
              <p>
                Created: <strong>{job.recipe.title}</strong>
              </p>
              <Link className="btn btn-primary btn-sm" style={{ marginTop: 10 }} to={`/recipes/${job.recipe.id}`}>
                Open recipe
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
