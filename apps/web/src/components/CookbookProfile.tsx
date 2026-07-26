import { type CSSProperties, type ReactNode, useState } from "react";
import type { ProfileDto } from "../lib/api";
import { mediaUrl } from "../lib/photo";
import { FollowListModal, type FollowListKind } from "./FollowListModal";

export type CookbookProfileData = {
  display_name: string;
  handle: string;
  bio?: string | null;
  avatar_url?: string | null;
  cookbook_title?: string | null;
  tagline?: string | null;
  cover_style?: string | null;
  accent_hex?: string | null;
  favorite_cuisines?: string | null;
  location_label?: string | null;
  cover_url?: string | null;
  cooked_count?: number;
  want_count?: number;
  fridge_count?: number;
  followers_count?: number;
  following_count?: number;
};

export function profileToCookbookData(
  p: ProfileDto,
  extras?: { fridge_count?: number },
): CookbookProfileData {
  return {
    display_name: p.display_name,
    handle: p.handle,
    bio: p.bio,
    avatar_url: p.avatar_url,
    cookbook_title: p.cookbook_title,
    tagline: p.tagline,
    cover_style: p.cover_style,
    accent_hex: p.accent_hex,
    favorite_cuisines: p.favorite_cuisines,
    location_label: p.location_label,
    cover_url: p.cover_url,
    cooked_count: p.cooked_count,
    want_count: p.want_count,
    fridge_count: extras?.fridge_count,
    followers_count: p.followers_count,
    following_count: p.following_count,
  };
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function cuisineList(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,·|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

type Props = {
  data: CookbookProfileData;
  actions?: ReactNode;
  footer?: ReactNode;
};

/**
 * Personal cookbook header — cover banner + identity plate.
 * Followers / following open a list modal.
 */
export function CookbookProfile({ data, actions, footer }: Props) {
  const style = (data.cover_style || "kitchen").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const title =
    data.cookbook_title?.trim() ||
    `${data.display_name.split(/\s+/)[0] || data.display_name}'s CookBook`;
  const avatar = mediaUrl(data.avatar_url);
  const coverPhoto = mediaUrl(data.cover_url);
  const cuisines = cuisineList(data.favorite_cuisines);
  const accent = data.accent_hex?.trim() || undefined;
  const [listKind, setListKind] = useState<FollowListKind | null>(null);

  const styleVars: CSSProperties | undefined = accent
    ? ({
        ["--book-accent" as string]: accent,
        ["--book-accent-soft" as string]: `${accent}1f`,
      } as CSSProperties)
    : undefined;

  const stats: { kind: FollowListKind; label: string; value: number }[] = [];
  if (data.followers_count != null) {
    stats.push({ kind: "followers", label: "Followers", value: data.followers_count });
  }
  if (data.following_count != null) {
    stats.push({ kind: "following", label: "Following", value: data.following_count });
  }

  return (
    <>
      <section
        className={`cb-profile cb-profile--${style}`}
        style={styleVars}
        data-cover={style}
      >
        <div
          className={`cb-cover${coverPhoto ? " cb-cover--photo" : ""}`}
          style={
            coverPhoto
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.25) 0%, rgba(15,23,42,0.55) 100%), url(${coverPhoto})`,
                }
              : undefined
          }
        >
          <div className="cb-cover-inner">
            <p className="cb-kicker">CookBook</p>
            <h1 className="cb-title" title={title}>
              {title}
            </h1>
            {data.tagline?.trim() ? (
              <p className="cb-tagline" title={data.tagline.trim()}>
                {data.tagline.trim()}
              </p>
            ) : null}
            {data.location_label?.trim() ? (
              <p className="cb-place">{data.location_label.trim()}</p>
            ) : null}
          </div>
        </div>

        <div className="cb-body">
          <div className="cb-identity">
            <div className="cb-avatar-col">
              {avatar ? (
                <img className="cb-avatar" src={avatar} alt="" />
              ) : (
                <div className="cb-avatar cb-avatar--fallback" aria-hidden>
                  {initialsOf(data.display_name)}
                </div>
              )}
            </div>

            <div className="cb-id-text">
              <h2 className="cb-name" title={data.display_name}>
                {data.display_name}
              </h2>
              <p className="cb-handle">@{data.handle}</p>
            </div>

            {actions ? <div className="cb-actions">{actions}</div> : null}
          </div>

          {data.bio?.trim() ? <p className="cb-bio">{data.bio.trim()}</p> : null}

          {cuisines.length > 0 ? (
            <div className="cb-chips" aria-label="Favorite cuisines">
              {cuisines.map((c) => (
                <span key={c} className="cb-chip">
                  {c}
                </span>
              ))}
            </div>
          ) : null}

          {stats.length > 0 ? (
            <ul className="cb-stats">
              {stats.map((s) => (
                <li key={s.kind} className="cb-stat">
                  <button
                    type="button"
                    className="cb-stat-btn"
                    onClick={() => setListKind(s.kind)}
                    aria-label={`View ${s.label.toLowerCase()}`}
                  >
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {footer}
        </div>
      </section>

      {listKind && data.handle ? (
        <FollowListModal
          open
          kind={listKind}
          handle={data.handle}
          onClose={() => setListKind(null)}
        />
      ) : null}
    </>
  );
}
