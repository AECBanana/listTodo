use axum::{extract::{Query, State}, routing, Json, Router};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use shared::{Project, Tag, Task};

use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::AuthUser;
use crate::models::{ProjectRow, TagRow, TaskRow};
use crate::schema::{deleted_entities as de, projects, tags, tasks};

pub fn router() -> Router<DbPool> {
    Router::new().route("/pull", routing::get(pull))
}

#[derive(Debug, Deserialize, Default)]
struct PullQuery {
    since: Option<String>,
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
    Query(query): Query<PullQuery>,
) -> AppResult<Json<shared::ApiResponse<PullData>>> {
    let mut conn = pool.get()?;

    let since_dt: Option<DateTime<Utc>> = query
        .since
        .as_deref()
        .and_then(|s| {
            // Try parsing ISO 8601 with various formats
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&Utc))
                .or_else(|_| {
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
                        .map(|naive| naive.and_utc())
                })
                .ok()
        });

    tracing::info!(
        "Sync pull: user={}, since={:?}",
        user_id,
        since_dt
    );

    // Projects: filter by updated_at if since is provided
    let mut project_query = projects::table
        .filter(projects::user_id.eq(user_id))
        .into_boxed();
    if let Some(since_dt) = since_dt {
        project_query = project_query.filter(projects::updated_at.gt(since_dt));
    }
    let all_projects: Vec<ProjectRow> = project_query.load(&mut conn)?;

    // Tasks: filter by updated_at if since is provided
    let mut task_query = tasks::table
        .filter(tasks::user_id.eq(user_id))
        .into_boxed();
    if let Some(since_dt) = since_dt {
        task_query = task_query.filter(tasks::updated_at.gt(since_dt));
    }
    let all_tasks: Vec<TaskRow> = task_query.load(&mut conn)?;

    // Tags: no updated_at column, always return all
    let all_tags: Vec<TagRow> = tags::table
        .filter(tags::user_id.eq(user_id))
        .load(&mut conn)?;

    // Deleted entities: filter by deleted_at if since is provided
    let mut deleted_query = de::table
        .filter(de::user_id.eq(user_id))
        .into_boxed();
    if let Some(since_dt) = since_dt {
        deleted_query = deleted_query.filter(de::deleted_at.gt(since_dt));
    }
    let all_deleted: Vec<DeletedRecord> = deleted_query
        .select((de::entity_type, de::entity_id))
        .load::<(String, uuid::Uuid)>(&mut conn)?
        .into_iter()
        .map(|(entity_type, entity_id)| DeletedRecord {
            entity_type,
            entity_id: entity_id.to_string(),
        })
        .collect();

    tracing::info!(
        "Sync 返回: projects={} tasks={} tags={} deleted={}",
        all_projects.len(),
        all_tasks.len(),
        all_tags.len(),
        all_deleted.len()
    );

    Ok(Json(shared::ApiResponse::ok(PullData {
        projects: all_projects.into_iter().map(Project::from).collect(),
        tasks: all_tasks.into_iter().map(Task::from).collect(),
        tags: all_tags.into_iter().map(Tag::from).collect(),
        deleted: all_deleted,
    })))
}
