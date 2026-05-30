-- 启用 UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 清单
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#808080',
    kind        TEXT NOT NULL DEFAULT 'list',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    parent_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 任务
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    kind         TEXT NOT NULL DEFAULT 'task',
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    priority     TEXT NOT NULL DEFAULT 'none',
    is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
    due_date     TIMESTAMPTZ,
    project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
    parent_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
    tags         TEXT[] NOT NULL DEFAULT '{}',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_favorite  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 标签
CREATE TABLE tags (
    id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#808080',
    UNIQUE(user_id, name)
);

-- 索引
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX idx_tasks_parent_id  ON tasks(parent_id);
CREATE INDEX idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_parent  ON projects(parent_id);
CREATE INDEX idx_tags_user_id     ON tags(user_id);

-- 同步：记录已删除实体
CREATE TABLE deleted_entities (
    entity_type  TEXT NOT NULL,
    entity_id    UUID NOT NULL,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_type, entity_id)
);
