pub mod auth;
pub mod project;
pub mod server;
pub mod sync;
pub mod tag;
pub mod task;
pub mod user;

use crate::db::DbPool;
use axum::Router;

pub fn router() -> Router<DbPool> {
    Router::new()
        .nest("/auth", auth::router())
        .nest("/projects", project::router())
        .nest("/tasks", task::router())
        .nest("/tags", tag::router())
        .nest("/sync", sync::router())
        .nest("/settings", server::router())
        .nest("/user", user::router())
}
