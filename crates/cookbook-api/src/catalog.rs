use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    #[serde(default)]
    pub version: serde_json::Value,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub count: Option<usize>,
    #[serde(default)]
    pub foods: Vec<CatalogFood>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogFood {
    pub id: String,
    #[serde(default)]
    pub foodb_id: Option<i64>,
    pub name: String,
    #[serde(default)]
    pub name_scientific: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub food_group: Option<String>,
    #[serde(default)]
    pub food_subgroup: Option<String>,
    #[serde(default)]
    pub picture: Option<String>,
    #[serde(default)]
    pub picture_candidates: Option<Vec<String>>,
    #[serde(default)]
    pub emoji: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub macros: serde_json::Value,
    #[serde(default)]
    pub macros_complete: Option<bool>,
    #[serde(default)]
    pub micros: Option<serde_json::Value>,
    #[serde(default)]
    pub other_nutrients: Option<serde_json::Value>,
    #[serde(default)]
    pub nutrient_sources: Option<serde_json::Value>,
}

pub fn load_catalog(path: &str) -> anyhow::Result<Arc<Catalog>> {
    let p = Path::new(path);
    if !p.exists() {
        anyhow::bail!("catalog not found at {path}");
    }
    let raw = fs::read_to_string(p)?;
    let mut catalog: Catalog = serde_json::from_str(&raw)?;
    if catalog.count.is_none() {
        catalog.count = Some(catalog.foods.len());
    }
    Ok(Arc::new(catalog))
}

impl Catalog {
    pub fn get(&self, id: &str) -> Option<&CatalogFood> {
        let decoded = id.replace("%20", " ");
        self.foods.iter().find(|f| {
            f.id == id
                || f.id == decoded
                || f.foodb_id.map(|n| n.to_string()).as_deref() == Some(id)
                || f.id.eq_ignore_ascii_case(&decoded)
        })
    }

    pub fn search(&self, q: &str, group: Option<&str>, limit: usize) -> Vec<&CatalogFood> {
        let q = q.trim().to_lowercase();
        let mut out: Vec<&CatalogFood> = self
            .foods
            .iter()
            .filter(|f| {
                if let Some(g) = group {
                    if g != "All" && f.food_group.as_deref() != Some(g) {
                        return false;
                    }
                }
                if q.is_empty() {
                    return true;
                }
                f.name.to_lowercase().contains(&q)
                    || f.food_group
                        .as_deref()
                        .map(|g| g.to_lowercase().contains(&q))
                        .unwrap_or(false)
                    || f.food_subgroup
                        .as_deref()
                        .map(|g| g.to_lowercase().contains(&q))
                        .unwrap_or(false)
                    || f.name_scientific
                        .as_deref()
                        .map(|g| g.to_lowercase().contains(&q))
                        .unwrap_or(false)
            })
            .collect();

        if !q.is_empty() {
            out.sort_by_key(|f| {
                let name = f.name.to_lowercase();
                if name == q {
                    0u8
                } else if name.starts_with(&q) {
                    1
                } else if name.contains(&q) {
                    2
                } else {
                    3
                }
            });
        }

        out.into_iter().take(limit).collect()
    }

    pub fn groups(&self) -> Vec<String> {
        let mut set: Vec<String> = self
            .foods
            .iter()
            .filter_map(|f| f.food_group.clone())
            .collect();
        set.sort();
        set.dedup();
        set
    }
}
