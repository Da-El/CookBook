import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppProvider } from "./context/AppContext";
import { AddIngredientPage } from "./pages/AddIngredientPage";
import { FridgePage } from "./pages/FridgePage";
import { HomePage } from "./pages/HomePage";
import { IngredientDetailPage } from "./pages/IngredientDetailPage";
import { IngredientsBrowsePage } from "./pages/IngredientsBrowsePage";
import { KitchenPage } from "./pages/KitchenPage";
import { LoginPage } from "./pages/LoginPage";
import { MealDetailPage } from "./pages/MealDetailPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
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
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="ingredients" element={<FridgePage />} />
            <Route path="ingredients/browse" element={<IngredientsBrowsePage />} />
            <Route path="ingredients/add" element={<AddIngredientPage />} />
            <Route path="ingredients/:foodId" element={<IngredientDetailPage />} />
            <Route
              path="meals/new"
              element={
                <PlaceholderPage title="Log a meal" blurb="Meal logging is next — ingredients are live first." />
              }
            />
            <Route path="meals/:mealId" element={<MealDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
