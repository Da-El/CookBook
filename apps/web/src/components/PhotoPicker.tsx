import { useRef, useState } from "react";
import { compressImageToDataUrl, mediaUrl } from "../lib/photo";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  /** Show large plate-style preview */
  large?: boolean;
};

/**
 * Pick + preview a photo. `value` is a preview data URL or /media/... path.
 * Parent uploads on submit (or immediately) via API.
 */
export function PhotoPicker({
  value,
  onChange,
  label = "Photo",
  hint = "JPG, PNG, or WebP · resized on your device",
  large = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = mediaUrl(value);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read image");
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-picker">
      <div className="photo-picker-head">
        <label className="photo-picker-label">{label}</label>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>

      <button
        type="button"
        className={`photo-zone ${large ? "photo-zone--lg" : ""} ${preview ? "photo-zone--filled" : ""}`}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {preview ? (
          <img src={preview} alt="" className="photo-zone-img" />
        ) : (
          <div className="photo-zone-empty">
            <span className="photo-zone-icon" aria-hidden />
            <strong>{busy ? "Processing…" : "Add a photo"}</strong>
            <span className="text-sm muted mt-8">{hint}</span>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm mt-8" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
