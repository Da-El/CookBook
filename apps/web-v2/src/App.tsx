import { NavLink, Route, Routes } from "react-router-dom";
import { CookPage } from "./pages/CookPage";
import { GalleryPage } from "./pages/GalleryPage";
import { GroceryPage } from "./pages/GroceryPage";
import { GuidesPage } from "./pages/GuidesPage";
import { HomePage } from "./pages/HomePage";
import { ImportPage } from "./pages/ImportPage";
import { MealPlanPage } from "./pages/MealPlanPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { RecipesPage } from "./pages/RecipesPage";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/import", label: "Import" },
  { to: "/recipes", label: "Recipes" },
  { to: "/plan", label: "Meal plan" },
  { to: "/grocery", label: "Grocery" },
  { to: "/gallery", label: "Gallery" },
  { to: "/guides", label: "Guides" },
];

export default function App() {
  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            Cook<em>Book</em> <span className="badge">V2 bones</span>
          </div>
          <nav className="nav">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/cook" element={<CookPage />} />
          <Route path="/plan" element={<MealPlanPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/guides" element={<GuidesPage />} />
        </Routes>
      </main>
    </div>
  );
}
