import type { ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AccountMenu } from "./AccountMenu";
import {
  BrandMark,
  IconBook,
  IconBrowse,
  IconCreate,
  IconHome,
  IconMoon,
  IconSun,
} from "./Icons";
import { PwaInstallHint } from "./PwaInstallHint";

const links: {
  to: string;
  label: string;
  end?: boolean;
  Icon: (props: { className?: string; size?: number }) => ReactElement;
}[] = [
  { to: "/", label: "Home", end: true, Icon: IconHome },
  { to: "/browse", label: "Browse", Icon: IconBrowse },
  { to: "/create", label: "Create", Icon: IconCreate },
  { to: "/cookbook", label: "CookBook", Icon: IconBook },
];

export function Layout() {
  const { theme, toggleTheme, user } = useApp();

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-inner">
          <NavLink to="/" className="brand" end>
            <BrandMark />
            <span className="brand-name">
              Cook<em>Book</em>
            </span>
          </NavLink>

          <nav className="top-links" aria-label="Primary">
            {links.map(({ to, label, end, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                <Icon className="nav-ico-svg" />
                <span className="nav-label">{label}</span>
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
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            {user ? (
              <AccountMenu />
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

      <PwaInstallHint />
      <Outlet />

      <nav className="mobile-nav" aria-label="Mobile">
        {links.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            <Icon className="ico" size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
