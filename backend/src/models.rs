use chrono::{DateTime, Utc};
use diesel::prelude::*;
use shared::{Priority, Project, Tag, Task, TaskKind, User};
use uuid::Uuid;

use crate::schema::{projects, tags, tasks, users};

// ═══════════════════════════════════════════
//  User
// ═══════════════════════════════════════════

#[derive(Queryable, Selectable, Identifiable)]
#[diesel(table_name = users)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        User {
            id: row.id,
            username: row.username,
            role: row.role,
            avatar: row.avatar,
            created_at: row.created_at,
        }
    }
}

// ═══════════════════════════════════════════
//  Project
// ═══════════════════════════════════════════

#[derive(Queryable, Selectable, Identifiable)]
#[diesel(table_name = projects)]
pub struct ProjectRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub kind: String,
    pub sort_order: i32,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = projects)]
pub struct NewProject {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub kind: String,
    pub sort_order: i32,
    pub parent_id: Option<Uuid>,
}

impl From<ProjectRow> for Project {
    fn from(row: ProjectRow) -> Self {
        Project {
            id: row.id,
            name: row.name,
            color: row.color,
            kind: row.kind,
            sort_order: row.sort_order,
            parent_id: row.parent_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

// ═══════════════════════════════════════════
//  Task
// ═══════════════════════════════════════════

#[derive(Queryable, Selectable, Identifiable)]
#[diesel(table_name = tasks)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct TaskRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub kind: String,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub priority: String,
    pub is_pinned: bool,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub project_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub tags: Vec<Option<String>>,
    pub sort_order: i32,
    pub is_favorite: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = tasks)]
pub struct NewTask {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub kind: String,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub priority: String,
    pub is_pinned: bool,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub project_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub sort_order: i32,
    pub is_favorite: bool,
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Task {
            id: row.id,
            title: row.title,
            description: row.description,
            kind: TaskKind::from_str(&row.kind).unwrap_or_default(),
            completed: row.completed,
            completed_at: row.completed_at,
            priority: Priority::from_str(&row.priority).unwrap_or_default(),
            is_pinned: row.is_pinned,
            due_date: row.due_date,
            start_date: row.start_date,
            project_id: row.project_id,
            parent_id: row.parent_id,
            tags: row.tags.into_iter().flatten().collect(),
            sort_order: row.sort_order,
            is_favorite: row.is_favorite,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

// ═══════════════════════════════════════════
//  Tag
// ═══════════════════════════════════════════

#[derive(Queryable, Selectable, Identifiable)]
#[diesel(table_name = tags)]
pub struct TagRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
}

#[derive(Insertable)]
#[diesel(table_name = tags)]
pub struct NewTag {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
}

impl From<TagRow> for Tag {
    fn from(row: TagRow) -> Self {
        Tag {
            id: row.id,
            name: row.name,
            color: row.color,
        }
    }
}
