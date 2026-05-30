import { createSignal, Show } from "solid-js";
import type { Priority, Task, TaskKind } from "../types";
import { store } from "../store";
import {
  CheckCircle2,
  Circle,
  Pin,
  Star,
  Trash2,
  StickyNote,
  Calendar,
  FileText,
  FlagTriangleRight,
  Repeat,
} from "lucide-solid";

const PRIORITY_ICON: Record<string, () => any> = {
  none: () => null,
  low: () => (
    <FlagTriangleRight size={18} strokeWidth={2.5} class="priority-low" />
  ),
  medium: () => (
    <FlagTriangleRight size={18} strokeWidth={2.5} class="priority-medium" />
  ),
  high: () => (
    <FlagTriangleRight size={18} strokeWidth={2.5} class="priority-high" />
  ),
};

function cdBadge(dueDate: string) {
  const now = new Date();
  const target = new Date(dueDate);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "过期", cls: "detail-cd-expired" };
  if (diffDays === 0) return { text: "今天", cls: "detail-cd-today" };
  if (diffDays <= 7) return { text: `${diffDays}天`, cls: "detail-cd-soon" };
  return null;
}

export default function TaskItem(props: {
  task: Task;
  onEdit: (t: Task) => void;
  isSelected?: boolean;
  depth?: number;
}) {
  const t = props.task;
  const [ctxOpen, setCtxOpen] = createSignal(false);
  const [ctxX, setCtxX] = createSignal("0px");
  const [ctxY, setCtxY] = createSignal("0px");
  const [ctxUp, setCtxUp] = createSignal(false);

  function openCtx(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxX(e.clientX + "px");
    setCtxY(e.clientY + "px");
    setCtxUp(e.clientY > window.innerHeight / 2);
    setCtxOpen(true);
  }

  async function setPriority(p: Priority) {
    setCtxOpen(false);
    try {
      await store.updateTask(t.id, { priority: p });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleKind() {
    setCtxOpen(false);
    const newKind: TaskKind = t.kind === "note" ? "task" : "note";
    try {
      await store.updateTask(t.id, { kind: newKind });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleComplete() {
    try {
      await store.updateTask(t.id, { completed: !t.completed });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function togglePin() {
    try {
      await store.updateTask(t.id, { is_pinned: !t.is_pinned });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleFavorite() {
    try {
      await store.updateTask(t.id, { is_favorite: !t.is_favorite });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除此任务？")) return;
    try {
      await store.removeTask(t.id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  const project = () => store.projects()?.find((p) => p.id === t.project_id);

  // 子任务进度
  const subtaskStats = () => {
    const children = store.tasks()?.filter((c) => c.parent_id === t.id) ?? [];
    if (children.length === 0) return null;
    const done = children.filter((c) => c.completed).length;
    return { done, total: children.length };
  };

  return (
    <li
      class="task-item"
      classList={{
        completed: t.completed,
        selected: props.isSelected,
        pinned: t.is_pinned,
      }}
      style={{ "margin-left": `${(props.depth ?? 0) * 24}px` }}
      onContextMenu={openCtx}
    >
      {PRIORITY_ICON[t.priority]?.()}
      <div class="task-row">
        {/* 左侧：勾选框（非笔记） */}
        {t.kind !== "note" && (
          <button class="check-btn" onClick={toggleComplete} title="切换完成">
            {t.completed ? (
              <CheckCircle2 size={20} strokeWidth={2} class="check-done" />
            ) : (
              <Circle size={20} strokeWidth={2} class="check-todo" />
            )}
          </button>
        )}

        {/* 中间：标题 + 元信息 */}
        <div class="task-content" onClick={() => props.onEdit(t)}>
          <span class="task-title">
            {t.kind === "note" && (
              <StickyNote size={14} strokeWidth={2} class="kind-icon" />
            )}
            {t.title}
          </span>
          <div class="task-meta">
            {subtaskStats() && (
              <span class="tag subtask-progress">
                {subtaskStats()!.done}/{subtaskStats()!.total}
              </span>
            )}
            {project() && (
              <span
                class="tag"
                style={{
                  background: project()!.color + "22",
                  color: project()!.color,
                }}
              >
                {project()!.name}
              </span>
            )}
            {t.tags.map((tag) => (
              <span class="tag chip">#{tag}</span>
            ))}
            <div class="task-meta-right">
              {t.due_date && (
                <>
                  <span class="due-date">
                    <Calendar size={12} strokeWidth={2} />
                    {new Date(t.due_date).toLocaleDateString("zh-CN")}
                  </span>
                  {cdBadge(t.due_date) && (
                    <span class={`detail-cd ${cdBadge(t.due_date)!.cls}`}>
                      {cdBadge(t.due_date)!.text}
                    </span>
                  )}
                </>
              )}
              {t.description && (
                <span class="has-desc">
                  <FileText size={12} strokeWidth={2} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div class="task-actions">
          <button
            class={`icon-btn ${t.is_pinned ? "pin-active" : ""}`}
            title={t.is_pinned ? "取消置顶" : "置顶"}
            onClick={togglePin}
          >
            <Pin size={15} strokeWidth={2} />
          </button>
          <button
            class={`icon-btn ${t.is_favorite ? "star-active" : ""}`}
            title={t.is_favorite ? "取消收藏" : "收藏"}
            onClick={toggleFavorite}
          >
            <Star size={15} strokeWidth={2} />
          </button>
          <button class="icon-btn danger" title="删除" onClick={handleDelete}>
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      <Show when={ctxOpen()}>
        <div class="ctx-backdrop" onClick={() => setCtxOpen(false)} />
        <div
          class="ctx-menu"
          classList={{ "ctx-menu-up": ctxUp() }}
          style={{ top: ctxY(), left: ctxX() }}
        >
          <div class="popover-section-label">优先级</div>
          <button
            class="ctx-item"
            classList={{ active: t.priority === "none" }}
            onClick={() => setPriority("none")}
          >
            <FlagTriangleRight size={13} strokeWidth={2} color="#9ca3af" />无
          </button>
          <button
            class="ctx-item"
            classList={{ active: t.priority === "low" }}
            onClick={() => setPriority("low")}
          >
            <FlagTriangleRight size={13} strokeWidth={2} color="#22c55e" />低
          </button>
          <button
            class="ctx-item"
            classList={{ active: t.priority === "medium" }}
            onClick={() => setPriority("medium")}
          >
            <FlagTriangleRight size={13} strokeWidth={2} color="#f59e0b" />中
          </button>
          <button
            class="ctx-item"
            classList={{ active: t.priority === "high" }}
            onClick={() => setPriority("high")}
          >
            <FlagTriangleRight size={13} strokeWidth={2} color="#ef4444" />高
          </button>
          <div class="ctx-divider" />
          <button class="ctx-item" onClick={toggleKind}>
            <Repeat size={13} strokeWidth={2} />
            {t.kind === "note" ? "转化为任务" : "转化为笔记"}
          </button>
          <div class="ctx-divider" />
          <button
            class="ctx-item"
            onClick={() => {
              setCtxOpen(false);
              togglePin();
            }}
          >
            <Pin size={13} strokeWidth={2} />
            {t.is_pinned ? "取消置顶" : "置顶"}
          </button>
          <button
            class="ctx-item"
            onClick={() => {
              setCtxOpen(false);
              toggleFavorite();
            }}
          >
            <Star size={13} strokeWidth={2} />
            {t.is_favorite ? "取消收藏" : "收藏"}
          </button>
          <button
            class="ctx-item danger"
            onClick={() => {
              setCtxOpen(false);
              handleDelete();
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            删除
          </button>
        </div>
      </Show>
    </li>
  );
}
