import type {
  ApiResponse,
  AuthResponse,
  ChangePasswordRequest,
  CreateProjectRequest,
  CreateTagRequest,
  CreateTaskRequest,
  LoginRequest,
  Project,
  PubkeyResponse,
  RegisterRequest,
  Tag,
  Task,
  UpdateProjectRequest,
  UpdateTagRequest,
  UpdateTaskRequest,
  User,
} from "../types";

// ============================================================
// API 客户端：fetch 封装 + 全部端点
// ============================================================

const BASE = import.meta.env.VITE_API_BASE || "/api";
export const API_BASE = BASE;

let _token: string | null = localStorage.getItem("token");

export function setApiToken(t: string | null) {
  _token = t;
}

export function getApiToken(): string | null {
  return _token;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_token) h["Authorization"] = `Bearer ${_token}`;
  return h;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });
  if (res.status === 204) return undefined as T;
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error ?? "请求失败");
  return json.data!;
}

// ---- Auth ----

export async function getPubkey(): Promise<PubkeyResponse> {
  return request<PubkeyResponse>("/auth/pubkey");
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProfile(body: { avatar?: string }): Promise<User> {
  return request<User>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function changePassword(
  body: ChangePasswordRequest,
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getServerSettings(): Promise<{
  registration_open: boolean;
}> {
  return request<{ registration_open: boolean }>("/settings");
}

export async function updateServerSettings(body: {
  registration_open: boolean;
}): Promise<{ registration_open: boolean }> {
  return request<{ registration_open: boolean }>("/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getPublicSettings(): Promise<{
  registration_open: boolean;
}> {
  return request<{ registration_open: boolean }>("/settings/public");
}

export async function getUserSettings(): Promise<{
  theme: string;
  primary_color: string;
  background_image: string | null;
  blur_amount: number;
}> {
  return request<{
    theme: string;
    primary_color: string;
    background_image: string | null;
    blur_amount: number;
  }>("/user");
}

export async function updateUserSettings(body: {
  theme: string;
  primary_color: string;
  background_image: string | null;
  blur_amount: number;
}): Promise<{
  theme: string;
  primary_color: string;
  background_image: string | null;
  blur_amount: number;
}> {
  return request<{
    theme: string;
    primary_color: string;
    background_image: string | null;
    blur_amount: number;
  }>("/user", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ---- Projects ----

export async function getProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(
  body: CreateProjectRequest,
): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProject(
  id: string,
  body: UpdateProjectRequest,
): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export async function reorderProjects(
  items: { id: string; sort_order: number }[],
): Promise<void> {
  return request<void>("/projects/reorder", {
    method: "PATCH",
    body: JSON.stringify(items),
  });
}

// ---- Tasks ----

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>("/tasks");
}

export async function getTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(body: CreateTaskRequest): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTask(
  id: string,
  body: UpdateTaskRequest,
): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE" });
}

// ---- Tags ----

export async function getTags(): Promise<Tag[]> {
  return request<Tag[]>("/tags");
}

export async function createTag(body: CreateTagRequest): Promise<Tag> {
  return request<Tag>("/tags", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTag(
  id: string,
  body: UpdateTagRequest,
): Promise<Tag> {
  return request<Tag>(`/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTag(id: string): Promise<void> {
  return request<void>(`/tags/${id}`, { method: "DELETE" });
}
