use axum::{extract::State, routing, Json, Router};
use diesel::prelude::*;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use shared::{
    ApiResponse, AuthResponse, ChangePasswordRequest, LoginRequest, PubkeyResponse,
    RegisterRequest, User,
};

use crate::auth;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::{
    check_rate_limit, is_ip_already_registered, mark_ip_registered, AuthUser, RateLimitExtractor,
};
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
        .route("/password", routing::patch(change_password))
}

// GET /api/auth/pubkey — 前端获取公钥
async fn pubkey() -> Json<ApiResponse<PubkeyResponse>> {
    Json(ApiResponse::ok(PubkeyResponse {
        public_key: auth::get_public_key_pem(),
    }))
}

/// 密码处理：RSA 解密 → 长度校验 → SHA-256 → bcrypt
fn process_password(encrypted_b64: &str) -> Result<String, AppError> {
    let plain = auth::decrypt_password(encrypted_b64).map_err(AppError::BadRequest)?;
    if plain.len() < 8 {
        return Err(AppError::BadRequest("密码长度不能少于8位".into()));
    }
    if plain.len() > 128 {
        return Err(AppError::BadRequest("密码不能超过128位".into()));
    }
    Ok(hex::encode(Sha256::digest(plain.as_bytes())))
}

// POST /api/auth/register
async fn register(
    State(pool): State<DbPool>,
    RateLimitExtractor(ip): RateLimitExtractor,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    // Rate limit: 3 registrations per minute per IP
    if !check_rate_limit(&format!("register:{}", ip), 3, 60) {
        return Err(AppError::TooManyRequests(
            "注册请求过于频繁，请稍后再试".into(),
        ));
    }

    // 限制每 IP 只能注册一个账号
    if is_ip_already_registered(ip.as_str()) {
        return Err(AppError::BadRequest("此 IP 已注册过账号".into()));
    }

    if req.username.trim().is_empty() {
        return Err(AppError::BadRequest("用户名不能为空".into()));
    }
    if req.username.len() < 3 || req.username.len() > 32 {
        return Err(AppError::BadRequest("用户名长度需在3-32个字符之间".into()));
    }

    // RSA 解密 → SHA-256 → bcrypt
    let sha256 = process_password(&req.encrypted_password)?;
    let password_hash = bcrypt::hash(&sha256, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Database("密码加密失败".into()))?;

    let mut conn = pool.get()?;

    // 事务内：原子性地检查注册开关 + insert，防止 TOCTOU 竞争
    let result: Result<UserRow, diesel::result::Error> = conn.transaction(|conn| {
        let user_count: i64 = users::table.count().get_result(conn)?;
        let registration_open: String = server_settings::table
            .find("registration_open")
            .select(server_settings::value)
            .first(conn)?;

        if registration_open != "true" && user_count > 0 {
            return Err(diesel::result::Error::RollbackTransaction);
        }

        let role = if user_count == 0 { "admin" } else { "normal" };

        let new_user = NewUser {
            username: req.username.clone(),
            password_hash,
            role: role.into(),
        };

        diesel::insert_into(users::table)
            .values(&new_user)
            .returning(UserRow::as_returning())
            .get_result(conn)
    });

    let row = match result {
        Ok(row) => row,
        Err(diesel::result::Error::RollbackTransaction) => {
            return Err(AppError::BadRequest("注册功能已关闭".into()));
        }
        Err(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        )) => {
            return Err(AppError::BadRequest("用户名已存在".into()));
        }
        Err(e) => return Err(AppError::from(e)),
    };

    let user: User = row.into();
    mark_ip_registered(ip.as_str());
    tracing::info!("用户注册成功: {} (role={})", user.username, user.role);
    let token = auth::create_token(user.id, &user.username)
        .map_err(|_| AppError::Database("Token 生成失败".into()))?;

    Ok(Json(ApiResponse::ok(AuthResponse { token, user })))
}

// POST /api/auth/login
async fn login(
    State(pool): State<DbPool>,
    RateLimitExtractor(ip): RateLimitExtractor,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    // Rate limit: 5 login attempts per minute per IP
    if !check_rate_limit(&format!("login:{}", ip), 5, 60) {
        return Err(AppError::TooManyRequests("请求过于频繁，请稍后再试".into()));
    }

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
        // Track failed login attempts for brute force protection
        check_rate_limit(&format!("login_fail:{}", ip), 10, 300);
        tracing::warn!("登录失败-密码错误: {}", req.username);
        return Err(AppError::BadRequest("用户名或密码错误".into()));
    }

    let user: User = row.into();
    tracing::info!("用户登录成功: {}", user.username);
    let token = auth::create_token(user.id, &user.username)
        .map_err(|_| AppError::Database("Token 生成失败".into()))?;

    Ok(Json(ApiResponse::ok(AuthResponse { token, user })))
}

// PATCH /api/auth/password
async fn change_password(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<ChangePasswordRequest>,
) -> AppResult<Json<ApiResponse<serde_json::Value>>> {
    let mut conn = pool.get()?;

    let row: UserRow = users::table
        .find(user_id)
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("用户不存在".into()))?;

    // 验证旧密码
    let old_sha256 = process_password(&req.old_encrypted_password)?;
    let valid = bcrypt::verify(&old_sha256, &row.password_hash).unwrap_or(false);
    if !valid {
        return Err(AppError::BadRequest("旧密码不正确".into()));
    }

    // 新密码
    let new_password_hash = process_password(&req.new_encrypted_password)?;
    let new_hash = bcrypt::hash(&new_password_hash, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Database("密码加密失败".into()))?;

    // 不允许新旧密码相同
    if old_sha256 == new_password_hash {
        return Err(AppError::BadRequest("新密码不能与旧密码相同".into()));
    }

    diesel::update(users::table.filter(users::id.eq(user_id)))
        .set(users::password_hash.eq(&new_hash))
        .execute(&mut conn)?;

    tracing::info!("用户 {} 修改密码成功", row.username);
    Ok(Json(ApiResponse::ok(
        serde_json::json!({"message": "密码修改成功"}),
    )))
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
