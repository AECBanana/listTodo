// ============================================================
// 同步引擎：pull（拉远端） + push（推本地变更）
// ============================================================

import { getLocalDB } from "./db";
import * as api from "./api/client";
import { getApiToken, API_BASE } from "./api/client";

export class SyncEngine {
  private syncing = false;

  /** 从远端拉取所有变更到本地 DB */
  async pull(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const db = await getLocalDB();
      const since = (await db.getLastSyncTime()) ?? "1970-01-01T00:00:00Z";

      const res = await fetch(
        `${API_BASE}/sync/pull?since=${encodeURIComponent(since)}`,
        {
          headers: this.authHeaders(),
        },
      );

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Pull failed: ${res.status}`, errBody);
        throw new Error(`Pull failed: ${res.status}`);
      }

      const json = await res.json();
      const data = json.data as {
        projects: any[];
        tasks: any[];
        tags: any[];
        deleted: { entity_type: string; entity_id: string }[];
      };

      await db.importAll({
        projects: data.projects,
        tasks: data.tasks,
        tags: data.tags,
      });

      // 处理删除
      if (data.deleted.length > 0) {
        await db.deleteEntities(data.deleted);
      }

      await db.setLastSyncTime(new Date().toISOString());
    } finally {
      this.syncing = false;
    }
  }

  /** 推送本地变更到远端。这里用现有的 CRUD API，不额外实现批量 push */
  async pushLocalChange(
    entity: "project" | "task" | "tag",
    action: "create" | "update" | "delete",
    data: any,
  ): Promise<void> {
    try {
      switch (entity) {
        case "project":
          if (action === "delete") await api.deleteProject(data.id);
          else if (action === "create") await api.createProject(data);
          else await api.updateProject(data.id, data);
          break;
        case "task":
          if (action === "delete") await api.deleteTask(data.id);
          else if (action === "create") await api.createTask(data);
          else await api.updateTask(data.id, data);
          break;
        case "tag":
          if (action === "delete") await api.deleteTag(data.id);
          else if (action === "create") await api.createTag(data);
          else await api.updateTag(data.id, data);
          break;
      }
    } catch (e) {
      console.error("推送变更失败:", entity, action, e);
    }
  }

  private authHeaders(): Record<string, string> {
    const token = getApiToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export const syncEngine = new SyncEngine();
