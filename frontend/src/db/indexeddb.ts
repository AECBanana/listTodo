// ============================================================
// IndexedDB 实现（浏览器）
// ============================================================

import type { LocalDB } from "./types";
import type { Project, Task, Tag } from "../types";

const DB_NAME = "listtodo";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("tasks"))
        db.createObjectStore("tasks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("tags"))
        db.createObjectStore("tags", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta"))
        db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDBImpl implements LocalDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDB();
  }

  // --- Projects ---

  async getAllProjects(): Promise<Project[]> {
    return promisify(tx(this.db!, "projects", "readonly").getAll());
  }

  async saveProject(project: Project): Promise<void> {
    await promisify(tx(this.db!, "projects", "readwrite").put(project));
  }

  async deleteProject(id: string): Promise<void> {
    await promisify(tx(this.db!, "projects", "readwrite").delete(id));
  }

  // --- Tasks ---

  async getAllTasks(): Promise<Task[]> {
    return promisify(tx(this.db!, "tasks", "readonly").getAll());
  }

  async saveTask(task: Task): Promise<void> {
    await promisify(tx(this.db!, "tasks", "readwrite").put(task));
  }

  async deleteTask(id: string): Promise<void> {
    await promisify(tx(this.db!, "tasks", "readwrite").delete(id));
  }

  // --- Tags ---

  async getAllTags(): Promise<Tag[]> {
    return promisify(tx(this.db!, "tags", "readonly").getAll());
  }

  async saveTag(tag: Tag): Promise<void> {
    await promisify(tx(this.db!, "tags", "readwrite").put(tag));
  }

  async deleteTag(id: string): Promise<void> {
    await promisify(tx(this.db!, "tags", "readwrite").delete(id));
  }

  // --- 批量导入 ---

  async importAll(data: {
    projects: Project[];
    tasks: Task[];
    tags: Tag[];
  }): Promise<void> {
    const db = this.db!;
    const t = db.transaction(
      ["projects", "tasks", "tags"],
      "readwrite",
    );

    for (const p of data.projects) t.objectStore("projects").put(p);
    for (const tsk of data.tasks) t.objectStore("tasks").put(tsk);
    for (const tg of data.tags) t.objectStore("tags").put(tg);

    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  // --- 删除 ---

  async deleteEntities(
    deleted: { entity_type: string; entity_id: string }[],
  ): Promise<void> {
    const db = this.db!;
    const t = db.transaction(
      ["projects", "tasks", "tags"],
      "readwrite",
    );

    for (const d of deleted) {
      const store = t.objectStore(
        d.entity_type === "project"
          ? "projects"
          : d.entity_type === "task"
            ? "tasks"
            : "tags",
      );
      store.delete(d.entity_id);
    }

    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  // --- 同步时间 ---

  async getLastSyncTime(): Promise<string | null> {
    const result = await promisify(
      tx(this.db!, "meta", "readonly").get("last_sync"),
    );
    return (result as { value: string } | undefined)?.value ?? null;
  }

  async setLastSyncTime(iso: string): Promise<void> {
    await promisify(
      tx(this.db!, "meta", "readwrite").put({ key: "last_sync", value: iso }),
    );
  }
}
