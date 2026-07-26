use std::collections::HashMap;
use std::sync::Mutex;

use grok_cookbook_v2_core::{
    default_provider, CookingSession, GroceryList, ImportJob, MealPlan, Recipe, LlmProvider,
};

pub struct AppState {
    pub llm: Box<dyn LlmProvider>,
    pub recipes: Mutex<HashMap<String, Recipe>>,
    pub imports: Mutex<HashMap<String, ImportJob>>,
    pub meal_plans: Mutex<HashMap<String, MealPlan>>,
    pub groceries: Mutex<HashMap<String, GroceryList>>,
    pub sessions: Mutex<HashMap<String, CookingSession>>,
}

impl AppState {
    pub fn new() -> Self {
        let mut recipes = HashMap::new();
        // Seed one demo recipe so grocery / cook UI work offline
        let demo = Recipe::new_stub("Demo: garlic pasta");
        recipes.insert(demo.id.clone(), demo);

        Self {
            llm: default_provider(),
            recipes: Mutex::new(recipes),
            imports: Mutex::new(HashMap::new()),
            meal_plans: Mutex::new(HashMap::new()),
            groceries: Mutex::new(HashMap::new()),
            sessions: Mutex::new(HashMap::new()),
        }
    }
}
