// ============================================================
// 本地数据库抽象接口
// ============================================================

import type { Project, Task, Tag } from "../types";

export interface LocalDB {
  // 初始化
  init(): Promise<void>;

  // Projects
  getAllProjects(): Promise<Project[]>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // Tags
  getAllTags(): Promise<Tag[]>;
  saveTag(tag: Tag): Promise<void>;
  deleteTag(id: string): Promise<void>;

  // 批量导入（首次同步或拉取全量）
  importAll(data: {
    projects: Project[];
    tasks: Task[];
    tags: Tag[];
  }): Promise<void>;

  // 处理远端删除
  deleteEntities(deleted: { entity_type: string; entity_id: string }[]): Promise<void>;

  // 同步状态
  getLastSyncTime(): Promise<string | null>;
  setLastSyncTime(iso: string): Promise<void>;
}
