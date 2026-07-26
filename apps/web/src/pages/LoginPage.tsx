import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, remember);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            🍳
          </span>
          <span className="brand-name">
            Grok<em>Cookbook</em>
          </span>
        </Link>
        <h1>Welcome back</h1>
        <p className="lead">Sign in to your kitchen. Sessions use short-lived access tokens + rotating refresh.</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kitchen.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
          <div className="auth-links">
            <label className="check-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember this device
            </label>
          </div>
          {error && <p className="danger-text text-sm" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="security-note">
          Argon2id passwords · 15m access JWT · rotating refresh · session inventory in Settings.
        </div>

        <p className="auth-footer">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>

      <button
        type="button"
        className="icon-chip auth-theme"
        onClick={toggleTheme}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        <span>{theme === "dark" ? "☀️" : "🌙"}</span>
      </button>
    </div>
  );
}
