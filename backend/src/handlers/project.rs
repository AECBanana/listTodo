use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing, Json, Router,
};
use diesel::prelude::*;
use serde::Deserialize;
use shared::{ApiResponse, CreateProjectRequest, Project, UpdateProjectRequest};
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::AuthUser;
use crate::models::{NewProject, ProjectRow};
use crate::schema::deleted_entities as de;
use crate::schema::projects;

#[derive(Debug, Deserialize)]
struct ReorderItem {
    id: Uuid,
    sort_order: i32,
}

pub fn router() -> Router<DbPool> {
    Router::new()
        .route("/", routing::get(list).post(create))
        .route("/reorder", routing::patch(reorder))
        .route("/{id}", routing::get(get_one).patch(update).delete(delete))
}

// GET /api/projects
async fn list(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ApiResponse<Vec<Project>>>> {
    let mut conn = pool.get()?;
    let rows: Vec<ProjectRow> = projects::table
        .filter(projects::user_id.eq(user_id))
        .order_by((
            projects::parent_id.asc().nulls_first(),
            projects::sort_order.asc(),
            projects::name.asc(),
        ))
        .load(&mut conn)?;
    let data: Vec<Project> = rows.into_iter().map(Project::from).collect();
    Ok(Json(ApiResponse::ok(data)))
}

// GET /api/projects/{id}
async fn get_one(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ApiResponse<Project>>> {
    let mut conn = pool.get()?;
    let row: ProjectRow = projects::table
        .filter(projects::user_id.eq(user_id))
        .find(id)
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("清单不存在".into()))?;
    Ok(Json(ApiResponse::ok(Project::from(row))))
}

// POST /api/projects
async fn create(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<CreateProjectRequest>,
) -> AppResult<(StatusCode, Json<ApiResponse<Project>>)> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("名称不能为空".into()));
    }

    let new = NewProject {
        id: req.id.unwrap_or_else(Uuid::new_v4),
        user_id,
        name: req.name,
        color: req.color.unwrap_or_else(|| "#808080".into()),
        kind: req.kind.unwrap_or_else(|| "project".into()),
        sort_order: req.sort_order.unwrap_or(0),
        parent_id: req.parent_id,
    };

    let mut conn = pool.get()?;
    let row: ProjectRow = diesel::insert_into(projects::table)
        .values(&new)
        .returning(ProjectRow::as_returning())
        .get_result(&mut conn)?;

    tracing::info!("清单创建: {} (user={})", row.name, user_id);
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::ok(Project::from(row))),
    ))
}

// PATCH /api/projects/{id}
async fn update(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> AppResult<Json<ApiResponse<Project>>> {
    let mut conn = pool.get()?;

    let exists: bool = diesel::select(diesel::dsl::exists(
        projects::table
            .filter(projects::user_id.eq(user_id))
            .filter(projects::id.eq(id)),
    ))
    .get_result(&mut conn)?;
    if !exists {
        return Err(AppError::NotFound("清单不存在".into()));
    }

    if let Some(name) = &req.name {
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(id)),
        )
        .set(projects::name.eq(name))
        .execute(&mut conn)?;
    }
    if let Some(color) = &req.color {
        let val = color.as_deref().unwrap_or("#808080");
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(id)),
        )
        .set(projects::color.eq(val))
        .execute(&mut conn)?;
    }
    if let Some(kind) = &req.kind {
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(id)),
        )
        .set(projects::kind.eq(kind))
        .execute(&mut conn)?;
    }
    if let Some(sort_order) = req.sort_order {
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(id)),
        )
        .set(projects::sort_order.eq(sort_order))
        .execute(&mut conn)?;
    }
    if let Some(parent_id) = &req.parent_id {
        let val: Option<Uuid> = parent_id.as_ref().map(|id| *id);
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(id)),
        )
        .set(projects::parent_id.eq(val))
        .execute(&mut conn)?;
    }

    let row: ProjectRow = projects::table
        .filter(projects::user_id.eq(user_id))
        .filter(projects::id.eq(id))
        .first(&mut conn)?;
    Ok(Json(ApiResponse::ok(Project::from(row))))
}

// DELETE /api/projects/{id}
async fn delete(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let mut conn = pool.get()?;

    let deleted = diesel::delete(
        projects::table
            .filter(projects::user_id.eq(user_id))
            .filter(projects::id.eq(id)),
    )
    .execute(&mut conn)?;

    if deleted == 0 {
        return Err(AppError::NotFound("清单不存在".into()));
    }

    diesel::insert_into(de::table)
        .values((
            de::entity_type.eq("project"),
            de::entity_id.eq(id),
            de::user_id.eq(user_id),
        ))
        .on_conflict((de::entity_type, de::entity_id))
        .do_nothing()
        .execute(&mut conn)?;

    tracing::info!("清单删除: id={}", id);
    Ok(StatusCode::NO_CONTENT)
}

// PATCH /api/projects/reorder — 批量更新排序
async fn reorder(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(items): Json<Vec<ReorderItem>>,
) -> AppResult<StatusCode> {
    let mut conn = pool.get()?;
    for item in &items {
        diesel::update(
            projects::table
                .filter(projects::user_id.eq(user_id))
                .filter(projects::id.eq(item.id)),
        )
        .set(projects::sort_order.eq(item.sort_order))
        .execute(&mut conn)?;
    }
    Ok(StatusCode::NO_CONTENT)
}
