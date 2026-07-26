import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { SessionDto } from "../lib/api";

export function SettingsPage() {
  const {
    theme,
    toggleTheme,
    fridge,
    catalog,
    clearFridge,
    user,
    logout,
    logoutAll,
    refreshSessions,
    authLoading,
  } = useApp();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    refreshSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [user, refreshSessions]);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      navigate("/login");
    } finally {
      setBusy(false);
    }
  }

  async function onLogoutAll() {
    if (!confirm("Sign out all devices? You'll need to sign in again.")) return;
    setBusy(true);
    try {
      await logoutAll();
      navigate("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Settings</h1>
            <p className="lede">Account, security, appearance</p>
          </div>
        </div>

        <section className="card">
          <div className="settings-group">Account</div>
          {authLoading ? (
            <div className="settings-item" style={{ cursor: "default" }}>
              <div className="copy">
                <div className="title">Loading session…</div>
              </div>
            </div>
          ) : user ? (
            <>
              <div className="settings-item" style={{ cursor: "default" }}>
                <div className="left">
                  <div className="ico-box ico-box--user" aria-hidden />
                  <div className="copy">
                    <div className="title">{user.display_name}</div>
                    <div className="desc">
                      @{user.handle} · {user.email}
                      {user.email_verified ? " · verified" : " · email not verified yet"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="settings-item" style={{ cursor: "default" }}>
                <div className="left">
                  <div className="ico-box ico-box--out" aria-hidden />
                  <div className="copy">
                    <div className="title">Sign out</div>
                    <div className="desc">This device only</div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onLogout}>
                  Sign out
                </button>
              </div>
              <div className="settings-item" style={{ cursor: "default" }}>
                <div className="left">
                  <div className="ico-box ico-box--warn" aria-hidden />
                  <div className="copy">
                    <div className="title danger-text">Sign out all devices</div>
                    <div className="desc">Revoke every refresh token + bump token version</div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onLogoutAll}>
                  Revoke all
                </button>
              </div>
            </>
          ) : (
            <div className="settings-item" style={{ cursor: "default" }}>
              <div className="left">
                <div className="ico-box ico-box--key" aria-hidden />
                <div className="copy">
                  <div className="title">Not signed in</div>
                  <div className="desc">Create an account to sync fridge to the server</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Join
                </Link>
              </div>
            </div>
          )}

          {user && sessions.length > 0 && (
            <>
              <div className="settings-group">Active sessions</div>
              {sessions.map((s) => (
                <div key={s.id} className="settings-item" style={{ cursor: "default" }}>
                  <div className="left">
                    <div className="ico-box ico-box--device" aria-hidden />
                    <div className="copy">
                      <div className="title">
                        {s.current ? "This device" : "Other device"}
                        {s.remember ? " · remembered" : ""}
                      </div>
                      <div className="desc">
                        Last seen {new Date(s.last_seen_at).toLocaleString()} · expires{" "}
                        {new Date(s.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="settings-group">Appearance</div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box ico-box--theme" aria-hidden />
              <div className="copy">
                <div className="title">Theme</div>
                <div className="desc">Currently {theme}</div>
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>

          <div className="settings-group">Kitchen data</div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box ico-box--fridge" aria-hidden />
              <div className="copy">
                <div className="title">Fridge items</div>
                <div className="desc">
                  {fridge.length} items · {user ? "server when signed in" : "browser only"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (confirm("Clear local fridge list?")) clearFridge();
              }}
            >
              Clear
            </button>
          </div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box ico-box--book" aria-hidden />
              <div className="copy">
                <div className="title">Catalog</div>
                <div className="desc">
                  {catalog ? `${catalog.count} foods · ${catalog.source}` : "Not loaded"}
                </div>
              </div>
            </div>
            <Link to="/browse" className="btn btn-soft btn-sm">
              Browse
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
