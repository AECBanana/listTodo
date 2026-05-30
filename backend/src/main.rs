mod auth;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod schema;

use axum::http::HeaderValue;
use axum::Router;
use diesel_migrations::{FileBasedMigrations, MigrationHarness};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=debug,tower_http=info".into()),
        )
        .init();

    dotenvy::dotenv().ok();

    let pool = db::init_pool();

    // 运行数据库迁移
    let migrations = FileBasedMigrations::find_migrations_directory()?;
    let mut conn = pool.get()?;
    conn.run_pending_migrations(migrations)
        .expect("数据库迁移失败");
    drop(conn);

    let allowed_origins: Vec<HeaderValue> = std::env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| {
            "http://localhost:5173,http://localhost:1420,tauri://localhost,https://todo.rino.ink"
                .into()
        })
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    if allowed_origins.is_empty() {
        tracing::error!("CORS_ORIGINS 解析失败或为空，无法启动服务");
        anyhow::bail!("CORS_ORIGINS must contain at least one valid origin");
    }

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", handlers::router())
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;",
            ),
        ))
        .layer(RequestBodyLimitLayer::new(5 * 1024 * 1024)) // 5 MB
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::info!("服务启动 http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
