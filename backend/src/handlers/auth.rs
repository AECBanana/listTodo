use axum::{extract::State, routing, Json, Router};
use diesel::prelude::*;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use shared::{ApiResponse, AuthResponse, LoginRequest, PubkeyResponse, RegisterRequest, User};

use crate::auth;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::AuthUser;
use crate::models::{NewUser, UserRow};
use crate::schema::{server_settings, users};

#[derive(Debug, Deserialize)]
struct UpdateProfileRequest {
    avatar: Option<String>,
}

pub fn router() -> Router<DbPool> {
    Router::new()
        .route("/pubkey", routing::get(pubkey))
        .route("/register", routing::post(register))
        .route("/login", routing::post(login))
        .route("/profile", routing::patch(update_profile))
}

// GET /api/auth/pubkey — 前端获取公钥
async fn pubkey() -> Json<ApiResponse<PubkeyResponse>> {
    Json(ApiResponse::ok(PubkeyResponse {
        public_key: auth::get_public_key_pem(),
    }))
}

/// 密码处理：RSA 解密 → SHA-256 → bcrypt
fn process_password(encrypted_b64: &str) -> Result<String, AppError> {
    let plain = auth::decrypt_password(encrypted_b64).map_err(|e| AppError::BadRequest(e))?;
    Ok(hex::encode(Sha256::digest(plain.as_bytes())))
}

// POST /api/auth/register
async fn register(
    State(pool): State<DbPool>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    if req.username.trim().is_empty() {
        return Err(AppError::BadRequest("用户名不能为空".into()));
    }
    if req.username.len() < 3 || req.username.len() > 32 {
        return Err(AppError::BadRequest("用户名长度需在3-32个字符之间".into()));
    }

    let mut conn = pool.get()?;

    let exists: bool = diesel::select(diesel::dsl::exists(
        users::table.filter(users::username.eq(&req.username)),
    ))
    .get_result(&mut conn)?;
    if exists {
        return Err(AppError::BadRequest("用户名已存在".into()));
    }

    // RSA 解密 → SHA-256 → bcrypt
    let sha256 = process_password(&req.encrypted_password)?;
    let password_hash = bcrypt::hash(&sha256, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Database("密码加密失败".into()))?;

    // 检查注册开关
    let user_count: i64 = users::table.count().get_result(&mut conn)?;
    let registration_open: String = server_settings::table
        .find("registration_open")
        .select(server_settings::value)
        .first(&mut conn)?;
    if registration_open != "true" && user_count > 0 {
        return Err(AppError::BadRequest("注册功能已关闭".into()));
    }

    let role = if user_count == 0 { "admin" } else { "normal" };

    let new_user = NewUser {
        username: req.username.clone(),
        password_hash,
        role: role.into(),
    };

    let row: UserRow = diesel::insert_into(users::table)
        .values(&new_user)
        .returning(UserRow::as_returning())
        .get_result(&mut conn)?;

    let user: User = row.into();
    tracing::info!("用户注册成功: {} (role={})", user.username, user.role);
    let token = auth::create_token(user.id, &user.username)
        .map_err(|_| AppError::Database("Token 生成失败".into()))?;

    Ok(Json(ApiResponse::ok(AuthResponse { token, user })))
}

// POST /api/auth/login
async fn login(
    State(pool): State<DbPool>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    let mut conn = pool.get()?;

    let row: UserRow = users::table
        .filter(users::username.eq(&req.username))
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| {
            tracing::warn!("登录失败-用户不存在: {}", req.username);
            AppError::BadRequest("用户名或密码错误".into())
        })?;

    let sha256 = process_password(&req.encrypted_password)?;
    let valid = bcrypt::verify(&sha256, &row.password_hash).unwrap_or(false);
    if !valid {
        tracing::warn!("登录失败-密码错误: {}", req.username);
        return Err(AppError::BadRequest("用户名或密码错误".into()));
    }

    let user: User = row.into();
    tracing::info!("用户登录成功: {}", user.username);
    let token = auth::create_token(user.id, &user.username)
        .map_err(|_| AppError::Database("Token 生成失败".into()))?;

    Ok(Json(ApiResponse::ok(AuthResponse { token, user })))
}

// PATCH /api/auth/profile
async fn update_profile(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<UpdateProfileRequest>,
) -> AppResult<Json<ApiResponse<User>>> {
    let mut conn = pool.get()?;

    if let Some(avatar) = &req.avatar {
        diesel::update(users::table.filter(users::id.eq(user_id)))
            .set(users::avatar.eq(Some(avatar)))
            .execute(&mut conn)?;
    }

    let row: UserRow = users::table.find(user_id).first(&mut conn)?;
    let user: User = row.into();
    Ok(Json(ApiResponse::ok(user)))
}
