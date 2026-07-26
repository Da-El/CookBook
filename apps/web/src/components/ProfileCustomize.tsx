import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  COVER_STYLES,
  type ProfileDto,
  type UpdateProfileBody,
} from "../lib/api";
import { PhotoPicker } from "./PhotoPicker";

type Props = {
  open: boolean;
  profile: ProfileDto;
  onClose: () => void;
  onSaved: (p: ProfileDto) => void;
};

async function maybeUpload(dataOrUrl: string | null): Promise<string | null> {
  if (!dataOrUrl) return null;
  if (dataOrUrl.startsWith("data:")) {
    const up = await api.uploadMedia(dataOrUrl);
    return up.url;
  }
  return dataOrUrl;
}

export function ProfileCustomize({ open, profile, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio || "");
  const [title, setTitle] = useState(profile.cookbook_title || "");
  const [tagline, setTagline] = useState(profile.tagline || "");
  const [coverStyle, setCoverStyle] = useState(profile.cover_style || "kitchen");
  const [accent, setAccent] = useState(profile.accent_hex || "");
  const [cuisines, setCuisines] = useState(profile.favorite_cuisines || "");
  const [location, setLocation] = useState(profile.location_label || "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [cover, setCover] = useState<string | null>(profile.cover_url);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [clearCover, setClearCover] = useState(false);
  const [clearAccent, setClearAccent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.display_name);
    setBio(profile.bio || "");
    setTitle(profile.cookbook_title || "");
    setTagline(profile.tagline || "");
    setCoverStyle(profile.cover_style || "kitchen");
    setAccent(profile.accent_hex || "");
    setCuisines(profile.favorite_cuisines || "");
    setLocation(profile.location_label || "");
    setAvatar(profile.avatar_url);
    setCover(profile.cover_url);
    setClearAvatar(false);
    setClearCover(false);
    setClearAccent(false);
    setError(null);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let avatarUrl = avatar;
      let coverUrl = cover;
      if (avatar && avatar.startsWith("data:")) {
        avatarUrl = await maybeUpload(avatar);
      }
      if (cover && cover.startsWith("data:")) {
        coverUrl = await maybeUpload(cover);
      }

      const body: UpdateProfileBody = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        cookbook_title: title.trim(),
        tagline: tagline.trim(),
        cover_style: coverStyle,
        favorite_cuisines: cuisines.trim(),
        location_label: location.trim(),
      };

      if (clearAvatar) {
        body.clear_avatar = true;
      } else if (avatarUrl !== profile.avatar_url) {
        body.avatar_url = avatarUrl;
      }

      if (clearCover) {
        body.clear_cover = true;
      } else if (coverUrl !== profile.cover_url) {
        body.cover_url = coverUrl;
      }

      if (clearAccent || !accent.trim()) {
        body.clear_accent = true;
      } else {
        body.accent_hex = accent.trim().startsWith("#") ? accent.trim() : `#${accent.trim()}`;
      }

      const saved = await api.updateProfile(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal cookbook-customize-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="customize-title">Personalize your CookBook</h2>
            <p className="muted text-sm mt-4">
              Title, cover, colors, and story — like writing the front of a real cookbook.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className="modal-body cookbook-customize-body">
          <div className="field">
            <label htmlFor="cb-title">Cookbook title</label>
            <input
              id="cb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${displayName.split(/\s+/)[0] || "My"}'s CookBook`}
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="cb-tagline">Tagline</label>
            <input
              id="cb-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Weeknight hero · farm markets · no measuring spoons"
              maxLength={160}
            />
          </div>

          <div className="field">
            <label htmlFor="cb-name">Chef name</label>
            <input
              id="cb-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cb-bio">About / dedication</label>
            <textarea
              id="cb-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A short dedication or kitchen philosophy…"
            />
          </div>

          <div className="field-row-2">
            <div className="field">
              <label htmlFor="cb-place">Kitchen location</label>
              <input
                id="cb-place"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Austin · Brooklyn · Home"
                maxLength={80}
              />
            </div>
            <div className="field">
              <label htmlFor="cb-cuisines">Favorite cuisines</label>
              <input
                id="cb-cuisines"
                value={cuisines}
                onChange={(e) => setCuisines(e.target.value)}
                placeholder="Japanese, Mexican, comfort"
                maxLength={200}
              />
            </div>
          </div>

          <fieldset className="cover-style-fieldset">
            <legend>Cover style</legend>
            <div className="cover-style-grid">
              {COVER_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`cover-style-swatch cover-${s.id} ${coverStyle === s.id ? "on" : ""}`}
                  onClick={() => setCoverStyle(s.id)}
                  title={s.blurb}
                >
                  <span className="cover-style-name">{s.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="cb-accent">Accent color (optional)</label>
            <div className="accent-row">
              <input
                id="cb-accent"
                type="color"
                value={accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#2563eb"}
                onChange={(e) => {
                  setAccent(e.target.value);
                  setClearAccent(false);
                }}
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => {
                  setAccent(e.target.value);
                  setClearAccent(false);
                }}
                placeholder="#2563eb"
                maxLength={7}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setAccent("");
                  setClearAccent(true);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <PhotoPicker
            label="Portrait photo"
            hint="Shown on your cookbook plate"
            value={clearAvatar ? null : avatar}
            onChange={(v) => {
              setAvatar(v);
              setClearAvatar(!v);
            }}
          />

          <PhotoPicker
            label="Custom cover photo"
            hint="Optional — overlays the style texture"
            value={clearCover ? null : cover}
            onChange={(v) => {
              setCover(v);
              setClearCover(!v);
            }}
          />

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !displayName.trim()}>
            {busy ? "Saving…" : "Save CookBook"}
          </button>
        </div>
      </div>
    </div>
  );
}
