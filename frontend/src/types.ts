// ============================================================
// 与 shared crate 对应的 TypeScript 类型
// ============================================================

export type Priority = "none" | "low" | "medium" | "high";
export type TaskKind = "task" | "note";

export interface User {
  id: string;
  username: string;
  role: string;
  avatar: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  kind: string;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  kind: TaskKind;
  completed: boolean;
  completed_at: string | null;
  priority: Priority;
  due_date: string | null;
  start_date: string | null;
  project_id: string | null;
  parent_id: string | null;
  tags: string[];
  sort_order: number;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

// ---- 请求体 ----

export interface RegisterRequest {
  username: string;
  encrypted_password: string;
}

export type LoginRequest = RegisterRequest;

export interface CreateProjectRequest {
  id?: string;
  name: string;
  color?: string;
  kind?: string;
  sort_order?: number;
  parent_id?: string | null;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: string | null;
  kind?: string;
  sort_order?: number;
  parent_id?: string | null;
}

export interface CreateTaskRequest {
  id?: string;
  title: string;
  description?: string | null;
  kind?: TaskKind;
  priority?: Priority;
  is_pinned?: boolean;
  due_date?: string | null;
  start_date?: string | null;
  project_id?: string | null;
  parent_id?: string | null;
  tags?: string[];
  is_favorite?: boolean;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  kind?: TaskKind;
  completed?: boolean;
  priority?: Priority;
  is_pinned?: boolean;
  due_date?: string | null;
  start_date?: string | null;
  project_id?: string | null;
  tags?: string[];
  is_favorite?: boolean;
}

export interface CreateTagRequest {
  id?: string;
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string | null;
}

// ---- 自定义过滤器 ----

export interface FilterCondition {
  project_id?: string | null;
  priority?: Priority | null;
  tag?: string | null;
  search?: string | null;
  is_pinned?: boolean;
  is_favorite?: boolean;
}

export interface CustomFilter {
  id: string;
  name: string;
  conditions: FilterCondition;
}

// ---- 响应体 ----

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PubkeyResponse {
  public_key: string;
}
