//! Branded foods via USDA FoodData Central API (search-on-demand).
//! Never loads 400k+ foods into memory or the SPA — cheap and always free-tier friendly.

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{ApiResult, AppError};
use crate::state::AppState;

const FDC_BASE: &str = "https://api.nal.usda.gov/fdc/v1";

#[derive(Debug, Deserialize)]
pub struct BrandedSearchQuery {
    pub q: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub brand: Option<String>,
}

fn fdc_key(state: &AppState) -> ApiResult<&str> {
    let k = state.fdc_api_key.trim();
    if k.is_empty() {
        return Err(AppError::Unavailable(
            "FDC_API_KEY not set — get a free key at https://api.data.gov/signup/".into(),
        ));
    }
    Ok(k)
}

fn nutrient_number(n: &Value) -> String {
    n.get("nutrientNumber")
        .or_else(|| n.pointer("/nutrient/number"))
        .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|i| i.to_string())))
        .unwrap_or_default()
}

fn nutrient_name(n: &Value) -> String {
    n.get("nutrientName")
        .or_else(|| n.pointer("/nutrient/name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn nutrient_unit(n: &Value) -> String {
    n.get("unitName")
        .or_else(|| n.pointer("/nutrient/unitName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn nutrient_value(n: &Value) -> Option<f64> {
    n.get("value")
        .or_else(|| n.get("amount"))
        .and_then(|v| v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)))
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Map FDC food JSON → CookBook-shaped catalog item (slim).
fn normalize_branded(food: &Value) -> Value {
    let fdc_id = food
        .get("fdcId")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let description = food
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("Branded food")
        .to_string();
    let brand = food
        .get("brandOwner")
        .or_else(|| food.get("brandName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let brand_name = food
        .get("brandName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let gtin = food
        .get("gtinUpc")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let ingredients = food
        .get("ingredients")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let category = food
        .get("foodCategory")
        .and_then(|v| {
            if v.is_string() {
                v.as_str().map(|s| s.to_string())
            } else {
                v.get("description")
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string())
            }
        })
        .unwrap_or_else(|| "Branded".to_string());

    let mut energy_kcal = None;
    let mut protein_g = None;
    let mut fat_g = None;
    let mut carbs_g = None;
    let mut fiber_g = None;
    let mut micros = Vec::new();

    if let Some(arr) = food.get("foodNutrients").and_then(|v| v.as_array()) {
        for n in arr {
            let num = nutrient_number(n);
            let Some(val) = nutrient_value(n) else { continue };
            let unit = nutrient_unit(n).to_lowercase();
            match num.as_str() {
                "208" => {
                    energy_kcal = Some(if unit.contains("kj") {
                        round2(val / 4.184)
                    } else {
                        round2(val)
                    });
                }
                "203" => protein_g = Some(round2(val)),
                "204" => fat_g = Some(round2(val)),
                "205" => carbs_g = Some(round2(val)),
                "291" => fiber_g = Some(round2(val)),
                "301" | "303" | "304" | "306" | "307" | "309" | "401" => {
                    if micros.len() < 12 {
                        micros.push(json!({
                            "name": nutrient_name(n),
                            "amount": round2(val),
                            "unit": nutrient_unit(n),
                        }));
                    }
                }
                _ => {
                    // Also catch by name for search results with incomplete numbers
                    let name = nutrient_name(n).to_lowercase();
                    if energy_kcal.is_none() && name.contains("energy") && unit.contains("kcal") {
                        energy_kcal = Some(round2(val));
                    }
                }
            }
        }
    }

    let serving = food
        .get("servingSize")
        .and_then(|v| v.as_f64())
        .map(|s| {
            let u = food
                .get("servingSizeUnit")
                .and_then(|v| v.as_str())
                .unwrap_or("g");
            format!("{s} {u}")
        });

    let macros_complete =
        energy_kcal.is_some() && protein_g.is_some() && fat_g.is_some() && carbs_g.is_some();

    json!({
        "id": format!("branded-{fdc_id}"),
        "fdc_id": fdc_id,
        "foodb_id": null,
        "name": description,
        "name_scientific": null,
        "description": if ingredients.is_empty() { description.clone() } else { ingredients.clone() },
        "food_group": category,
        "food_subgroup": "Branded",
        "picture": null,
        "picture_candidates": [],
        "emoji": "",
        "source": "USDA Branded Foods",
        "brand_owner": brand,
        "brand_name": brand_name,
        "gtin_upc": gtin,
        "ingredients_label": ingredients,
        "serving_size": serving,
        "macros": {
            "energy_kcal": energy_kcal,
            "protein_g": protein_g,
            "fat_g": fat_g,
            "carbs_g": carbs_g,
            "fiber_g": fiber_g,
        },
        "macros_complete": macros_complete,
        "micros": micros,
        "other_nutrients": [],
        "nutrient_sources": {
            "macros": "usda_branded",
            "micros": "usda_branded",
            "usda_fdc_id": fdc_id,
        },
    })
}

pub async fn search_branded(
    State(state): State<AppState>,
    Query(q): Query<BrandedSearchQuery>,
) -> ApiResult<Json<Value>> {
    let key = fdc_key(&state)?;
    let query = q.q.as_deref().unwrap_or("").trim();
    if query.chars().count() < 2 {
        return Ok(Json(json!({
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": 25,
            "message": "Type at least 2 characters to search branded foods",
        })));
    }

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(25).clamp(1, 50);

    let mut params = vec![
        ("api_key", key.to_string()),
        ("query", query.to_string()),
        ("dataType", "Branded".to_string()),
        ("pageSize", page_size.to_string()),
        ("pageNumber", page.to_string()),
    ];
    if let Some(brand) = q.brand.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        params.push(("brandOwner", brand.to_string()));
    }

    let url = format!("{FDC_BASE}/foods/search");
    let res = state
        .http
        .get(&url)
        .query(&params)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "fdc search request failed");
            AppError::Unavailable("USDA FoodData Central unreachable".into())
        })?;

    if res.status().as_u16() == 403 || res.status().as_u16() == 401 {
        return Err(AppError::Unavailable(
            "Invalid or missing FDC_API_KEY (free at https://api.data.gov/signup/)".into(),
        ));
    }
    if res.status().as_u16() == 429 {
        return Err(AppError::Unavailable(
            "USDA API rate limit hit — try again in a minute (free tier ~1000 req/hour)".into(),
        ));
    }
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "fdc search error");
        return Err(AppError::Unavailable(format!("USDA API error ({status})")));
    }

    let body: Value = res.json().await.map_err(|e| {
        tracing::error!(error = %e, "fdc search parse failed");
        AppError::Internal("bad USDA response".into())
    })?;

    let total = body
        .get("totalHits")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let foods = body
        .get("foods")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let items: Vec<Value> = foods.iter().map(normalize_branded).collect();

    Ok(Json(json!({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "source": "USDA FoodData Central Branded Foods (live search)",
        "note": "Results are searched on demand — not stored on our servers",
    })))
}

