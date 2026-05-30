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
    TooManyRequests(String),
    Database(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::StatusCode, response::IntoResponse};

    #[test]
    fn test_app_error_status_codes() {
        let err = AppError::BadRequest("bad".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let err = AppError::NotFound("not found".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let err = AppError::Unauthorized("nope".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let err = AppError::TooManyRequests("rate".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn test_database_error_status() {
        let err = AppError::Database("db error".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_app_error_from_diesel_result() {
        use diesel::result::Error as DieselError;
        let diesel_err = DieselError::NotFound;
        let app_err: AppError = diesel_err.into();
        let response = app_err.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    async fn test_app_error_message_in_response() {
        // Verify the error message is included in the JSON body
        let err = AppError::BadRequest("field X is required".into());
        let response = err.into_response();
        let body = axum::body::to_bytes(response.into_body(), 1024)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        assert!(body_str.contains("field X is required"));
    }
}
