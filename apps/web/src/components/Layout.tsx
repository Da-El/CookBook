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
  const { theme, toggleTheme } = useApp();

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
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
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
            <NavLink to="/ingredients/add" className="btn btn-primary btn-sm nav-cook-label">
              Add ingredient
            </NavLink>
            <NavLink to="/kitchen" className="avatar avatar--sm avatar--accent" aria-label="Your kitchen">
              <span>AJ</span>
            </NavLink>
          </div>
        </div>
      </header>

      <Outlet />

      <nav className="mobile-nav" aria-label="Mobile">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <span className="ico">{l.icon}</span>
            {l.label === "Log meal" ? "Log" : l.label === "Settings" ? "More" : l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
