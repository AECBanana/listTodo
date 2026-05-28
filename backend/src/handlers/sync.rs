use axum::{extract::State, routing, Json, Router};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use shared::{Project, Tag, Task};

use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::AuthUser;
use crate::models::{ProjectRow, TagRow, TaskRow};
use crate::schema::{projects, tags, tasks};

pub fn router() -> Router<DbPool> {
    Router::new().route("/pull", routing::get(pull))
}

#[derive(Debug, Serialize)]
struct PullData {
    projects: Vec<Project>,
    tasks: Vec<Task>,
    tags: Vec<Tag>,
    deleted: Vec<DeletedRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeletedRecord {
    entity_type: String,
    entity_id: String,
}

// GET /api/sync/pull?since=2024-01-01T00:00:00Z
async fn pull(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<shared::ApiResponse<PullData>>> {
    let mut conn = pool.get()?;

    tracing::info!("Sync pull: user={}", user_id);

    let all_projects: Vec<ProjectRow> = projects::table
        .filter(projects::user_id.eq(user_id))
        .load(&mut conn)?;
    let all_tasks: Vec<TaskRow> = tasks::table
        .filter(tasks::user_id.eq(user_id))
        .load(&mut conn)?;
    let all_tags: Vec<TagRow> = tags::table
        .filter(tags::user_id.eq(user_id))
        .load(&mut conn)?;

    tracing::info!(
        "Sync 返回: projects={} tasks={} tags={}",
        all_projects.len(),
        all_tasks.len(),
        all_tags.len()
    );

    Ok(Json(shared::ApiResponse::ok(PullData {
        projects: all_projects.into_iter().map(Project::from).collect(),
        tasks: all_tasks.into_iter().map(Task::from).collect(),
        tags: all_tags.into_iter().map(Tag::from).collect(),
        deleted: vec![],
    })))
}
