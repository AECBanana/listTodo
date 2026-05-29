import { createSignal, For, Show } from "solid-js";
import * as api from "../api/client";
import { store, type ProjectNode } from "../store";
import type { CustomFilter, Priority, Tag } from "../types";
import {
  ListTodo,
  Calendar,
  Grid3x3,
  Settings,
  Sun,
  Moon,
  Inbox,
  CalendarDays,
  Pin,
  Star,
  CheckCircle2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Filter,
  User,
  LogOut,
  MoreHorizontal,
  Pencil,
  FolderPlus,
  Palette,
  GripVertical,
  ClipboardList,
  NotebookPen,
  Hash,
  RefreshCw,
  PanelLeft,
  Info,
  Server,
  BrainCircuit,
  Sparkles,
} from "lucide-solid";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

// ============================================================
// 侧边栏 = 窄导航列 + 子导航列
// ============================================================

// ---- 导航列 ----
const NAV_ITEMS = [
  { id: "tasks", icon: ListTodo, label: "任务" },
  { id: "calendar", icon: Calendar, label: "日历" },
  { id: "matrix", icon: Grid3x3, label: "四象限" },
  { id: "ai", icon: Sparkles, label: "AI" },
] as const;

export default function Sidebar() {
  const [syncing, setSyncing] = createSignal(false);
  const [subNavOpen, setSubNavOpen] = createSignal(false);

  function toggleTheme() {
    const t = store.theme() === "dark" ? "light" : "dark";
    store.setTheme(t);
    api
      .updateUserSettings({
        theme: t,
        primary_color: store.primaryColor(),
        background_image: store.bgImage() || null,
        blur_amount: store.blurAmount(),
      })
      .catch(() => {});
  }

  return (
    <>
      {/* 列1：主导航 */}
      <nav class="nav-col">
        <div class="nav-col-top">
          <button
            class="nav-col-btn sub-nav-toggle"
            onClick={() => setSubNavOpen(!subNavOpen())}
            title="侧栏"
          >
            <PanelLeft size={20} strokeWidth={subNavOpen() ? 2 : 1.5} />
          </button>
          <For each={NAV_ITEMS}>
            {(item) => (
              <button
                class="nav-col-btn"
                classList={{ active: store.section() === item.id }}
                onClick={() => store.setSection(item.id as any)}
                title={item.label}
              >
                <item.icon
                  size={20}
                  strokeWidth={store.section() === item.id ? 2 : 1.5}
                />
              </button>
            )}
          </For>
        </div>
        <div class="nav-col-bottom">
          <button
            class="nav-col-btn"
            title={store.theme() === "dark" ? "切换亮色" : "切换暗色"}
            onClick={toggleTheme}
          >
            {store.theme() === "dark" ? (
              <Sun size={20} strokeWidth={1.5} />
            ) : (
              <Moon size={20} strokeWidth={1.5} />
            )}
          </button>
          <button
            class="nav-col-btn"
            onClick={() => {
              setSyncing(true);
              store.syncNow().finally(() => setSyncing(false));
            }}
            title="同步数据"
          >
            <RefreshCw
              size={20}
              strokeWidth={1.5}
              classList={{ "animate-spin": syncing() }}
            />
          </button>
          <button
            class="nav-col-btn"
            classList={{ active: store.section() === "settings" }}
            onClick={() => store.setSection("settings")}
            title="设置"
          >
            <Settings
              size={20}
              strokeWidth={store.section() === "settings" ? 2 : 1.5}
            />
          </button>
          <div class="nav-avatar" title={store.user()?.username}>
            <Show
              when={store.user()?.avatar}
              fallback={<User size={18} strokeWidth={1.5} />}
            >
              <img class="nav-avatar-img" src={store.user()!.avatar!} alt="" />
            </Show>
          </div>
        </div>
      </nav>

      {/* 列2：子导航 */}
      <Show when={store.section() === "tasks"}>
        <SubNav open={subNavOpen()} onClose={() => setSubNavOpen(false)} />
      </Show>

      <Show when={store.section() === "settings"}>
        <SettingsSubNav
          open={subNavOpen()}
          onClose={() => setSubNavOpen(false)}
        />
      </Show>
    </>
  );
}

