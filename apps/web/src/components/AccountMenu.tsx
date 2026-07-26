import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export function AccountMenu() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
      navigate("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="avatar avatar--sm avatar--accent account-menu-trigger"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`@${user.handle}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{initials}</span>
      </button>

      {open && (
        <div className="account-dropdown" role="menu" aria-label="Account">
          <div className="account-dropdown-head">
            <div className="account-dropdown-name">{user.display_name}</div>
            <div className="account-dropdown-handle">@{user.handle}</div>
          </div>

          <div className="account-dropdown-sep" />

          <Link
            role="menuitem"
            to={`/u/${encodeURIComponent(user.handle)}`}
            className="account-dropdown-item"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            to="/cookbook?customize=1"
            className="account-dropdown-item"
            onClick={() => setOpen(false)}
          >
            Customize
          </Link>
          <Link
            role="menuitem"
            to="/settings"
            className="account-dropdown-item"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            role="menuitem"
            to="/legal"
            className="account-dropdown-item"
            onClick={() => setOpen(false)}
          >
            Legal
          </Link>

          <div className="account-dropdown-sep" />

          <button
            type="button"
            role="menuitem"
            className="account-dropdown-item account-dropdown-item--danger"
            disabled={busy}
            onClick={onLogout}
          >
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
