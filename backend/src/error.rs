use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use shared::ApiResponse;

/// 统一错误类型
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    Database(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m),
            AppError::Database(m) => {
                tracing::error!("数据库错误: {}", m);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "服务器内部错误".to_string(),
                )
            }
        };
        (status, Json(ApiResponse::<()>::err(msg))).into_response()
    }
}

impl From<diesel::result::Error> for AppError {
    fn from(e: diesel::result::Error) -> Self {
        tracing::error!("Diesel error: {:?}", e);
        AppError::Database("database error".into())
    }
}

impl From<diesel::r2d2::Error> for AppError {
    fn from(e: diesel::r2d2::Error) -> Self {
        tracing::error!("r2d2 pool error: {:?}", e);
        AppError::Database("database connection error".into())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(e: r2d2::Error) -> Self {
        tracing::error!("r2d2 error: {:?}", e);
        AppError::Database("database connection error".into())
    }
}

pub type AppResult<T> = Result<T, AppError>;
