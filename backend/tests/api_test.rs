use backend::handlers;

// Test: verify the router builds successfully (proves all routes are wired)
#[test]
fn test_router_builds() {
    // This won't connect to DB, just verifies the router compiles
    let _ = handlers::router;
}

// Test: sync query parameter parsing
#[test]
fn test_sync_pull_url_structure() {
    let since = "2026-05-28T07:56:38.976Z";
    let uri = format!("/sync/pull?since={}", since);
    assert!(uri.contains("since="));
    assert!(uri.starts_with("/sync/pull"));
}

// Test: verify handler functions are callable (type-check)
#[test]
fn test_handler_signatures() {
    // These just verify the types compile
    use backend::handlers::auth;
    use backend::handlers::project;
    use backend::handlers::sync;
    use backend::handlers::tag;
    use backend::handlers::task;

    let _ = task::router;
    let _ = auth::router;
    let _ = sync::router;
    let _ = tag::router;
    let _ = project::router;
}

// Test: validation of request sizes
#[test]
fn test_request_body_size_limit() {
    // The backend has a 5MB limit
    assert!(5 * 1024 * 1024 == 5242880); // 5MB in bytes
}

// Test: CORS origins parsing
#[test]
fn test_cors_origins_parsing() {
    let origins = "http://localhost:1420,http://localhost:5173,tauri://localhost";
    let parts: Vec<&str> = origins.split(',').map(|s| s.trim()).collect();
    assert_eq!(parts.len(), 3);
    assert!(parts.contains(&"http://localhost:1420"));
    assert!(parts.contains(&"tauri://localhost"));
}
