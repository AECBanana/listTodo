import {
  createRoot,
  createSignal,
  createEffect,
  createMemo,
  on,
} from "solid-js";
import { setApiToken, getApiToken, getUserSettings } from "./api/client";
import { getLocalDB } from "./db";
import { syncEngine } from "./sync";
import type {
  Project,
  Task,
  Tag,
  User,
  CreateProjectRequest,
  CreateTagRequest,
  CreateTaskRequest,
  UpdateProjectRequest,
  UpdateTagRequest,
  UpdateTaskRequest,
  CustomFilter,
} from "./types";

// ============================================================
// 全局状态
// ============================================================

export type ProjectNode = Project & { children: ProjectNode[] };
export type TaskNode = Task & { children: TaskNode[] };

const store = createRoot(() => {
  // ---- Auth ----
  const [user, setUser] = createSignal<User | null>(
    JSON.parse(localStorage.getItem("user") || "null"),
  );
  const [token, setToken] = createSignal<string | null>(
    localStorage.getItem("token"),
  );

  createEffect(() => {
    const t = token();
    setApiToken(t);
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  });

  createEffect(() => {
    const u = user();
    if (u) localStorage.setItem("user", JSON.stringify(u));
    else localStorage.removeItem("user");
  });

  // ---- 本地数据信号（替代 createResource） ----
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [tags, setTags] = createSignal<Tag[]>([]);

  const [dataReady, setDataReady] = createSignal(false);

  // 登录后：同步远端 → 从本地 DB 加载
  createEffect(
    on(token, async (t) => {
      if (!t) {
        setProjects([]);
        setTasks([]);
        setTags([]);
        setDataReady(false);
        return;
      }
      try {
        // 先从本地 DB 加载已有数据（瞬时）
        const db = await getLocalDB();
        const localP = await db.getAllProjects();
        const localT = await db.getAllTasks();
        const localG = await db.getAllTags();
        setProjects(localP);
        setTasks(localT);
        setTags(localG);
        setDataReady(true);

        await syncEngine.pull();
        const afterP = await db.getAllProjects();
        const afterT = await db.getAllTasks();
        const afterG = await db.getAllTags();
        setProjects(afterP);
        setTasks(afterT);
        setTags(afterG);
      } catch (e) {
        console.error("同步数据失败:", e);
      }

      // 无论同步是否成功，都尝试加载主题设置
      try {
        await loadTheme();
      } catch {
        /* 离线时使用默认主题 */
      }
      setDataReady(true);
    }),
  );

  /** 重新从本地 DB 加载所有数据到信号 */
  async function reloadFromDB(entity?: "project" | "task" | "tag") {
    const db = await getLocalDB();
    if (!entity || entity === "project") setProjects(await db.getAllProjects());
    if (!entity || entity === "task") setTasks(await db.getAllTasks());
    if (!entity || entity === "tag") setTags(await db.getAllTags());
  }

  // ---- Mutations（本地优先 + 远端推送） ----

  async function saveProjectToLocal(project: Project) {
    const db = await getLocalDB();
    await db.saveProject(project);
    await reloadFromDB("project");
  }

  async function deleteProjectFromLocal(id: string) {
    const db = await getLocalDB();
    await db.deleteProject(id);
    await reloadFromDB("project");
  }

  async function saveTaskToLocal(task: Task) {
    const db = await getLocalDB();
    await db.saveTask(task);
    await reloadFromDB("task");
  }

  async function deleteTaskFromLocal(id: string) {
    const db = await getLocalDB();
    await db.deleteTask(id);
    await reloadFromDB("task");
  }

  async function saveTagToLocal(tag: Tag) {
    const db = await getLocalDB();
    await db.saveTag(tag);
    await reloadFromDB("tag");
  }

  async function deleteTagFromLocal(id: string) {
    const db = await getLocalDB();
    await db.deleteTag(id);
    await reloadFromDB("tag");
  }

  // ---- UI State ----
  type Section = "tasks" | "calendar" | "matrix" | "settings" | "ai";
  const [section, setSection] = createSignal<Section>(
    (localStorage.getItem("section") as Section) || "tasks",
  );

  type SettingsTab = "account" | "about" | "server" | "theme" | "ai";
  const [settingsTab, setSettingsTab] = createSignal<SettingsTab>("account");

  // ---- 主题 ----
  const [theme, setTheme] = createSignal<string>("light");
  const [primaryColor, setPrimaryColor] = createSignal<string>("#4772fa");
  const [bgImage, setBgImage] = createSignal<string>("");
  const [blurAmount, setBlurAmount] = createSignal<number>(20);

  createEffect(() => {
    document.documentElement.setAttribute("data-theme", theme());
    document.documentElement.style.setProperty("--primary", primaryColor());
    document.documentElement.style.setProperty(
      "--primary-light",
      primaryColor() + "18",
    );
    document.documentElement.style.setProperty(
      "--bg-blur",
      `${blurAmount()}px`,
    );

    const url = bgImage();
    if (url) {
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.classList.add("has-bg");
    } else {
      document.body.style.backgroundImage = "";
      document.body.classList.remove("has-bg");
    }
  });

  async function loadTheme() {
    try {
      const s = await getUserSettings();
      setTheme(s.theme);
      setPrimaryColor(s.primary_color);
      setBgImage(s.background_image || "");
      setBlurAmount(s.blur_amount ?? 20);
    } catch {
      /* offline */
    }
  }

  type TaskView =
    | "all"
    | "inbox"
    | "today"
    | "next7"
    | "pinned"
    | "favorites"
    | "completed"
    | "trash"
    | "project"
    | "tag"
    | "filter";
  const [taskView, setTaskView] = createSignal<TaskView>(
    (localStorage.getItem("taskView") as TaskView) ||
      (localStorage.getItem("selectedProjectId") ? "project" : undefined) ||
      (localStorage.getItem("selectedTag") ? "tag" : undefined) ||
      "all",
  );

  type SortMode = "manual" | "priority" | "date" | "alpha";
  const [sortMode, setSortMode] = createSignal<SortMode>(
    (localStorage.getItem("sortMode") as SortMode) || "date",
  );

  type GroupMode = "none" | "project" | "priority" | "date";
  const [groupMode, setGroupMode] = createSignal<GroupMode>(
    (localStorage.getItem("groupMode") as GroupMode) || "project",
  );

  createEffect(on(taskView, (v) => localStorage.setItem("taskView", v)));
  createEffect(on(sortMode, (v) => localStorage.setItem("sortMode", v)));
  createEffect(on(groupMode, (v) => localStorage.setItem("groupMode", v)));
  createEffect(on(section, (v) => localStorage.setItem("section", v)));

  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(
    localStorage.getItem("selectedProjectId") || null,
  );
  const [selectedTag, setSelectedTag] = createSignal<string | null>(
    localStorage.getItem("selectedTag") || null,
  );

  // ---- 自定义过滤器 ----
  const [filters, setFilters] = createSignal<CustomFilter[]>(
    JSON.parse(localStorage.getItem("customFilters") || "[]"),
  );
  const [activeFilterId, setActiveFilterId] = createSignal<string | null>(null);

  createEffect(() => {
    localStorage.setItem("customFilters", JSON.stringify(filters()));
  });

  function addFilter(name: string) {
    const id = crypto.randomUUID();
    setFilters([...filters(), { id, name, conditions: {} }]);
    return id;
  }

  function updateFilter(id: string, data: Partial<CustomFilter>) {
    setFilters(filters().map((f) => (f.id === id ? { ...f, ...data } : f)));
  }

  function removeFilter(id: string) {
    setFilters(filters().filter((f) => f.id !== id));
    if (activeFilterId() === id) setActiveFilterId(null);
  }

  createEffect(
    on(selectedProjectId, (v) =>
      localStorage.setItem("selectedProjectId", v ?? ""),
    ),
  );
  createEffect(
    on(selectedTag, (v) => localStorage.setItem("selectedTag", v ?? "")),
  );

  // ---- 清单树 ----
  const projectTree = createMemo(() => {
    const list = projects() ?? [];
    const map = new Map<string, ProjectNode>();
    const roots: ProjectNode[] = [];
    for (const p of list) map.set(p.id, { ...p, children: [] });
    for (const p of list) {
      const node = map.get(p.id)!;
      if (p.parent_id && map.has(p.parent_id))
        map.get(p.parent_id)!.children.push(node);
      else roots.push(node);
    }
    const sortNodes = (nodes: ProjectNode[]) => {
      nodes.sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      );
      for (const n of nodes) sortNodes(n.children);
    };
    sortNodes(roots);
    return roots;
  });

  function collectChildIds(
    parentId: string,
    nodes: ProjectNode[],
  ): Set<string> {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.id === parentId) {
        collectDescendants(n, ids);
        return ids;
      }
      const found = collectChildIds(parentId, n.children);
      if (found.size > 0) return found;
    }
    return ids;
  }

  function collectDescendants(node: ProjectNode, ids: Set<string>) {
    for (const child of node.children) {
      ids.add(child.id);
      collectDescendants(child, ids);
    }
  }

  // ---- Computed: 当前视图标题 ----
  const viewTitle = createMemo(() => {
    switch (taskView()) {
      case "all":
        return "全部";
      case "inbox":
        return "收集箱";
      case "today":
        return "今天";
      case "next7":
        return "最近7天";
      case "pinned":
        return "已置顶";
      case "favorites":
        return "收藏";
      case "completed":
        return "已完成";
      case "project": {
        const p = projects()?.find((p) => p.id === selectedProjectId());
        return p?.name ?? "清单";
      }
      case "tag": {
        const t = tags()?.find((t) => t.name === selectedTag());
        return `#${t?.name ?? selectedTag()}`;
      }
      case "filter": {
        const f = filters().find((f) => f.id === activeFilterId());
        return f?.name ?? "过滤器";
      }
      default:
        return "任务";
    }
  });

  // ---- Computed: 筛选后的任务 ----
  const filteredTasks = createMemo(() => {
    const all = tasks() ?? [];
    const view = taskView();
    const pid = selectedProjectId();
    const tag = selectedTag();

    let result = all.filter((t) => !t.parent_id);

    switch (view) {
      case "all":
        result = result.filter((t) => !t.completed);
        break;
      case "inbox":
        result = result.filter((t) => !t.completed && !t.project_id);
        break;
      case "today": {
        const today = new Date().toISOString().slice(0, 10);
        result = result.filter(
          (t) => t.due_date?.startsWith(today) && !t.completed,
        );
        break;
      }
      case "next7": {
        const today = new Date();
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        const ts = today.toISOString().slice(0, 10);
        const es = end.toISOString().slice(0, 10);
        result = result.filter(
          (t) =>
            t.due_date &&
            t.due_date.slice(0, 10) >= ts &&
            t.due_date.slice(0, 10) <= es &&
            !t.completed,
        );
        break;
      }
      case "pinned":
        result = result.filter((t) => t.is_pinned && !t.completed);
        break;
      case "favorites":
        result = result.filter((t) => t.is_favorite);
        break;
      case "completed":
        result = result.filter((t) => t.completed && t.kind !== "note");
        break;
      case "project":
        if (pid) {
          const childIds = collectChildIds(pid, projectTree());
          result = result.filter(
            (t) => t.project_id === pid || childIds.has(t.project_id!),
          );
        }
        break;
      case "tag":
        if (tag) result = result.filter((t) => t.tags.includes(tag));
        break;
      case "filter": {
        const fid = activeFilterId();
        const flt = filters().find((f) => f.id === fid);
        if (flt) {
          const c = flt.conditions;
          if (c.project_id)
            result = result.filter((t) => t.project_id === c.project_id);
          if (c.priority)
            result = result.filter((t) => t.priority === c.priority);
          if (c.tag) result = result.filter((t) => t.tags.includes(c.tag!));
          if (c.search) {
            const q = c.search.toLowerCase();
            result = result.filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q),
            );
          }
          if (c.is_pinned) result = result.filter((t) => t.is_pinned);
          if (c.is_favorite) result = result.filter((t) => t.is_favorite);
        }
        break;
      }
    }

    const sm = sortMode();
    result = [...result].sort((a, b) => {
      // 已完成始终排最下面
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (sm === "priority") {
        const order: Record<string, number> = {
          high: 0,
          medium: 1,
          low: 2,
          none: 3,
        };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      }
      if (sm === "date") {
        const da = a.due_date ?? "9999";
        const db = b.due_date ?? "9999";
        return da.localeCompare(db);
      }
      if (sm === "alpha") {
        return a.title.localeCompare(b.title);
      }
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return b.created_at.localeCompare(a.created_at);
    });
    return result;
  });

  // ---- Computed: 分组 ----
  interface TaskGroup {
    label: string;
    color?: string;
    tasks: Task[];
  }

  const groupedTasks = createMemo((): TaskGroup[] => {
    const list = filteredTasks();
    const gm = groupMode();
    if (gm === "none") return [{ label: "", tasks: list }];

    const groups = new Map<string, TaskGroup>();
    for (const t of list) {
      let key: string;
      switch (gm) {
        case "project":
          key = t.project_id
            ? (projects()?.find((p) => p.id === t.project_id)?.name ?? "无清单")
            : "无清单";
          break;
        case "priority": {
          const labels: Record<string, string> = {
            high: "高优先级",
            medium: "中优先级",
            low: "低优先级",
            none: "无优先级",
          };
          key = labels[t.priority] ?? "无优先级";
          break;
        }
        case "date": {
          if (!t.due_date) {
            key = "无日期";
            break;
          }
          const d = new Date(t.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tmr = new Date(today);
          tmr.setDate(tmr.getDate() + 1);
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          if (d < today) key = "已过期";
          else if (d.toDateString() === today.toDateString()) key = "今天";
          else if (d.toDateString() === tmr.toDateString()) key = "明天";
          else if (d < nextWeek) key = "本周";
          else key = "以后";
          break;
        }
        default:
          key = "";
      }
      if (!groups.has(key)) groups.set(key, { label: key, tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    return [...groups.values()];
  });

  // ---- 任务树 ----
  const taskTree = createMemo(() => {
    const all = tasks() ?? [];
    const map = new Map<string, TaskNode>();
    const roots: TaskNode[] = [];
    for (const t of all) map.set(t.id, { ...t, children: [] });
    for (const t of all) {
      const node = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  });

  const filteredTaskTree = createMemo(() => {
    const filtered = new Set(filteredTasks().map((t) => t.id));
    return pruneTree(taskTree(), filtered);
  });

  function pruneTree(nodes: TaskNode[], keep: Set<string>): TaskNode[] {
    const result: TaskNode[] = [];
    for (const n of nodes) {
      const children = pruneTree(n.children, keep);
      const shouldKeep = keep.has(n.id);
      if (shouldKeep || children.length > 0) {
        const allChildren = shouldKeep
          ? n.children.map((c) => ({
              ...c,
              children: pruneTree(c.children, keep),
            }))
          : children;
        result.push({ ...n, children: allChildren });
      }
    }
    return result;
  }

  // ---- 计数 ----
  const taskCounts = createMemo(() => {
    const all = tasks() ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      inbox: all.filter((t) => !t.completed && !t.project_id).length,
      today: all.filter((t) => t.due_date?.startsWith(today) && !t.completed)
        .length,
      completed: all.filter((t) => t.completed && t.kind !== "note").length,
      pinned: all.filter((t) => t.is_pinned && !t.completed).length,
      favorites: all.filter((t) => t.is_favorite).length,
    };
  });

  // ---- Actions ----
  async function doLogin(tokenVal: string, userVal: User) {
    setApiToken(tokenVal);
    localStorage.setItem("token", tokenVal);
    localStorage.setItem("user", JSON.stringify(userVal));
    setUser(userVal);
    setToken(tokenVal);
  }

  function doLogout() {
    setToken(null);
    setUser(null);
  }

  function navigateTo(
    view: TaskView,
    projectId?: string | null,
    tagName?: string | null,
  ) {
    setTaskView(view);
    setSelectedProjectId(projectId ?? null);
    setSelectedTag(tagName ?? null);
  }

  // 手动触发同步
  async function syncNow() {
    if (!token()) return;
    try {
      await syncEngine.pull();
      await reloadFromDB();
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }

  // ── 自动同步（防抖） ──
  let _syncTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleAutoSync() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      _syncTimer = null;
      if (!token()) return;
      try {
        await syncEngine.pull();
        await reloadFromDB();
      } catch {}
    }, 500);
  }

  // ── 组合 Actions（本地 DB + 远端推送） ──

  async function createProject(req: CreateProjectRequest) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project: Project = {
      id,
      ...req,
      created_at: now,
      updated_at: now,
    } as Project;
    await saveProjectToLocal(project);
    syncEngine.pushLocalChange("project", "create", project);
    scheduleAutoSync();
    return project;
  }

  async function updateProject(id: string, req: UpdateProjectRequest) {
    const db = await getLocalDB();
    const all = await db.getAllProjects();
    const existing = all.find((p) => p.id === id);
    if (!existing) return;
    const updated = {
      ...existing,
      ...req,
      updated_at: new Date().toISOString(),
    };
    await saveProjectToLocal(updated as Project);
    syncEngine.pushLocalChange("project", "update", { id, ...req });
    scheduleAutoSync();
    return updated;
  }

  async function removeProject(id: string) {
    await deleteProjectFromLocal(id);
    syncEngine.pushLocalChange("project", "delete", { id });
    scheduleAutoSync();
  }

  async function createTask(req: CreateTaskRequest) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const task: Task = {
      id,
      ...req,
      completed: false,
      completed_at: null,
      priority: req.priority || "none",
      kind: req.kind || "task",
      is_pinned: req.is_pinned || false,
      is_favorite: req.is_favorite || false,
      tags: req.tags || [],
      sort_order: 0,
      description: req.description || null,
      project_id: req.project_id || null,
      parent_id: req.parent_id || null,
      due_date: req.due_date || null,
      start_date: null,
      created_at: now,
      updated_at: now,
    } as Task;
    await saveTaskToLocal(task);
    syncEngine.pushLocalChange("task", "create", task);
    scheduleAutoSync();
    return task;
  }

  async function updateTask(id: string, req: UpdateTaskRequest) {
    const db = await getLocalDB();
    const all = await db.getAllTasks();
    const existing = all.find((t) => t.id === id);
    if (!existing) return;
    const updated = {
      ...existing,
      ...req,
      updated_at: new Date().toISOString(),
    };
    await saveTaskToLocal(updated as Task);
    syncEngine.pushLocalChange("task", "update", { id, ...req });
    scheduleAutoSync();
    return updated;
  }

  async function removeTask(id: string) {
    await deleteTaskFromLocal(id);
    syncEngine.pushLocalChange("task", "delete", { id });
    scheduleAutoSync();
  }

  async function createTag(req: CreateTagRequest) {
    const id = crypto.randomUUID();
    const tag: Tag = {
      id,
      name: req.name,
      color: req.color || "#808080",
    } as Tag;
    await saveTagToLocal(tag);
    syncEngine.pushLocalChange("tag", "create", tag);
    scheduleAutoSync();
    return tag;
  }

  async function removeTag(id: string) {
    await deleteTagFromLocal(id);
    syncEngine.pushLocalChange("tag", "delete", { id });
    scheduleAutoSync();
  }

  return {
    // state
    user,
    token,
    projects,
    projectTree,
    tasks,
    tags,
    dataReady,
    filters,
    activeFilterId,
    section,
    settingsTab,
    theme,
    primaryColor,
    bgImage,
    blurAmount,
    taskView,
    sortMode,
    groupMode,
    selectedProjectId,
    selectedTag,
    // computed
    viewTitle,
    filteredTasks,
    groupedTasks,
    filteredTaskTree,
    taskCounts,
    // actions
    doLogin,
    doLogout,
    setUser,
    setSection,
    setSettingsTab,
    setTheme,
    setPrimaryColor,
    setBgImage,
    setBlurAmount,
    loadTheme,
    setSortMode,
    setGroupMode,
    addFilter,
    updateFilter,
    removeFilter,
    setActiveFilterId,
    navigateTo,
    // 本地优先 actions
    saveProjectToLocal,
    deleteProjectFromLocal,
    saveTaskToLocal,
    deleteTaskFromLocal,
    saveTagToLocal,
    deleteTagFromLocal,
    reloadFromDB,
    // 同步
    syncNow,
    // 组合 actions（本地 DB + 远端）
    createProject,
    updateProject,
    removeProject,
    createTask,
    updateTask,
    removeTask,
    createTag,
    removeTag,
  };
});

export { store };