pub async fn get_branded(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let key = fdc_key(&state)?;
    // Accept "branded-123" or bare "123"
    let fdc_id = id
        .strip_prefix("branded-")
        .unwrap_or(&id)
        .trim()
        .to_string();
    if fdc_id.is_empty() || !fdc_id.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest("invalid branded food id".into()));
    }

    let url = format!("{FDC_BASE}/food/{fdc_id}");
    let res = state
        .http
        .get(&url)
        .query(&[("api_key", key)])
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "fdc get request failed");
            AppError::Unavailable("USDA FoodData Central unreachable".into())
        })?;

    if res.status().as_u16() == 404 {
        return Err(AppError::NotFound("branded food not found".into()));
    }
    if res.status().as_u16() == 403 || res.status().as_u16() == 401 {
        return Err(AppError::Unavailable(
            "Invalid or missing FDC_API_KEY (free at https://api.data.gov/signup/)".into(),
        ));
    }
    if res.status().as_u16() == 429 {
        return Err(AppError::Unavailable(
            "USDA API rate limit hit — try again shortly".into(),
        ));
    }
    if !res.status().is_success() {
        return Err(AppError::Unavailable(format!(
            "USDA API error ({})",
            res.status()
        )));
    }

    let body: Value = res.json().await.map_err(|_| {
        AppError::Internal("bad USDA response".into())
    })?;

    Ok(Json(normalize_branded(&body)))
}
