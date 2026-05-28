use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};

use crate::auth;
use crate::error::AppError;

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
