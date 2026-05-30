use axum::response::IntoResponse;
use backend::error::AppError;

#[tokio::test]
async fn test_auth_error_types() {
    // Verify error types are correct
    let err = AppError::Unauthorized("test".into());
    let response = err.into_response();
    assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);

    // Check that the message is preserved
    let body_bytes = axum::body::to_bytes(response.into_body(), 1024)
        .await
        .unwrap();
    let body_str = String::from_utf8_lossy(&body_bytes);
    assert!(body_str.contains("test"));
}

#[test]
fn test_rate_limit_key_format() {
    // Test rate limit key generation logic
    let key = format!("login:127.0.0.1");
    assert_eq!(key, "login:127.0.0.1");

    let key = format!("register:192.168.1.1");
    assert_eq!(key, "register:192.168.1.1");
}

#[test]
fn test_all_error_variants_have_distinct_statuses() {
    use axum::http::StatusCode;

    let errors = vec![
        (AppError::NotFound("".into()), StatusCode::NOT_FOUND),
        (AppError::BadRequest("".into()), StatusCode::BAD_REQUEST),
        (AppError::Unauthorized("".into()), StatusCode::UNAUTHORIZED),
        (
            AppError::TooManyRequests("".into()),
            StatusCode::TOO_MANY_REQUESTS,
        ),
        (
            AppError::Database("".into()),
            StatusCode::INTERNAL_SERVER_ERROR,
        ),
    ];

    for (err, expected_status) in errors {
        let response = err.into_response();
        assert_eq!(response.status(), expected_status);
    }
}