// ============================================================
// 设置子导航
// ============================================================
function SettingsSubNav(props: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        class="sub-nav-backdrop"
        classList={{ show: props.open }}
        onClick={props.onClose}
      />
      <aside class="sub-nav" classList={{ open: props.open }}>
        <div class="settings-user-area">
          <SettingsAvatar />
        </div>
        <div class="sub-nav-scroll">
          <div class="sn-section">
            <div class="sn-label">设置</div>
            <button
              class="sn-item"
              classList={{ active: store.settingsTab() === "account" }}
              onClick={() => store.setSettingsTab("account")}
            >
              <User size={15} strokeWidth={1.5} />
              账号
            </button>
            <button
              class="sn-item"
              classList={{ active: store.settingsTab() === "theme" }}
              onClick={() => store.setSettingsTab("theme")}
            >
              <Palette size={15} strokeWidth={1.5} />
              主题
            </button>
            <button
              class="sn-item"
              classList={{ active: store.settingsTab() === "ai" }}
              onClick={() => store.setSettingsTab("ai")}
            >
              <BrainCircuit size={15} strokeWidth={1.5} />
              AI 助手
            </button>
            <button
              class="sn-item"
              classList={{ active: store.settingsTab() === "about" }}
              onClick={() => store.setSettingsTab("about")}
            >
              <Info size={15} strokeWidth={1.5} />
              关于
            </button>
            <Show when={store.user()?.role === "admin"}>
              <button
                class="sn-item"
                classList={{ active: store.settingsTab() === "server" }}
                onClick={() => store.setSettingsTab("server")}
              >
                <Server size={15} strokeWidth={1.5} />
                服务器设置
              </button>
            </Show>
          </div>
          <div class="sn-section sn-bottom">
            <button class="sn-item danger-item" onClick={store.doLogout}>
              <LogOut size={15} strokeWidth={1.5} />
              退出登录
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SettingsAvatar() {
  const user = store.user();
  const initial = () => (user?.username || "?")[0].toUpperCase();
  return (
    <>
      {user?.avatar ? (
        <img class="settings-avatar-img" src={user.avatar} alt="" />
      ) : (
        <div
          class="settings-avatar"
          style={{
            background: "var(--primary-light)",
            color: "var(--primary)",
          }}
        >
          {initial()}
        </div>
      )}
      <div class="settings-user-detail">
        <strong>{user?.username}</strong>
        <span
          class="role-badge"
          classList={{
            admin: user?.role === "admin",
            vip: user?.role === "vip",
          }}
        >
          {ROLE_LABELS[user?.role || "normal"] || "普通用户"}
        </span>
      </div>
    </>
  );
}

// ============================================================
// 子导航：任务视图
// ============================================================
function SubNav(props: { open: boolean; onClose: () => void }) {
  const [adding, setAdding] = createSignal(false);
  const [newName, setNewName] = createSignal("");

  async function handleCreateProject() {
    const name = newName().trim();
    if (!name) return;
    try {
      await store.createProject({ name });
      setNewName("");
      setAdding(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <>
      <div
        class="sub-nav-backdrop"
        classList={{ show: props.open }}
        onClick={props.onClose}
      />
      <aside class="sub-nav" classList={{ open: props.open }}>
        <div class="sub-nav-scroll">
          {/* 智能清单 */}
          <div class="sn-section">
            <div class="sn-label">智能清单</div>
            <SubNavItem
              icon={Inbox}
              label="全部"
              view="all"
              count={
                store.tasks()?.filter((t) => !t.completed && !t.parent_id)
                  .length ?? 0
              }
            />
            <SubNavItem
              icon={Inbox}
              label="收集箱"
              view="inbox"
              count={store.taskCounts().inbox}
            />
            <SubNavItem
              icon={CalendarDays}
              label="今天"
              view="today"
              count={store.taskCounts().today}
            />
            <SubNavItem icon={CalendarDays} label="最近7天" view="next7" />
            <SubNavItem
              icon={Pin}
              label="已置顶"
              view="pinned"
              count={store.taskCounts().pinned}
            />
            <SubNavItem
              icon={Star}
              label="收藏"
              view="favorites"
              count={store.taskCounts().favorites}
            />
          </div>

          {/* 清单 */}
          <div class="sn-section">
            <div class="sn-label">
              <ClipboardList size={13} strokeWidth={1.5} />
              <span>清单</span>
              <button
                class="icon-btn"
                title="新建清单"
                onClick={() => setAdding(!adding())}
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
            <Show when={adding()}>
              <div class="sn-add-form">
                <input
                  type="text"
                  placeholder="清单名称"
                  value={newName()}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                />
              </div>
            </Show>
            <ul class="project-tree">
              <For each={store.projectTree()}>
                {(node) => <ProjectTreeItem node={node} depth={0} />}
              </For>
            </ul>
          </div>

          {/* 标签 */}
          <div class="sn-section">
            <div class="sn-label">
              <Hash size={13} strokeWidth={1.5} />
              <span>标签</span>
              <button class="icon-btn" title="新建标签" onClick={handleAddTag}>
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
            <For each={store.tags()}>{(tag) => <TagItem tag={tag} />}</For>
          </div>

          {/* 过滤器 */}
          <div class="sn-section">
            <div class="sn-label">
              <Filter size={12} strokeWidth={1.5} />
              <span>过滤器</span>
              <button
                class="icon-btn"
                title="新建过滤器"
                onClick={handleAddFilter}
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
            <For each={store.filters()}>
              {(filter) => (
                <button
                  class="sn-item"
                  classList={{
                    active:
                      store.taskView() === "filter" &&
                      store.activeFilterId() === filter.id,
                  }}
                  onClick={() => {
                    store.setActiveFilterId(filter.id);
                    store.navigateTo("filter");
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setFilterCtx({
                      id: filter.id,
                      x: e.clientX + "px",
                      y: e.clientY + "px",
                    });
                  }}
                >
                  <Filter size={14} strokeWidth={1.5} />
                  {filter.name}
                </button>
              )}
            </For>

            {/* 过滤器右键菜单 */}
            <Show when={filterCtx()}>
              <div class="ctx-backdrop" onClick={() => setFilterCtx(null)} />
              <div
                class="ctx-menu"
                style={{ top: filterCtx()!.y, left: filterCtx()!.x }}
              >
                <button
                  class="ctx-item"
                  onClick={() => {
                    const fid = filterCtx()!.id;
                    setFilterCtx(null);
                    setEditingFilter(fid);
                    setFilterOpen(true);
                  }}
                >
                  <Pencil size={13} strokeWidth={2} />
                  编辑
                </button>
                <button
                  class="ctx-item danger"
                  onClick={() => {
                    store.removeFilter(filterCtx()!.id);
                    setFilterCtx(null);
                  }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                  删除
                </button>
              </div>
            </Show>
          </div>

          {/* 底部 */}
          <div class="sn-section sn-bottom">
            <SubNavItem
              icon={CheckCircle2}
              label="已完成"
              view="completed"
              count={store.taskCounts().completed}
            />
          </div>
        </div>

        {/* 过滤器编辑对话框 */}
        <Show when={filterOpen()}>
          <FilterDialogModal
            filterId={editingFilter()}
            onClose={() => setFilterOpen(false)}
          />
        </Show>
      </aside>
    </>
  );
}

// ============================================================
// 子导航：通用点击项
// ============================================================
function SubNavItem(props: {
  icon: any;
  label: string;
  view: string;
  tagName?: string;
  dotColor?: string;
  count?: number;
  noCount?: boolean;
}) {
  const isActive = () => {
    if (props.tagName)
      return (
        store.taskView() === "tag" && store.selectedTag() === props.tagName
      );
    return store.taskView() === props.view;
  };

  return (
    <button
      class="sn-item"
      classList={{ active: isActive() }}
      onClick={() => {
        if (props.tagName) {
          store.navigateTo("tag", null, props.tagName);
        } else {
          store.navigateTo(props.view as any, null, null);
        }
      }}
    >
      {props.dotColor ? (
        <span class="color-dot" style={{ background: props.dotColor }} />
      ) : (
        <props.icon size={15} strokeWidth={isActive() ? 2 : 1.5} />
      )}
      {props.label}
      {!props.noCount && props.count !== undefined && props.count > 0 && (
        <span class="sn-count">{props.count}</span>
      )}
    </button>
  );
}

// ============================================================
// 清单树节点（支持右键菜单 + 拖拽排序）
// ============================================================

const [dragId, setDragId] = createSignal<string | null>(null);
const [dragOverId, setDragOverId] = createSignal<string | null>(null);

async function handleDrop(
  targetNode: ProjectNode,
  position: "before" | "after" | "inside",
) {
  const draggedId = dragId();
  if (!draggedId || draggedId === targetNode.id) return;
  setDragId(null);
  setDragOverId(null);

  const all = store.projects() ?? [];
  const dragged = all.find((p) => p.id === draggedId);
  if (!dragged) return;

  const siblings = all
    .filter((p) => p.parent_id === targetNode.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const targetIdx = siblings.findIndex((p) => p.id === targetNode.id);

  if (position === "inside") {
    const children = all.filter((p) => p.parent_id === targetNode.id);
    const maxOrder = children.reduce((m, p) => Math.max(m, p.sort_order), -1);
    await store.updateProject(draggedId, {
      parent_id: targetNode.id,
      sort_order: maxOrder + 1,
    });
  } else {
    let newOrder = 0;
    const updates: { id: string; sort_order: number }[] = [];
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].id === draggedId) continue;
      if (position === "before" && i === targetIdx) {
        updates.push({ id: draggedId, sort_order: newOrder++ });
        updates.push({ id: siblings[i].id, sort_order: newOrder++ });
      } else if (position === "after" && i === targetIdx) {
        updates.push({ id: siblings[i].id, sort_order: newOrder++ });
        updates.push({ id: draggedId, sort_order: newOrder++ });
      } else {
        updates.push({ id: siblings[i].id, sort_order: newOrder++ });
      }
    }
    if (
      position === "after" &&
      targetIdx === siblings.length - 1 &&
      siblings[targetIdx]?.id !== draggedId
    ) {
      updates.push({ id: draggedId, sort_order: newOrder });
    }
    // 批量更新本地 + 远端
    for (const u of updates) {
      await store.updateProject(u.id, { sort_order: u.sort_order });
    }
  }
}

function ProjectTreeItem(props: { node: ProjectNode; depth: number }) {
  const nodeId = props.node.id;
  const nodeKind = props.node.kind;
  const [expanded, setExpanded] = createSignal(true);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuX, setMenuX] = createSignal("0px");
  const [menuY, setMenuY] = createSignal("0px");
  const [menuUp, setMenuUp] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editName, setEditName] = createSignal(props.node.name);

  const hasChildren = () => props.node.children.length > 0;
  const isSelected = () =>
    store.taskView() === "project" &&
    store.selectedProjectId() === props.node.id;

  function openMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuX(e.clientX + "px");
    setMenuY(e.clientY + "px");
    setMenuUp(e.clientY > window.innerHeight / 2);
    setMenuOpen(true);
  }

  async function handleRename() {
    const name = editName().trim();
    if (!name || name === props.node.name) {
      setEditing(false);
      return;
    }
    try {
      await store.updateProject(props.node.id, { name });
    } catch (err: any) {
      alert(err.message);
    }
    setEditing(false);
  }

  async function handleAddChild() {
    setMenuOpen(false);
    const name = prompt("子清单名称：");
    if (!name?.trim()) return;
    try {
      await store.createProject({
        name: name.trim(),
        parent_id: props.node.id,
      });
      setExpanded(true);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function changeColor(color: string) {
    setMenuOpen(false);
    try {
      await store.updateProject(nodeId, { color });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleKind() {
    setMenuOpen(false);
    const newKind = nodeKind === "note" ? "project" : "note";
    try {
      await store.updateProject(nodeId, { kind: newKind });
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <li>
      <div
        class="project-row"
        classList={{
          selected: isSelected(),
          "drag-over": dragOverId() === props.node.id,
          dragging: dragId() === props.node.id,
        }}
        style={{ "padding-left": `${8 + props.depth * 16}px` }}
        onClick={() => store.navigateTo("project", props.node.id, null)}
        onContextMenu={openMenu}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer!.effectAllowed = "move";
          setDragId(props.node.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = "move";
          setDragOverId(props.node.id);
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          const pos = e.clientY < mid ? "before" : "after";
          handleDrop(props.node, pos);
        }}
      >
        <span class="grip-handle">
          <GripVertical size={11} strokeWidth={1.5} />
        </span>
        {hasChildren() ? (
          <button
            class="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded());
            }}
          >
            {expanded() ? (
              <ChevronDown size={11} strokeWidth={2.5} />
            ) : (
              <ChevronRight size={11} strokeWidth={2.5} />
            )}
          </button>
        ) : (
          <span class="tree-indent" />
        )}
        {props.node.kind === "note" ? (
          <NotebookPen size={14} strokeWidth={2} color={props.node.color} />
        ) : (
          <ClipboardList size={14} strokeWidth={2} color={props.node.color} />
        )}

        <Show
          when={editing()}
          fallback={<span class="project-name">{props.node.name}</span>}
        >
          <input
            class="project-edit-input"
            type="text"
            value={editName()}
            onInput={(e) => setEditName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={handleRename}
            ref={(el) => el?.focus()}
            onClick={(e) => e.stopPropagation()}
          />
        </Show>

        <button
          class="icon-btn project-menu-btn"
          title="更多操作"
          onClick={openMenu}
        >
          <MoreHorizontal size={13} strokeWidth={2} />
        </button>
      </div>

      <Show when={menuOpen()}>
        <div class="ctx-backdrop" onClick={() => setMenuOpen(false)} />
        <div
          class="ctx-menu"
          classList={{ "ctx-menu-up": menuUp() }}
          style={{ top: menuY(), left: menuX() }}
        >
          <button
            class="ctx-item"
            onClick={() => {
              setMenuOpen(false);
              setEditName(props.node.name);
              setEditing(true);
            }}
          >
            <Pencil size={13} strokeWidth={2} />
            编辑
          </button>
          <button class="ctx-item" onClick={handleAddChild}>
            <FolderPlus size={13} strokeWidth={2} />
            添加子清单
          </button>
          <div class="ctx-divider" />
          <button class="ctx-item" onClick={toggleKind}>
            <NotebookPen size={13} strokeWidth={2} />
            {props.node.kind === "note" ? "转为任务清单" : "转为笔记清单"}
          </button>
          <div class="ctx-divider" />
          <div class="ctx-item ctx-color-label">
            <Palette size={13} strokeWidth={2} />
            颜色
          </div>
          <div class="ctx-colors">
            <For each={PRESET_COLORS}>
              {(color) => (
                <button
                  class="ctx-color-dot"
                  classList={{ active: props.node.color === color }}
                  style={{ background: color }}
                  onClick={() => changeColor(color)}
                />
              )}
            </For>
          </div>
          <div class="ctx-divider" />
          <button
            class="ctx-item danger"
            onClick={() => {
              setMenuOpen(false);
              handleDelete(props.node.id, props.node.name);
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            删除
          </button>
        </div>
      </Show>

      <Show when={expanded() && hasChildren()}>
        <ul>
          <For each={props.node.children}>
            {(child) => (
              <ProjectTreeItem node={child} depth={props.depth + 1} />
            )}
          </For>
        </ul>
      </Show>
    </li>
  );
}

// ============================================================
// 标签右键菜单
// ============================================================
function TagItem(props: { tag: Tag }) {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuX, setMenuX] = createSignal("0px");
  const [menuY, setMenuY] = createSignal("0px");
  const [menuUp, setMenuUp] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editName, setEditName] = createSignal(props.tag.name);

  const isActive = () =>
    store.taskView() === "tag" && store.selectedTag() === props.tag.name;

  function openMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuX(e.clientX + "px");
    setMenuY(e.clientY + "px");
    setMenuUp(e.clientY > window.innerHeight / 2);
    setMenuOpen(true);
  }

  async function handleRename() {
    const name = editName().trim();
    if (!name || name === props.tag.name) {
      setEditing(false);
      return;
    }
    try {
      await api.updateTag(props.tag.id, { name });
      store.reloadFromDB();
    } catch (err: any) {
      alert(err.message);
    }
    setEditing(false);
  }

  async function changeColor(color: string) {
    setMenuOpen(false);
    try {
      await api.updateTag(props.tag.id, { color });
      store.reloadFromDB();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <>
      {editing() ? (
        <div class="sn-item">
          <Hash size={14} strokeWidth={2} color={props.tag.color} />
          <input
            class="tag-edit-input"
            type="text"
            value={editName()}
            onInput={(e) => setEditName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={handleRename}
            ref={(el) => el?.focus()}
          />
        </div>
      ) : (
        <div
          class="sn-item"
          classList={{ active: isActive() }}
          onClick={() => store.navigateTo("tag", null, props.tag.name)}
          onContextMenu={openMenu}
        >
          <Hash size={14} strokeWidth={2} color={props.tag.color} />
          <span class="sn-item-text">{props.tag.name}</span>
          <button class="icon-btn tag-menu-btn" onClick={openMenu}>
            <MoreHorizontal size={12} strokeWidth={2} />
          </button>
        </div>
      )}

      <Show when={menuOpen()}>
        <div class="ctx-backdrop" onClick={() => setMenuOpen(false)} />
        <div
          class="ctx-menu"
          classList={{ "ctx-menu-up": menuUp() }}
          style={{ top: menuY(), left: menuX() }}
        >
          <button
            class="ctx-item"
            onClick={() => {
              setMenuOpen(false);
              setEditName(props.tag.name);
              setEditing(true);
            }}
          >
            <Pencil size={13} strokeWidth={2} />
            编辑
          </button>
          <div class="ctx-divider" />
          <div class="ctx-item ctx-color-label">
            <Palette size={13} strokeWidth={2} />
            颜色
          </div>
          <div class="ctx-colors">
            <For each={PRESET_COLORS}>
              {(color) => (
                <button
                  class="ctx-color-dot"
                  classList={{ active: props.tag.color === color }}
                  style={{ background: color }}
                  onClick={() => changeColor(color)}
                />
              )}
            </For>
          </div>
          <div class="ctx-divider" />
          <button
            class="ctx-item danger"
            onClick={() => {
              setMenuOpen(false);
              store.removeTag(props.tag.id);
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            删除
          </button>
        </div>
      </Show>
    </>
  );
}

async function handleDelete(id: string, name: string) {
  if (!confirm(`删除清单「${name}」？`)) return;
  await store.removeProject(id);
  if (store.selectedProjectId() === id) store.navigateTo("inbox");
}

async function handleAddTag() {
  const name = prompt("标签名称：");
  if (!name?.trim()) return;
  try {
    await store.createTag({ name: name.trim() });
  } catch (err: any) {
    alert(err.message);
  }
}

function handleAddFilter() {
  setEditingFilter(null);
  setFilterOpen(true);
}

const [filterOpen, setFilterOpen] = createSignal(false);
const [editingFilter, setEditingFilter] = createSignal<string | null>(null);

const [filterCtx, setFilterCtx] = createSignal<{
  id: string;
  x: string;
  y: string;
} | null>(null);

// ============================================================
// 设置面板
// ============================================================
const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  normal: "普通用户",
  vip: "VIP 用户",
};

// ============================================================
// 过滤器编辑对话框
// ============================================================
function FilterDialogModal(props: {
  filterId: string | null;
  onClose: () => void;
}) {
  const existing = () =>
    props.filterId
      ? store.filters().find((f) => f.id === props.filterId)
      : null;
  const [name, setName] = createSignal(existing()?.name ?? "");
  const [projectId, setProjectId] = createSignal(
    existing()?.conditions.project_id ?? "",
  );
  const [priority, setPriority] = createSignal(
    existing()?.conditions.priority ?? "",
  );
  const [tag, setTag] = createSignal(existing()?.conditions.tag ?? "");
  const [search, setSearch] = createSignal(existing()?.conditions.search ?? "");

  function handleSave() {
    const n = name().trim();
    if (!n) return;
    if (props.filterId) {
      store.updateFilter(props.filterId, {
        name: n,
        conditions: {
          project_id: projectId() || undefined,
          priority: (priority() || undefined) as Priority,
          tag: tag() || undefined,
          search: search() || undefined,
        },
      });
    } else {
      const id = store.addFilter(n);
      store.updateFilter(id, {
        conditions: {
          project_id: projectId() || undefined,
          priority: (priority() || undefined) as Priority,
          tag: tag() || undefined,
          search: search() || undefined,
        },
      });
    }
    props.onClose();
  }

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="modal" style={{ "max-width": "420px" }}>
        <h2>{props.filterId ? "编辑过滤器" : "新建过滤器"}</h2>
        <div class="form-group">
          <label>名称</label>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autofocus
          />
        </div>
        <div class="form-group">
          <label>清单</label>
          <select
            value={projectId()}
            onChange={(e) => setProjectId(e.currentTarget.value)}
          >
            <option value="">全部</option>
            {store.projects()?.map((p) => (
              <option value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div class="form-group">
          <label>优先级</label>
          <select
            value={priority()}
            onChange={(e) => setPriority(e.currentTarget.value)}
          >
            <option value="">全部</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
            <option value="none">无</option>
          </select>
        </div>
        <div class="form-group">
          <label>标签</label>
          <select value={tag()} onChange={(e) => setTag(e.currentTarget.value)}>
            <option value="">全部</option>
            {store.tags()?.map((t) => (
              <option value={t.name}>#{t.name}</option>
            ))}
          </select>
        </div>
        <div class="form-group">
          <label>搜索关键词</label>
          <input
            type="text"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            placeholder="搜索标题和描述..."
          />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onClick={props.onClose}>
            取消
          </button>
          <button class="btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
