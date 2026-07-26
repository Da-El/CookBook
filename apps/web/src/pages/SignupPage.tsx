import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { ApiError } from "../lib/api";

export function SignupPage() {
  const { register, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }
    setBusy(true);
    try {
      await register({
        email,
        password,
        display_name: displayName,
        handle,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed");
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
            Cook<em>Book</em>
          </span>
        </Link>
        <h1>Start your kitchen</h1>
        <p className="lead">Create a chef profile. Email + strong password (Argon2id).</p>

        <form onSubmit={onSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="name">Display name</label>
              <input
                id="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Jordan"
              />
            </div>
            <div className="field">
              <label htmlFor="handle">Handle</label>
              <input
                id="handle"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="chef_alex"
                pattern="[A-Za-z0-9_-]{3,30}"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
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
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
            />
            <p className="field-hint">12+ characters. Stored with Argon2id — never plaintext.</p>
          </div>
          <div className="field">
            <label htmlFor="password2">Confirm password</label>
            <input
              id="password2"
              type="password"
              required
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
          {error && <p className="danger-text text-sm" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already cooking? <Link to="/login">Sign in</Link>
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
