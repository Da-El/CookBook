import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppProvider } from "./context/AppContext";
import { AddIngredientPage } from "./pages/AddIngredientPage";
import { BrowsePage } from "./pages/BrowsePage";
import { CookBookPage } from "./pages/CookBookPage";
import { CreateHubPage } from "./pages/CreateHubPage";
import { CreateMealPage } from "./pages/CreateMealPage";
import { HomePage } from "./pages/HomePage";
import { BrandedDetailPage } from "./pages/BrandedDetailPage";
import { IngredientDetailPage } from "./pages/IngredientDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MealDetailPage } from "./pages/MealDetailPage";
import { LegalPage } from "./pages/LegalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignupPage } from "./pages/SignupPage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="create" element={<CreateHubPage />} />
            <Route path="create/meal" element={<CreateMealPage />} />
            <Route path="create/ingredient" element={<AddIngredientPage />} />
            <Route path="cookbook" element={<CookBookPage />} />
            <Route path="ingredients/:foodId" element={<IngredientDetailPage />} />
            <Route path="branded/:fdcId" element={<BrandedDetailPage />} />
            <Route path="meals/new" element={<Navigate to="/create/meal" replace />} />
            <Route path="meals/:mealId" element={<MealDetailPage />} />
            <Route path="u/:handle" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="legal" element={<LegalPage />} />
            {/* Legacy redirects */}
            <Route path="kitchen" element={<Navigate to="/cookbook" replace />} />
            <Route path="ingredients" element={<Navigate to="/cookbook" replace />} />
            <Route path="ingredients/browse" element={<Navigate to="/browse" replace />} />
            <Route path="ingredients/add" element={<Navigate to="/create/ingredient" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
