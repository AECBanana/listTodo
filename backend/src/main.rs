mod auth;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod schema;

use axum::Router;
use diesel_migrations::{FileBasedMigrations, MigrationHarness};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber;

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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", handlers::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::info!("服务启动 http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
