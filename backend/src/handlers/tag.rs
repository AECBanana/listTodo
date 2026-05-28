use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing, Json, Router,
};
use diesel::prelude::*;
use shared::{ApiResponse, CreateTagRequest, Tag, UpdateTagRequest};
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::AuthUser;
use crate::models::{NewTag, TagRow};
use crate::schema::deleted_entities as de;
use crate::schema::{tags, tasks};

pub fn router() -> Router<DbPool> {
    Router::new()
        .route("/", routing::get(list).post(create))
        .route("/{id}", routing::patch(update).delete(delete))
}

// GET /api/tags
async fn list(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ApiResponse<Vec<Tag>>>> {
    let mut conn = pool.get()?;
    let rows: Vec<TagRow> = tags::table
        .filter(tags::user_id.eq(user_id))
        .order_by(tags::name.asc())
        .load(&mut conn)?;
    let data: Vec<Tag> = rows.into_iter().map(Tag::from).collect();
    Ok(Json(ApiResponse::ok(data)))
}

// POST /api/tags
async fn create(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<CreateTagRequest>,
) -> AppResult<(StatusCode, Json<ApiResponse<Tag>>)> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("名称不能为空".into()));
    }

    let mut conn = pool.get()?;

    let dup: bool = diesel::select(diesel::dsl::exists(
        tags::table
            .filter(tags::user_id.eq(user_id))
            .filter(tags::name.eq(&req.name)),
    ))
    .get_result(&mut conn)?;
    if dup {
        return Err(AppError::BadRequest("标签名称已存在".into()));
    }

    let new = NewTag {
        id: req.id.unwrap_or_else(Uuid::new_v4),
        user_id,
        name: req.name,
        color: req.color.unwrap_or_else(|| "#808080".into()),
    };

    let row: TagRow = diesel::insert_into(tags::table)
        .values(&new)
        .returning(TagRow::as_returning())
        .get_result(&mut conn)?;

    tracing::info!("标签创建: {} (user={})", row.name, user_id);
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(Tag::from(row)))))
}

// PATCH /api/tags/{id}
async fn update(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTagRequest>,
) -> AppResult<Json<ApiResponse<Tag>>> {
    let mut conn = pool.get()?;

    let tag_row: TagRow = tags::table
        .filter(tags::user_id.eq(user_id))
        .filter(tags::id.eq(id))
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("标签不存在".into()))?;

    if let Some(name) = &req.name {
        let dup: bool = diesel::select(diesel::dsl::exists(
            tags::table
                .filter(tags::user_id.eq(user_id))
                .filter(tags::id.ne(id))
                .filter(tags::name.eq(name)),
        ))
        .get_result(&mut conn)?;
        if dup {
            return Err(AppError::BadRequest("标签名称已存在".into()));
        }
        // 更新任务中的标签名
        let old_name = tag_row.name.replace("'", "''");
        let new_name = name.replace("'", "''");
        diesel::update(tasks::table.filter(tasks::user_id.eq(user_id)))
            .set(tasks::tags.eq(diesel::dsl::sql::<
                diesel::sql_types::Array<diesel::sql_types::Nullable<diesel::sql_types::Text>>,
            >(&format!(
                "array_replace(tags, '{}', '{}')",
                old_name, new_name
            ))))
            .execute(&mut conn)?;
        diesel::update(
            tags::table
                .filter(tags::user_id.eq(user_id))
                .filter(tags::id.eq(id)),
        )
        .set(tags::name.eq(name))
        .execute(&mut conn)?;
    }
    if let Some(color) = &req.color {
        let val = color.as_deref().unwrap_or("#808080");
        diesel::update(
            tags::table
                .filter(tags::user_id.eq(user_id))
                .filter(tags::id.eq(id)),
        )
        .set(tags::color.eq(val))
        .execute(&mut conn)?;
    }

    let row: TagRow = tags::table
        .filter(tags::user_id.eq(user_id))
        .filter(tags::id.eq(id))
        .first(&mut conn)?;
    Ok(Json(ApiResponse::ok(Tag::from(row))))
}

// DELETE /api/tags/{id}
async fn delete(
    State(pool): State<DbPool>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let mut conn = pool.get()?;

    let tag_row: TagRow = tags::table
        .filter(tags::user_id.eq(user_id))
        .filter(tags::id.eq(id))
        .first(&mut conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("标签不存在".into()))?;

    let tag_name = tag_row.name.replace("'", "''");

    let deleted = diesel::delete(
        tags::table
            .filter(tags::user_id.eq(user_id))
            .filter(tags::id.eq(id)),
    )
    .execute(&mut conn)?;

    if deleted == 0 {
        return Err(AppError::NotFound("标签不存在".into()));
    }

    diesel::insert_into(de::table)
        .values((
            de::entity_type.eq("tag"),
            de::entity_id.eq(id),
            de::user_id.eq(user_id),
        ))
        .on_conflict((de::entity_type, de::entity_id))
        .do_nothing()
        .execute(&mut conn)?;

    // 从所有引用该标签的任务中移除
    diesel::update(tasks::table.filter(tasks::user_id.eq(user_id)))
        .set(tasks::tags.eq(diesel::dsl::sql::<
            diesel::sql_types::Array<diesel::sql_types::Nullable<diesel::sql_types::Text>>,
        >(&format!("array_remove(tags, '{}')", tag_name))))
        .execute(&mut conn)?;

    tracing::info!("标签删除: {} (user={})", tag_name, user_id);
    Ok(StatusCode::NO_CONTENT)
}
