use axum::{extract::State, routing, Json, Router};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use shared::ApiResponse;

use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::AuthUser;
use crate::models::UserRow;
use crate::schema::{server_settings, users};

pub fn router() -> Router<DbPool> {
    Router::new()
        .route("/public", routing::get(get_public))
        .route("/", routing::get(get_settings).patch(update_settings))
}

#[derive(Debug, Serialize)]
struct ServerSettings {
    registration_open: bool,
}

async fn get_public(State(pool): State<DbPool>) -> AppResult<Json<ApiResponse<ServerSettings>>> {
    let mut conn = pool.get()?;
    let val: Option<String> = server_settings::table
        .find("registration_open")
        .select(server_settings::value)
        .first(&mut conn)
        .optional()?;
    Ok(Json(ApiResponse::ok(ServerSettings {
        registration_open: val.map(|v| v == "true").unwrap_or(true),
    })))
}

async fn get_settings(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ApiResponse<ServerSettings>>> {
    let mut conn = pool.get()?;
    let row: UserRow = users::table.find(user_id).first(&mut conn)?;
    if row.role != "admin" {
        return Err(crate::error::AppError::Unauthorized(
            "需要管理员权限".into(),
        ));
    }
    let val: Option<String> = server_settings::table
        .find("registration_open")
        .select(server_settings::value)
        .first(&mut conn)
        .optional()?;
    Ok(Json(ApiResponse::ok(ServerSettings {
        registration_open: val.map(|v| v == "true").unwrap_or(true),
    })))
}

#[derive(Debug, Deserialize)]
struct UpdateSettingsRequest {
    registration_open: bool,
}

async fn update_settings(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<UpdateSettingsRequest>,
) -> AppResult<Json<ApiResponse<ServerSettings>>> {
    tracing::info!("管理员 {} 更新注册开关: {}", user_id, req.registration_open);
    let mut conn = pool.get()?;
    let row: UserRow = users::table.find(user_id).first(&mut conn)?;
    if row.role != "admin" {
        return Err(crate::error::AppError::Unauthorized(
            "需要管理员权限".into(),
        ));
    }

    diesel::update(server_settings::table.find("registration_open"))
        .set(server_settings::value.eq(req.registration_open.to_string()))
        .execute(&mut conn)
        .or_else(|_| {
            diesel::insert_into(server_settings::table)
                .values((
                    server_settings::key.eq("registration_open"),
                    server_settings::value.eq(req.registration_open.to_string()),
                ))
                .execute(&mut conn)
        })?;

    Ok(Json(ApiResponse::ok(ServerSettings {
        registration_open: req.registration_open,
    })))
}
