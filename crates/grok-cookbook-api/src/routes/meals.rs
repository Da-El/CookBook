//! Meals CRUD — create, list, get, update, delete.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::auth::extract::{AuthUser, OptionalAuthUser};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct AuthorDto {
    pub id: String,
    pub handle: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MealIngredientDto {
    pub id: String,
    pub food_id: String,
    pub food_name: String,
    pub quantity_text: String,
    pub quantity_g: Option<f64>,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct MacrosDto {
    pub kcal: Option<f64>,
    pub protein_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fiber_g: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MealDto {
    pub id: String,
    pub author: AuthorDto,
    pub status: String,
    pub title: String,
    pub story: String,
    pub cuisine: String,
    pub time_minutes: Option<i32>,
    pub visibility: String,
    pub photo_url: Option<String>,
    pub author_rating: Option<i16>,
    pub macros_estimated: Option<MacrosDto>,
    pub ingredients: Vec<MealIngredientDto>,
    pub review_avg: Option<f64>,
    pub review_count: i64,
    pub my_score: Option<i16>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct IngredientIn {
    pub food_id: String,
    pub quantity_text: Option<String>,
    pub quantity_g: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMealBody {
    pub status: String,
    pub title: String,
    pub story: Option<String>,
    pub cuisine: Option<String>,
    pub time_minutes: Option<i32>,
    pub visibility: Option<String>,
    pub photo_url: Option<String>,
    pub rating: Option<i16>,
    #[serde(default)]
    pub ingredients: Vec<IngredientIn>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMealBody {
    pub status: Option<String>,
    pub title: Option<String>,
    pub story: Option<String>,
    pub cuisine: Option<String>,
    pub time_minutes: Option<i32>,
    pub visibility: Option<String>,
    pub photo_url: Option<String>,
    pub rating: Option<i16>,
    pub ingredients: Option<Vec<IngredientIn>>,
}

#[derive(Debug, Deserialize)]
pub struct ListMealsQuery {
    pub user_id: Option<String>,
    pub handle: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
}

fn validate_status(s: &str) -> ApiResult<&str> {
    match s {
        "cooked" | "want_to_cook" => Ok(s),
        _ => Err(AppError::BadRequest(
            "status must be cooked or want_to_cook".into(),
        )),
    }
}

fn validate_visibility(s: &str) -> ApiResult<&str> {
    match s {
        "public" | "private" => Ok(s),
        _ => Err(AppError::BadRequest(
            "visibility must be public or private".into(),
        )),
    }
}

fn parse_quantity_g(text: &str, explicit: Option<f64>) -> Option<f64> {
    if let Some(g) = explicit {
        if g > 0.0 {
            return Some(g);
        }
    }
    let t = text.trim().to_lowercase();
    let re = regex_lite(&t);
    re
}

/// Lightweight unit parse without adding a regex crate: `200g`, `1.5 kg`, `8 oz`, `2 lb`, `100ml`.
fn regex_lite(t: &str) -> Option<f64> {
    let t = t.trim();
    let mut num = String::new();
    let mut unit = String::new();
    let mut seen_dot = false;
    for c in t.chars() {
        if c.is_ascii_digit() {
            if unit.is_empty() {
                num.push(c);
            } else {
                return None;
            }
        } else if c == '.' && !seen_dot && unit.is_empty() {
            seen_dot = true;
            num.push(c);
        } else if c.is_ascii_whitespace() {
            continue;
        } else {
            unit.push(c);
        }
    }
    let n: f64 = num.parse().ok()?;
    match unit.as_str() {
        "g" => Some(n),
        "kg" => Some(n * 1000.0),
        "ml" => Some(n), // water density assumption
        "oz" => Some(n * 28.3495),
        "lb" => Some(n * 453.592),
        _ => None,
    }
}

fn macro_f64(macros: &serde_json::Value, keys: &[&str]) -> Option<f64> {
    for k in keys {
        if let Some(v) = macros.get(*k) {
            if v.is_null() {
                continue;
            }
            if let Some(n) = v.as_f64() {
                return Some(n);
            }
            if let Some(n) = v.as_i64() {
                return Some(n as f64);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.parse::<f64>() {
                    return Some(n);
                }
            }
        }
    }
    None
}

/// Estimate meal macros from ingredients when all have quantity_g + complete macros.
fn estimate_macros(
    state: &AppState,
    ings: &[(String, Option<f64>)],
) -> (Option<MacrosDto>, bool) {
    if ings.is_empty() {
        return (None, false);
    }
    let mut kcal = 0.0;
    let mut protein = 0.0;
    let mut fat = 0.0;
    let mut carbs = 0.0;
    let mut fiber = 0.0;
    let mut has_fiber = false;

    for (food_id, qg) in ings {
        let qg = match qg {
            Some(g) if *g > 0.0 => *g,
            _ => return (None, false),
        };
        let food = match state.catalog.get(food_id) {
            Some(f) => f,
            None => return (None, false),
        };
        let m = &food.macros;
        let k = match macro_f64(m, &["energy_kcal", "kcal", "calories"]) {
            Some(v) => v,
            None => return (None, false),
        };
        let p = match macro_f64(m, &["protein_g", "protein"]) {
            Some(v) => v,
            None => return (None, false),
        };
        let f = match macro_f64(m, &["fat_g", "fat"]) {
            Some(v) => v,
            None => return (None, false),
        };
        let c = match macro_f64(m, &["carbs_g", "carbohydrate_g", "carbs"]) {
            Some(v) => v,
            None => return (None, false),
        };
        let scale = qg / 100.0;
        kcal += k * scale;
        protein += p * scale;
        fat += f * scale;
        carbs += c * scale;
        if let Some(fi) = macro_f64(m, &["fiber_g", "fiber"]) {
            fiber += fi * scale;
            has_fiber = true;
        }
    }

    (
        Some(MacrosDto {
            kcal: Some((kcal * 10.0).round() / 10.0),
            protein_g: Some((protein * 10.0).round() / 10.0),
            fat_g: Some((fat * 10.0).round() / 10.0),
            carbs_g: Some((carbs * 10.0).round() / 10.0),
            fiber_g: if has_fiber {
                Some((fiber * 10.0).round() / 10.0)
            } else {
                None
            },
        }),
        true,
    )
}

#[derive(Debug, sqlx::FromRow)]
struct MealRow {
    id: String,
    user_id: String,
    status: String,
    title: String,
    story: String,
    cuisine: String,
    time_minutes: Option<i32>,
    visibility: String,
    photo_url: Option<String>,
    author_rating: Option<i16>,
    macros_kcal: Option<f64>,
    macros_protein_g: Option<f64>,
    macros_fat_g: Option<f64>,
    macros_carbs_g: Option<f64>,
    macros_fiber_g: Option<f64>,
    macros_estimated: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    author_handle: String,
    author_display_name: String,
    author_avatar_url: Option<String>,
    review_avg: Option<f64>,
    review_count: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct IngRow {
    id: String,
    food_id: String,
    food_name: String,
    quantity_text: String,
    quantity_g: Option<f64>,
    sort_order: i32,
}

async fn load_ingredients(pool: &sqlx::PgPool, meal_id: &str) -> ApiResult<Vec<MealIngredientDto>> {
    let rows: Vec<IngRow> = sqlx::query_as(
        r#"
        SELECT id, food_id, food_name, quantity_text, quantity_g, sort_order
        FROM meal_ingredients
        WHERE meal_id = $1
        ORDER BY sort_order ASC, id ASC
        "#,
    )
    .bind(meal_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| MealIngredientDto {
            id: r.id,
            food_id: r.food_id,
            food_name: r.food_name,
            quantity_text: r.quantity_text,
            quantity_g: r.quantity_g,
            sort_order: r.sort_order,
        })
        .collect())
}

async fn meal_row_to_dto(
    pool: &sqlx::PgPool,
    row: MealRow,
    viewer_id: Option<&str>,
) -> ApiResult<MealDto> {
    let ingredients = load_ingredients(pool, &row.id).await?;
    let my_score: Option<i16> = if let Some(uid) = viewer_id {
        sqlx::query_scalar(
            r#"
            SELECT score FROM subject_ratings
            WHERE user_id = $1 AND subject_type = 'meal' AND subject_id = $2
            "#,
        )
        .bind(uid)
        .bind(&row.id)
        .fetch_optional(pool)
        .await?
    } else {
        None
    };

    let macros_estimated = if row.macros_estimated {
        Some(MacrosDto {
            kcal: row.macros_kcal,
            protein_g: row.macros_protein_g,
            fat_g: row.macros_fat_g,
            carbs_g: row.macros_carbs_g,
            fiber_g: row.macros_fiber_g,
        })
    } else {
        None
    };

    Ok(MealDto {
        id: row.id,
        author: AuthorDto {
            id: row.user_id,
            handle: row.author_handle,
            display_name: row.author_display_name,
            avatar_url: row.author_avatar_url,
        },
        status: row.status,
        title: row.title,
        story: row.story,
        cuisine: row.cuisine,
        time_minutes: row.time_minutes,
        visibility: row.visibility,
        photo_url: row.photo_url,
        author_rating: row.author_rating,
        macros_estimated,
        ingredients,
        review_avg: row.review_avg,
        review_count: row.review_count,
        my_score,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

const MEAL_SELECT: &str = r#"
    SELECT m.id, m.user_id, m.status, m.title, m.story, m.cuisine, m.time_minutes,
           m.visibility, m.photo_url, m.author_rating,
           m.macros_kcal, m.macros_protein_g, m.macros_fat_g, m.macros_carbs_g, m.macros_fiber_g,
           m.macros_estimated, m.created_at, m.updated_at,
           u.handle AS author_handle, u.display_name AS author_display_name,
           u.avatar_url AS author_avatar_url,
           (SELECT AVG(score)::float8 FROM subject_ratings sr
              WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_avg,
           (SELECT COUNT(*)::bigint FROM subject_ratings sr
              WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_count
    FROM meals m
    JOIN users u ON u.id = m.user_id
"#;

async fn fetch_meal(pool: &sqlx::PgPool, id: &str) -> ApiResult<Option<MealRow>> {
    let q = format!("{MEAL_SELECT} WHERE m.id = $1");
    let row = sqlx::query_as::<_, MealRow>(&q)
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

async fn insert_ingredients(
    pool: &sqlx::PgPool,
    state: &AppState,
    meal_id: &str,
    ingredients: &[IngredientIn],
) -> ApiResult<Vec<(String, Option<f64>)>> {
    let mut for_macros = Vec::new();
    for (i, ing) in ingredients.iter().enumerate() {
        if ing.food_id.trim().is_empty() {
            return Err(AppError::BadRequest("ingredient food_id required".into()));
        }
        let food_name = state
            .catalog
            .get(&ing.food_id)
            .map(|f| f.name.clone())
            .unwrap_or_else(|| ing.food_id.clone());
        let qty_text = ing.quantity_text.clone().unwrap_or_default();
        let qty_g = parse_quantity_g(&qty_text, ing.quantity_g);
        let id = Ulid::new().to_string();
        sqlx::query(
            r#"
            INSERT INTO meal_ingredients
                (id, meal_id, food_id, food_name, quantity_text, quantity_g, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            "#,
        )
        .bind(&id)
        .bind(meal_id)
        .bind(&ing.food_id)
        .bind(&food_name)
        .bind(&qty_text)
        .bind(qty_g)
        .bind(i as i32)
        .execute(pool)
        .await?;
        for_macros.push((ing.food_id.clone(), qty_g));
    }
    Ok(for_macros)
}

pub async fn create_meal(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateMealBody>,
) -> ApiResult<(StatusCode, Json<MealDto>)> {
    let pool = require_pool(&state)?;
    let status = validate_status(body.status.trim())?;
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title required".into()));
    }
    if title.len() > 200 {
        return Err(AppError::BadRequest("title too long".into()));
    }
    let visibility = validate_visibility(body.visibility.as_deref().unwrap_or("public"))?;
    if let Some(r) = body.rating {
        if !(1..=10).contains(&r) {
            return Err(AppError::BadRequest("rating must be 1-10".into()));
        }
    }

    let meal_id = Ulid::new().to_string();
    let story = body.story.unwrap_or_default();
    let cuisine = body.cuisine.unwrap_or_default();
    let photo_url = body.photo_url.filter(|s| !s.is_empty());

    // Resolve macros from ingredients first (no txn for simplicity on v1)
    let mut for_macros = Vec::new();
    for ing in &body.ingredients {
        let qty_text = ing.quantity_text.clone().unwrap_or_default();
        let qty_g = parse_quantity_g(&qty_text, ing.quantity_g);
        for_macros.push((ing.food_id.clone(), qty_g));
    }
    let (macros, estimated) = estimate_macros(&state, &for_macros);
    let m = macros.clone().unwrap_or(MacrosDto {
        kcal: None,
        protein_g: None,
        fat_g: None,
        carbs_g: None,
        fiber_g: None,
    });

    sqlx::query(
        r#"
        INSERT INTO meals (
            id, user_id, status, title, story, cuisine, time_minutes, visibility,
            photo_url, author_rating,
            macros_kcal, macros_protein_g, macros_fat_g, macros_carbs_g, macros_fiber_g,
            macros_estimated
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,
            $11,$12,$13,$14,$15,
            $16
        )
        "#,
    )
    .bind(&meal_id)
    .bind(&auth.user_id)
    .bind(status)
    .bind(title)
    .bind(&story)
    .bind(&cuisine)
    .bind(body.time_minutes)
    .bind(visibility)
    .bind(&photo_url)
    .bind(body.rating)
    .bind(m.kcal)
    .bind(m.protein_g)
    .bind(m.fat_g)
    .bind(m.carbs_g)
    .bind(m.fiber_g)
    .bind(estimated)
    .execute(pool)
    .await?;

    insert_ingredients(pool, &state, &meal_id, &body.ingredients).await?;

    // Author self-review when rating provided on cooked meals
    if let Some(score) = body.rating {
        let rid = Ulid::new().to_string();
        sqlx::query(
            r#"
            INSERT INTO subject_ratings (id, user_id, subject_type, subject_id, score, notes, updated_at)
            VALUES ($1, $2, 'meal', $3, $4, '', NOW())
            ON CONFLICT (user_id, subject_type, subject_id)
            DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
            "#,
        )
        .bind(&rid)
        .bind(&auth.user_id)
        .bind(&meal_id)
        .bind(score)
        .execute(pool)
        .await?;
    }

    let row = fetch_meal(pool, &meal_id)
        .await?
        .ok_or_else(|| AppError::Internal("meal missing after insert".into()))?;
    let dto = meal_row_to_dto(pool, row, Some(&auth.user_id)).await?;
    Ok((StatusCode::CREATED, Json(dto)))
}

pub async fn list_meals(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(q): Query<ListMealsQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let viewer = auth.0.as_ref().map(|u| u.user_id.as_str());

    let mut user_id = q.user_id.clone();
    if user_id.is_none() {
        if let Some(handle) = q.handle.as_deref() {
            let uid: Option<String> =
                sqlx::query_scalar("SELECT id FROM users WHERE lower(handle) = lower($1)")
                    .bind(handle)
                    .fetch_optional(pool)
                    .await?;
            user_id = uid;
            if user_id.is_none() {
                return Err(AppError::NotFound("user not found".into()));
            }
        }
    }

    // Default: own meals if authed and no filter
    if user_id.is_none() {
        if let Some(v) = viewer {
            user_id = Some(v.to_string());
        } else {
            return Err(AppError::Unauthorized("login required to list meals".into()));
        }
    }

    let uid = user_id.unwrap();
    let is_owner = viewer == Some(uid.as_str());

    let rows: Vec<MealRow> = if is_owner {
        if let Some(st) = q.status.as_deref() {
            let st = validate_status(st)?;
            let sql = format!(
                "{MEAL_SELECT} WHERE m.user_id = $1 AND m.status = $2
                 ORDER BY m.created_at DESC, m.id DESC LIMIT $3"
            );
            sqlx::query_as(&sql)
                .bind(&uid)
                .bind(st)
                .bind(limit)
                .fetch_all(pool)
                .await?
        } else {
            let sql = format!(
                "{MEAL_SELECT} WHERE m.user_id = $1
                 ORDER BY m.created_at DESC, m.id DESC LIMIT $2"
            );
            sqlx::query_as(&sql)
                .bind(&uid)
                .bind(limit)
                .fetch_all(pool)
                .await?
        }
    } else {
        // Strangers only see public
        if let Some(st) = q.status.as_deref() {
            let st = validate_status(st)?;
            let sql = format!(
                "{MEAL_SELECT} WHERE m.user_id = $1 AND m.visibility = 'public' AND m.status = $2
                 ORDER BY m.created_at DESC, m.id DESC LIMIT $3"
            );
            sqlx::query_as(&sql)
                .bind(&uid)
                .bind(st)
                .bind(limit)
                .fetch_all(pool)
                .await?
        } else {
            let sql = format!(
                "{MEAL_SELECT} WHERE m.user_id = $1 AND m.visibility = 'public'
                 ORDER BY m.created_at DESC, m.id DESC LIMIT $2"
            );
            sqlx::query_as(&sql)
                .bind(&uid)
                .bind(limit)
                .fetch_all(pool)
                .await?
        }
    };

    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        items.push(meal_row_to_dto(pool, row, viewer).await?);
    }
    Ok(Json(serde_json::json!({ "items": items })))
}

pub async fn get_meal(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<MealDto>> {
    let pool = require_pool(&state)?;
    let viewer = auth.0.as_ref().map(|u| u.user_id.as_str());
    let row = fetch_meal(pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("meal not found".into()))?;

    if row.visibility == "private" && viewer != Some(row.user_id.as_str()) {
        return Err(AppError::NotFound("meal not found".into()));
    }

    Ok(Json(meal_row_to_dto(pool, row, viewer).await?))
}

pub async fn update_meal(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateMealBody>,
) -> ApiResult<Json<MealDto>> {
    let pool = require_pool(&state)?;
    let existing = fetch_meal(pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("meal not found".into()))?;
    if existing.user_id != auth.user_id {
        return Err(AppError::NotFound("meal not found".into()));
    }

    let status = if let Some(s) = body.status.as_deref() {
        validate_status(s)?.to_string()
    } else {
        existing.status.clone()
    };
    let title = body
        .title
        .as_deref()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .unwrap_or(&existing.title)
        .to_string();
    let story = body.story.unwrap_or(existing.story.clone());
    let cuisine = body.cuisine.unwrap_or(existing.cuisine.clone());
    let time_minutes = body.time_minutes.or(existing.time_minutes);
    let visibility = if let Some(v) = body.visibility.as_deref() {
        validate_visibility(v)?.to_string()
    } else {
        existing.visibility.clone()
    };
    let photo_url = body.photo_url.or(existing.photo_url.clone());
    let author_rating = body.rating.or(existing.author_rating);
    if let Some(r) = author_rating {
        if !(1..=10).contains(&r) {
            return Err(AppError::BadRequest("rating must be 1-10".into()));
        }
    }

    // Replace ingredients if provided
    let for_macros = if let Some(ings) = &body.ingredients {
        sqlx::query("DELETE FROM meal_ingredients WHERE meal_id = $1")
            .bind(&id)
            .execute(pool)
            .await?;
        insert_ingredients(pool, &state, &id, ings).await?
    } else {
        let existing_ings = load_ingredients(pool, &id).await?;
        existing_ings
            .into_iter()
            .map(|i| (i.food_id, i.quantity_g))
            .collect()
    };

    let (macros, estimated) = estimate_macros(&state, &for_macros);
    let m = macros.unwrap_or(MacrosDto {
        kcal: None,
        protein_g: None,
        fat_g: None,
        carbs_g: None,
        fiber_g: None,
    });

    sqlx::query(
        r#"
        UPDATE meals SET
            status = $2, title = $3, story = $4, cuisine = $5, time_minutes = $6,
            visibility = $7, photo_url = $8, author_rating = $9,
            macros_kcal = $10, macros_protein_g = $11, macros_fat_g = $12,
            macros_carbs_g = $13, macros_fiber_g = $14, macros_estimated = $15,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .bind(&status)
    .bind(&title)
    .bind(&story)
    .bind(&cuisine)
    .bind(time_minutes)
    .bind(&visibility)
    .bind(&photo_url)
    .bind(author_rating)
    .bind(m.kcal)
    .bind(m.protein_g)
    .bind(m.fat_g)
    .bind(m.carbs_g)
    .bind(m.fiber_g)
    .bind(estimated)
    .execute(pool)
    .await?;

    if let Some(score) = body.rating {
        let rid = Ulid::new().to_string();
        sqlx::query(
            r#"
            INSERT INTO subject_ratings (id, user_id, subject_type, subject_id, score, notes, updated_at)
            VALUES ($1, $2, 'meal', $3, $4, '', NOW())
            ON CONFLICT (user_id, subject_type, subject_id)
            DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
            "#,
        )
        .bind(&rid)
        .bind(&auth.user_id)
        .bind(&id)
        .bind(score)
        .execute(pool)
        .await?;
    }

    let row = fetch_meal(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("meal missing after update".into()))?;
    Ok(Json(meal_row_to_dto(pool, row, Some(&auth.user_id)).await?))
}

#[derive(Debug, Deserialize)]
pub struct SearchMealsQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

/// Public meal search for Browse.
pub async fn search_meals(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(q): Query<SearchMealsQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let limit = q.limit.unwrap_or(40).clamp(1, 100);
    let viewer = auth.0.as_ref().map(|u| u.user_id.as_str());
    let term = q.q.as_deref().unwrap_or("").trim();

    let rows: Vec<MealRow> = if term.is_empty() {
        let sql = format!(
            "{MEAL_SELECT} WHERE m.visibility = 'public'
             ORDER BY m.created_at DESC, m.id DESC LIMIT $1"
        );
        sqlx::query_as(&sql).bind(limit).fetch_all(pool).await?
    } else {
        let pattern = format!("%{}%", term.replace('%', "\\%").replace('_', "\\_"));
        let sql = format!(
            "{MEAL_SELECT} WHERE m.visibility = 'public'
               AND (m.title ILIKE $1 ESCAPE '\\' OR m.story ILIKE $1 ESCAPE '\\'
                    OR m.cuisine ILIKE $1 ESCAPE '\\' OR u.handle ILIKE $1 ESCAPE '\\'
                    OR u.display_name ILIKE $1 ESCAPE '\\')
             ORDER BY m.created_at DESC, m.id DESC LIMIT $2"
        );
        sqlx::query_as(&sql)
            .bind(&pattern)
            .bind(limit)
            .fetch_all(pool)
            .await?
    };

    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        items.push(meal_row_to_dto(pool, row, viewer).await?);
    }
    Ok(Json(serde_json::json!({ "items": items })))
}

pub async fn delete_meal(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let res = sqlx::query("DELETE FROM meals WHERE id = $1 AND user_id = $2")
        .bind(&id)
        .bind(&auth.user_id)
        .execute(pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("meal not found".into()));
    }
    // Clean ratings for this meal
    sqlx::query("DELETE FROM subject_ratings WHERE subject_type = 'meal' AND subject_id = $1")
        .bind(&id)
        .execute(pool)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true, "id": id })))
}
