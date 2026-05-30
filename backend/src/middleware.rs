use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::Instant;

use crate::auth;
use crate::error::AppError;

// ═══════════════════════════════════════════
//  Auth
// ═══════════════════════════════════════════

/// 从 JWT 中提取的认证用户
pub struct AuthUser(pub uuid::Uuid);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("缺少认证信息".into()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("认证格式错误".into()))?;

        let claims = auth::verify_token(token)
            .map_err(|_| AppError::Unauthorized("Token 无效或已过期".into()))?;

        Ok(AuthUser(claims.sub))
    }
}

// ═══════════════════════════════════════════
//  Rate Limiter
// ═══════════════════════════════════════════

static RATE_LIMITS: Lazy<Mutex<HashMap<String, Vec<Instant>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn check_rate_limit(key: &str, max_requests: usize, window_secs: u64) -> bool {
    let mut map = RATE_LIMITS.lock().unwrap();
    let now = Instant::now();
    let entries = map.entry(key.to_string()).or_default();
    entries.retain(|t| now.duration_since(*t).as_secs() < window_secs);
    if entries.len() >= max_requests {
        return false;
    }
    entries.push(now);
    true
}

pub fn mark_ip_registered(ip: &str) {
    let mut map = RATE_LIMITS.lock().unwrap();
    map.insert(format!("registered:{}", ip), vec![Instant::now()]);
}

pub fn is_ip_already_registered(ip: &str) -> bool {
    let map = RATE_LIMITS.lock().unwrap();
    map.contains_key(&format!("registered:{}", ip))
}

// ═══════════════════════════════════════════
//  Client IP extractor
// ═══════════════════════════════════════════

/// Extracts the client IP from request connection info or headers.
pub struct RateLimitExtractor(pub String);

impl<S> FromRequestParts<S> for RateLimitExtractor
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Try X-Forwarded-For header first
        if let Some(ip) = parts
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim().to_string())
        {
            return Ok(RateLimitExtractor(ip));
        }
        // Try X-Real-IP header
        if let Some(ip) = parts
            .headers
            .get("x-real-ip")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string())
        {
            if !ip.is_empty() {
                return Ok(RateLimitExtractor(ip));
            }
        }
        // Fallback: try ConnectInfo extension (requires into_make_service_with_connect_info)
        if let Some(addr) = parts
            .extensions
            .get::<axum::extract::ConnectInfo<SocketAddr>>()
        {
            return Ok(RateLimitExtractor(addr.0.ip().to_string()));
        }
        // Last resort
        Ok(RateLimitExtractor("unknown".to_string()))
    }
}
