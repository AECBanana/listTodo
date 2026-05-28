use axum::{extract::State, routing, Json, Router};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use shared::ApiResponse;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::AuthUser;
use crate::schema::user_settings;

pub fn router() -> Router<DbPool> {
    Router::new().route("/", routing::get(get).patch(update))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettings {
    pub theme: String,
    pub primary_color: String,
    pub background_image: Option<String>,
    pub blur_amount: i32,
}

#[derive(Insertable)]
#[diesel(table_name = user_settings)]
struct NewUserSettings {
    user_id: Uuid,
    theme: String,
    primary_color: String,
    background_image: Option<String>,
    blur_amount: i32,
}

async fn get(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ApiResponse<UserSettings>>> {
    let mut conn = pool.get()?;
    let settings: Option<(String, String, Option<String>, i32)> = user_settings::table
        .find(user_id)
        .select((
            user_settings::theme,
            user_settings::primary_color,
            user_settings::background_image,
            user_settings::blur_amount,
        ))
        .first(&mut conn)
        .optional()?;
    let (theme, primary_color, background_image, blur_amount) =
        settings.unwrap_or_else(|| ("light".into(), "#4772fa".into(), None, 20));
    Ok(Json(ApiResponse::ok(UserSettings {
        theme,
        primary_color,
        background_image,
        blur_amount,
    })))
}

async fn update(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<UserSettings>,
) -> AppResult<Json<ApiResponse<UserSettings>>> {
    let mut conn = pool.get()?;
    diesel::insert_into(user_settings::table)
        .values(&NewUserSettings {
            user_id,
            theme: req.theme.clone(),
            primary_color: req.primary_color.clone(),
            background_image: req.background_image.clone(),
            blur_amount: req.blur_amount,
        })
        .on_conflict(user_settings::user_id)
        .do_update()
        .set((
            user_settings::theme.eq(&req.theme),
            user_settings::primary_color.eq(&req.primary_color),
            user_settings::background_image.eq(&req.background_image),
            user_settings::blur_amount.eq(req.blur_amount),
        ))
        .execute(&mut conn)?;
    Ok(Json(ApiResponse::ok(req)))
}
