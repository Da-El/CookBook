import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";

const links = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/kitchen", label: "Kitchen", icon: "☰" },
  { to: "/ingredients/browse", label: "Foods", icon: "◎" },
  { to: "/ingredients", label: "Fridge", icon: "◈" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Layout() {
  const { theme, toggleTheme, user } = useApp();
  const initials = user
    ? user.display_name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              🍳
            </span>
            <span className="brand-name">
              Cook<em>Book</em>
            </span>
          </NavLink>

          <nav className="top-links" aria-label="Primary">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                <span className="nav-ico">{l.icon}</span>
                <span className="nav-label">{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="top-actions">
            <button
              type="button"
              className="icon-chip"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              <span>{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
            {user ? (
              <>
                <NavLink to="/ingredients/add" className="btn btn-primary btn-sm nav-cook-label">
                  Add ingredient
                </NavLink>
                <NavLink
                  to="/settings"
                  className="avatar avatar--sm avatar--accent"
                  aria-label={user.display_name}
                  title={`@${user.handle}`}
                >
                  <span>{initials}</span>
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/login" className="btn btn-secondary btn-sm">
                  Sign in
                </NavLink>
                <NavLink to="/signup" className="btn btn-primary btn-sm">
                  Join
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <Outlet />

      <nav className="mobile-nav" aria-label="Mobile">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            <span className="ico">{l.icon}</span>
            {l.label === "Settings" ? "More" : l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
