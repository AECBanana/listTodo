// ============================================================
// Tauri SQLite 实现（桌面端）
// ============================================================

import type { LocalDB } from "./types";
import type { Project, Task, Tag } from "../types";
import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:listtodo.db";

export class TauriSQLImpl implements LocalDB {
  private db!: Database;

  async init(): Promise<void> {
    this.db = await Database.load(DB_PATH);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#808080',
        kind TEXT DEFAULT 'list',
        sort_order INTEGER DEFAULT 0,
        parent_id TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        kind TEXT DEFAULT 'task',
        completed INTEGER DEFAULT 0,
        completed_at TEXT,
        priority TEXT DEFAULT 'none',
        is_pinned INTEGER DEFAULT 0,
        due_date TEXT,
        start_date TEXT,
        project_id TEXT,
        parent_id TEXT,
        tags TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#808080'
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  // --- 转换工具 ---

  private rowToProject(row: any): Project {
    return { ...row, parent_id: row.parent_id || null };
  }

  private projectToRow(p: Project): any {
    return {
      ...p,
      parent_id: p.parent_id || null,
    };
  }

  private rowToTask(row: any): Task {
    let tags = row.tags;
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    return {
      ...row,
      completed: row.completed === 1 || row.completed === true,
      completed_at: row.completed_at || null,
      description: row.description || null,
      due_date: row.due_date || null,
      start_date: row.start_date || null,
      project_id: row.project_id || null,
      parent_id: row.parent_id || null,
      is_pinned: row.is_pinned === 1 || row.is_pinned === true,
      is_favorite: row.is_favorite === 1 || row.is_favorite === true,
      tags,
    };
  }

  private taskToRow(t: Task): any {
    return {
      ...t,
      completed: t.completed ? 1 : 0,
      completed_at: t.completed_at || null,
      description: t.description || null,
      due_date: t.due_date || null,
      start_date: t.start_date || null,
      project_id: t.project_id || null,
      parent_id: t.parent_id || null,
      is_pinned: t.is_pinned ? 1 : 0,
      is_favorite: t.is_favorite ? 1 : 0,
      tags: JSON.stringify(t.tags),
    };
  }

  // --- Projects ---

  async getAllProjects(): Promise<Project[]> {
    const rows: any[] = await this.db.select("SELECT * FROM projects");
    return rows.map((r) => this.rowToProject(r));
  }

  async saveProject(project: Project): Promise<void> {
    const p = this.projectToRow(project);
    await this.db.execute(
      `INSERT OR REPLACE INTO projects (id, user_id, name, color, kind, sort_order, parent_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        p.id,
        p.user_id,
        p.name,
        p.color,
        p.kind,
        p.sort_order,
        p.parent_id,
        p.created_at,
        p.updated_at,
      ],
    );
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.execute("DELETE FROM projects WHERE id = $1", [id]);
  }

  // --- Tasks ---

  async getAllTasks(): Promise<Task[]> {
    const rows: any[] = await this.db.select("SELECT * FROM tasks");
    return rows.map((r) => this.rowToTask(r));
  }

  async saveTask(task: Task): Promise<void> {
    const t = this.taskToRow(task);
    await this.db.execute(
      `INSERT OR REPLACE INTO tasks
       (id, user_id, title, description, kind, completed, completed_at, priority,
        is_pinned, due_date, start_date, project_id, parent_id, tags,
        sort_order, is_favorite, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        t.id,
        t.user_id,
        t.title,
        t.description,
        t.kind,
        t.completed,
        t.completed_at,
        t.priority,
        t.is_pinned,
        t.due_date,
        t.start_date,
        t.project_id,
        t.parent_id,
        t.tags,
        t.sort_order,
        t.is_favorite,
        t.created_at,
        t.updated_at,
      ],
    );
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.execute("DELETE FROM tasks WHERE id = $1", [id]);
  }

  // --- Tags ---

  async getAllTags(): Promise<Tag[]> {
    const rows: any[] = await this.db.select("SELECT * FROM tags");
    return rows.map((r) => ({ ...r }));
  }

  async saveTag(tag: Tag): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO tags (id, user_id, name, color) VALUES ($1, $2, $3, $4)`,
      [tag.id, (tag as any).user_id, tag.name, tag.color],
    );
  }

  async deleteTag(id: string): Promise<void> {
    await this.db.execute("DELETE FROM tags WHERE id = $1", [id]);
  }

  // --- 批量导入 ---

  async importAll(data: {
    projects: Project[];
    tasks: Task[];
    tags: Tag[];
  }): Promise<void> {
    for (const p of data.projects) await this.saveProject(p);
    for (const t of data.tasks) await this.saveTask(t);
    for (const tg of data.tags) await this.saveTag(tg);
  }

  async deleteEntities(
    deleted: { entity_type: string; entity_id: string }[],
  ): Promise<void> {
    for (const d of deleted) {
      const table =
        d.entity_type === "project"
          ? "projects"
          : d.entity_type === "task"
            ? "tasks"
            : "tags";
      await this.db.execute(`DELETE FROM ${table} WHERE id = $1`, [
        d.entity_id,
      ]);
    }
  }

  // --- 同步时间 ---

  async getLastSyncTime(): Promise<string | null> {
    const rows: any[] = await this.db.select(
      "SELECT value FROM meta WHERE key = 'last_sync'",
    );
    return rows[0]?.value ?? null;
  }

  async setLastSyncTime(iso: string): Promise<void> {
    await this.db.execute(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', $1)",
      [iso],
    );
  }
}
