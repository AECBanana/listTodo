use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing, Json, Router,
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use shared::{ApiResponse, CreateTaskRequest, Task, UpdateTaskRequest};
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::AuthUser;
use crate::models::{NewTask, TaskRow};
use crate::schema::deleted_entities as de;
use crate::schema::tasks;

pub fn router() -> Router<DbPool> {
    Router::new()
        .route("/", routing::get(list).post(create))
        .route("/{id}", routing::get(get_one).patch(update).delete(delete))
}

// GET /api/tasks
async fn list(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ApiResponse<Vec<Task>>>> {
    let mut conn = pool.get()?;
    let rows: Vec<TaskRow> = tasks::table
        .filter(tasks::user_id.eq(user_id))
        .order_by((
            tasks::is_pinned.desc(),
            tasks::sort_order.asc(),
            tasks::created_at.desc(),
        ))
        .load(&mut conn)?;
    let data: Vec<Task> = rows.into_iter().map(Task::from).collect();
    Ok(Json(ApiResponse::ok(data)))
}

// GET /api/tasks/{id}
async fn get_one(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ApiResponse<Task>>> {
    let mut conn = pool.get()?;
    let row: TaskRow = tasks::table
        .filter(tasks::user_id.eq(user_id))
        .find(id)
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("任务不存在".into()))?;
    Ok(Json(ApiResponse::ok(Task::from(row))))
}

// POST /api/tasks
async fn create(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<CreateTaskRequest>,
) -> AppResult<(StatusCode, Json<ApiResponse<Task>>)> {
    if req.title.trim().is_empty() {
        return Err(AppError::BadRequest("标题不能为空".into()));
    }
    if req.title.len() > 500 {
        return Err(AppError::BadRequest("标题不能超过500字".into()));
    }
    if let Some(ref desc) = req.description {
        if desc.len() > 50000 {
            return Err(AppError::BadRequest("描述过长".into()));
        }
    }

    let new = NewTask {
        id: req.id.unwrap_or_else(Uuid::new_v4),
        user_id,
        title: req.title,
        description: req.description,
        kind: req.kind.as_str().into(),
        completed: false,
        completed_at: None,
        priority: req.priority.as_str().into(),
        is_pinned: req.is_pinned,
        due_date: req.due_date,
        start_date: req.start_date,
        project_id: req.project_id,
        parent_id: req.parent_id,
        tags: req.tags,
        sort_order: 0,
        is_favorite: req.is_favorite,
    };

    let mut conn = pool.get()?;
    let row: TaskRow = diesel::insert_into(tasks::table)
        .values(&new)
        .returning(TaskRow::as_returning())
        .get_result(&mut conn)?;

    tracing::info!(
        "任务创建: {} (user={}, kind={})",
        row.title,
        user_id,
        row.kind
    );
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(Task::from(row)))))
}

// PATCH /api/tasks/{id}
async fn update(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> AppResult<Json<ApiResponse<Task>>> {
    let mut conn = pool.get()?;

    // helper: 过滤当前用户 + 指定 id
    let target = || {
        tasks::table
            .filter(tasks::user_id.eq(user_id))
            .filter(tasks::id.eq(id))
    };

    let exists: bool = diesel::select(diesel::dsl::exists(target())).get_result(&mut conn)?;
    if !exists {
        return Err(AppError::NotFound("任务不存在".into()));
    }

    // Validate input lengths
    if let Some(ref title) = req.title {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("标题不能为空".into()));
        }
        if title.len() > 500 {
            return Err(AppError::BadRequest("标题不能超过500字".into()));
        }
    }
    if let Some(Some(ref desc)) = req.description {
        if desc.len() > 50000 {
            return Err(AppError::BadRequest("描述过长".into()));
        }
    }

    if let Some(title) = &req.title {
        diesel::update(target())
            .set(tasks::title.eq(title))
            .execute(&mut conn)?;
    }
    if let Some(desc) = &req.description {
        let val: Option<&str> = desc.as_deref();
        diesel::update(target())
            .set(tasks::description.eq(val))
            .execute(&mut conn)?;
    }
    if let Some(kind) = req.kind {
        diesel::update(target())
            .set(tasks::kind.eq(kind.as_str()))
            .execute(&mut conn)?;
    }
    if let Some(completed) = req.completed {
        let completed_at: Option<DateTime<Utc>> = if completed { Some(Utc::now()) } else { None };
        diesel::update(target())
            .set((
                tasks::completed.eq(completed),
                tasks::completed_at.eq(completed_at),
            ))
            .execute(&mut conn)?;
    }
    if let Some(priority) = req.priority {
        diesel::update(target())
            .set(tasks::priority.eq(priority.as_str()))
            .execute(&mut conn)?;
    }
    if let Some(is_pinned) = req.is_pinned {
        diesel::update(target())
            .set(tasks::is_pinned.eq(is_pinned))
            .execute(&mut conn)?;
    }
    if let Some(due_date) = &req.due_date {
        let val: Option<DateTime<Utc>> = due_date.as_ref().copied();
        diesel::update(target())
            .set(tasks::due_date.eq(val))
            .execute(&mut conn)?;
    }
    if let Some(start_date) = &req.start_date {
        let val: Option<DateTime<Utc>> = start_date.as_ref().copied();
        diesel::update(target())
            .set(tasks::start_date.eq(val))
            .execute(&mut conn)?;
    }
    if let Some(project_id) = &req.project_id {
        let val: Option<Uuid> = project_id.as_ref().map(|id| *id);
        diesel::update(target())
            .set(tasks::project_id.eq(val))
            .execute(&mut conn)?;
    }
    if let Some(tags) = &req.tags {
        diesel::update(target())
            .set(tasks::tags.eq(tags))
            .execute(&mut conn)?;
    }
    if let Some(is_favorite) = req.is_favorite {
        diesel::update(target())
            .set(tasks::is_favorite.eq(is_favorite))
            .execute(&mut conn)?;
    }

    let row: TaskRow = target().first(&mut conn)?;
    Ok(Json(ApiResponse::ok(Task::from(row))))
}

// DELETE /api/tasks/{id}
async fn delete(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let mut conn = pool.get()?;

    let deleted = diesel::delete(
        tasks::table
            .filter(tasks::user_id.eq(user_id))
            .filter(tasks::id.eq(id)),
    )
    .execute(&mut conn)?;

    if deleted == 0 {
        return Err(AppError::NotFound("任务不存在".into()));
    }

    diesel::insert_into(de::table)
        .values((
            de::entity_type.eq("task"),
            de::entity_id.eq(id),
            de::user_id.eq(user_id),
        ))
        .on_conflict((de::entity_type, de::entity_id))
        .do_nothing()
        .execute(&mut conn)?;

    tracing::info!("任务删除: id={}", id);
    Ok(StatusCode::NO_CONTENT)
}
