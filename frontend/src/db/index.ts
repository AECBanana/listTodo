// ============================================================
// 自动检测并返回合适的本地 DB 实现
// ============================================================

import type { LocalDB } from "./types";
import { IndexedDBImpl } from "./indexeddb";
import { TauriSQLImpl } from "./tauri";

let _db: LocalDB | null = null;

export async function getLocalDB(): Promise<LocalDB> {
  if (_db) return _db;

  // @ts-ignore: __TAURI__ 是 Tauri 注入的全局变量
  const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;

  if (isTauri) {
    _db = new TauriSQLImpl();
  } else {
    _db = new IndexedDBImpl();
  }

  await _db.init();
  return _db;
}
