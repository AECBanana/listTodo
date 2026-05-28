import { createSignal, createEffect, on, Show, For } from "solid-js";
import { store } from "../store";
import type { Priority, Task, TaskKind } from "../types";
import { marked } from "marked";
import DateTimePicker from "./DateTimePicker";

// 启用 GitHub 扩展语法
marked.setOptions({ gfm: true, breaks: true });

// 根据主题动态切换 Markdown 暗色/亮色
// 预创建两个 link，通过 disabled 属性切换
import lightCss from "github-markdown-css/github-markdown-light.css?url";
import darkCss from "github-markdown-css/github-markdown-dark.css?url";

let _lightLink: HTMLLinkElement | null = null;
let _darkLink: HTMLLinkElement | null = null;

function ensureMdLinks() {
  if (!_lightLink) {
    _lightLink = document.createElement("link");
    _lightLink.rel = "stylesheet";
    _lightLink.href = lightCss;
    document.head.appendChild(_lightLink);

    _darkLink = document.createElement("link");
    _darkLink.rel = "stylesheet";
    _darkLink.href = darkCss;
    _darkLink.disabled = true;
    document.head.appendChild(_darkLink);
  }
}

function applyMdTheme(theme: string) {
  ensureMdLinks();
  _lightLink!.disabled = theme === "dark";
  _darkLink!.disabled = theme !== "dark";
}
import {
  Circle,
  CheckCircle2,
  CalendarDays,
  FlagTriangleRight,
  Pin,
  Star,
  X,
  Trash2,
  ClipboardList,
  NotebookPen,
  Sparkles,
  Loader2,
  ListTree,
} from "lucide-solid";
import { breakdownTask } from "../api/agent";

// ============================================================
// 内联编辑详情面板
// ============================================================

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: "none", label: "无优先级", color: "#9ca3af" },
  { value: "low", label: "低优先级", color: "#22c55e" },
  { value: "medium", label: "中优先级", color: "#f59e0b" },
  { value: "high", label: "高优先级", color: "#ef4444" },
];

function priorityColor(p: Priority) {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.color ?? "#9ca3af";
}

export default function TaskDetail(props: {
  task: Task | null;
  onClose: () => void;
}) {
  const isNew = () => props.task === null;
  let titleEl!: HTMLTextAreaElement;

  // Markdown 暗色模式跟随主题
  createEffect(() => applyMdTheme(store.theme()));

  const [title, setTitle] = createSignal(props.task?.title ?? "");

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  createEffect(() => {
    const _ = title();
    if (titleEl) autoResize(titleEl);
  });
  const [description, setDescription] = createSignal(
    props.task?.description ?? "",
  );
  const [completed, setCompleted] = createSignal(
    props.task?.completed ?? false,
  );
  const [priority, setPriority] = createSignal<Priority>(
    props.task?.priority ?? "none",
  );
  const [dueDate, setDueDate] = createSignal(
    props.task?.due_date?.slice(0, 16) ?? "",
  );
  const [startDate, setStartDate] = createSignal(
    props.task?.start_date?.slice(0, 16) ?? "",
  );
  const [projectId, setProjectId] = createSignal(
    props.task?.project_id ??
      (store.taskView() === "project" ? store.selectedProjectId() : "") ??
      "",
  );

  // 根据清单类型设默认 kind
  const defaultKind = (): TaskKind => {
    if (props.task) return props.task.kind;
    const pid = projectId();
    if (pid) {
      const proj = store.projects()?.find((p) => p.id === pid);
      if (proj?.kind === "note") return "note";
    }
    return "task";
  };
  const [kind, setKind] = createSignal<TaskKind>(defaultKind());
  const [tagsStr, setTagsStr] = createSignal(props.task?.tags.join(", ") ?? "");
  const [isPinned, setIsPinned] = createSignal(props.task?.is_pinned ?? false);
  const [isFavorite, setIsFavorite] = createSignal(
    props.task?.is_favorite ?? false,
  );

  // 弹窗状态
  const [dateOpen, setDateOpen] = createSignal(false);
  const [priorityOpen, setPriorityOpen] = createSignal(false);
  const [projectOpen, setProjectOpen] = createSignal(false);
  const [tagOpen, setTagOpen] = createSignal(false);
  const [newTagInput, setNewTagInput] = createSignal("");
  const [preview, setPreview] = createSignal(true);
  const isNote = () => kind() === "note";

  function closeAllPopovers() {
    setDateOpen(false);
    setPriorityOpen(false);
    setProjectOpen(false);
    setTagOpen(false);
  }

  // 切换任务时重置
  createEffect(
    on(
      () => props.task,
      (task) => {
        setTitle(task?.title ?? "");
        setDescription(task?.description ?? "");
        setCompleted(task?.completed ?? false);
        setPriority(task?.priority ?? "none");
        setKind(task?.kind ?? defaultKind());
        setDueDate(task?.due_date?.slice(0, 16) ?? "");
        setStartDate(task?.start_date?.slice(0, 16) ?? "");
        setProjectId(
          task?.project_id ??
            (store.taskView() === "project" ? store.selectedProjectId() : "") ??
            "",
        );
        setTagsStr(task?.tags?.join(", ") ?? "");
        setIsPinned(task?.is_pinned ?? false);
        setIsFavorite(task?.is_favorite ?? false);
      },
    ),
  );

  // ---- 自动保存 ----
  async function autoSave() {
    if (isNew()) {
      if (!title().trim()) return;
      try {
        // 为新增的标签创建标签定义（若不存在）
        const tags = buildBody().tags;
        for (const tagName of tags) {
          const exists = store.tags()?.some((t) => t.name === tagName);
          if (!exists) {
            await store.createTag({ name: tagName });
          }
        }
        await store.createTask(buildBody());
        // 新建后清空表单以便继续创建
        setTitle("");
        setDescription("");
        setTagsStr("");
      } catch (err: any) {
        alert(err.message);
      }
    } else {
      try {
        // 为新增的标签创建标签定义（若不存在）
        const tags = buildBody().tags;
        for (const tagName of tags) {
          const exists = store.tags()?.some((t) => t.name === tagName);
          if (!exists) {
            await store.createTag({ name: tagName });
          }
        }
        await store.updateTask(props.task!.id, buildBody());
      } catch (err: any) {
        /* 静默失败 */
      }
    }
  }

  function buildBody() {
    const toLocal = (v: string) => {
      if (!v) return null;
      // 如果已有秒数则直接返回，否则补 :00
      return v.length === 16 ? v + ":00" : v;
    };
    return {
      title: title().trim(),
      kind: kind(),
      description: description().trim() || null,
      priority: priority(),
      due_date: toLocal(dueDate()),
      start_date: toLocal(startDate()),
      project_id: projectId() || null,
      tags: tagsStr()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      is_pinned: isPinned(),
      is_favorite: isFavorite(),
    };
  }

  // ---- 快速完成切换 ----
  async function toggleComplete() {
    if (isNew()) return;
    const newVal = !completed();
    setCompleted(newVal);
    try {
      await store.updateTask(props.task!.id, { completed: newVal });
    } catch {
      setCompleted(!newVal);
    }
  }

  // ---- 快速优先级 ----
  function setPriorityAndClose(p: Priority) {
    setPriority(p);
    setPriorityOpen(false);
    if (!isNew()) autoSave();
  }

  // ---- 快速日期 ----
  function setDueAndClose(value: string) {
    setDueDate(value);
    if (!startDate()) setStartDate(value);
    setDateOpen(false);
    if (!isNew()) autoSave();
  }

  function setStartAndClose(value: string) {
    setStartDate(value);
    if (!dueDate()) setDueDate(value);
    setDateOpen(false);
    if (!isNew()) autoSave();
  }

  function clearDates() {
    setDueDate("");
    setStartDate("");
    setDateOpen(false);
    if (!isNew()) autoSave();
  }

  // ---- 删除 ----
  async function handleDelete() {
    if (isNew()) return;
    if (!confirm("确定删除此任务？")) return;
    await store.removeTask(props.task!.id);
    props.onClose();
  }

  // ---- 清单切换 ----
  function changeProject(pid: string) {
    setProjectId(pid);
    setProjectOpen(false);
    if (!isNew()) autoSave();
  }

  // ---- 标签操作 ----
  const currentTags = () =>
    tagsStr()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  function toggleTag(tagName: string) {
    const tags = currentTags();
    const idx = tags.indexOf(tagName);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tagName);
    setTagsStr(tags.join(", "));
    if (!isNew()) autoSave();
  }

  async function addNewTag() {
    const name = newTagInput().trim();
    if (!name) return;
    // 创建新标签
    try {
      await store.createTag({ name });
      toggleTag(name);
      setNewTagInput("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  const selectedProjectName = () => {
    const pid = projectId();
    if (!pid) return "清单";
    return store.projects()?.find((p) => p.id === pid)?.name ?? "清单";
  };

  // ---- 日期快捷选项 ----
  const dateQuickOptions = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const now = `${today.getHours().toString().padStart(2, "0")}:${today.getMinutes().toString().padStart(2, "0")}`;
    const toStr = (d: Date) => `${d.toISOString().slice(0, 10)}T${now}`;
    return [
      { label: "今天", value: toStr(today) },
      { label: "明天", value: toStr(tomorrow) },
      { label: "下周", value: toStr(nextWeek) },
    ];
  };

  const formattedDate = () => {
    const s = startDate();
    const d = dueDate();
    if (!s && !d) return "日期";
    const sd = s.slice(0, 10);
    const dd = d.slice(0, 10);
    if (s && d && sd === dd) return fmtSingle(d);
    if (s && d) return `${fmtShort(s)} → ${fmtShort(d)}`;
    if (d) return fmtSingle(d);
    return fmtSingle(s!);
  };

  const countdown = () => {
    const d = dueDate();
    if (!d) return null;
    const now = new Date();
    const target = new Date(d);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: "已过期", cls: "expired" };
    if (diffDays === 0) return { text: "今天到期", cls: "today" };
    if (diffDays === 1) return { text: "明天到期", cls: "soon" };
    if (diffDays <= 7) return { text: `${diffDays}天后`, cls: "soon" };
    return { text: `${diffDays}天后`, cls: "" };
  };

  function fmtSingle(dateStr: string) {
    if (!dateStr) return "日期";
    const date = new Date(dateStr);
    const today = new Date().toISOString().slice(0, 10);
    const hasTime =
      dateStr.length > 10 &&
      !dateStr.endsWith("T00:00") &&
      dateStr.slice(11) !== "00:00";
    let label: string;
    if (dateStr.slice(0, 10) === today) label = "今天";
    else {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      if (dateStr.slice(0, 10) === t.toISOString().slice(0, 10)) label = "明天";
      else
        label = date.toLocaleDateString("zh-CN", {
          month: "short",
          day: "numeric",
        });
    }
    if (hasTime)
      label +=
        " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        });
    return label;
  }

  function fmtShort(dateStr: string) {
    const date = new Date(dateStr);
    const hasTime =
      dateStr.length > 10 &&
      !dateStr.endsWith("T00:00") &&
      dateStr.slice(11) !== "00:00";
    let label = date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
    if (hasTime)
      label +=
        " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        });
    return label;
  }

  return (
    <aside class="detail-panel">
      {/* 点击弹窗外关闭的遮罩 */}
      <Show when={dateOpen() || priorityOpen() || projectOpen() || tagOpen()}>
        <div class="popover-backdrop" onClick={closeAllPopovers} />
      </Show>
      {/* 头部栏 */}
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          {/* 完成状态（非笔记） */}
          <Show when={!isNote()}>
            <button
              class="detail-action-btn"
              classList={{ done: completed() }}
              onClick={toggleComplete}
              title={completed() ? "取消完成" : "标为完成"}
            >
              {completed() ? (
                <CheckCircle2 size={20} strokeWidth={2} />
              ) : (
                <Circle size={20} strokeWidth={2} />
              )}
            </button>
          </Show>

          {/* 截止日期 */}
          <div class="popover-wrapper">
            <button
              class="detail-action-btn"
              classList={{ active: !!dueDate() }}
              onClick={() => {
                setDateOpen(!dateOpen());
                setPriorityOpen(false);
                setProjectOpen(false);
                setTagOpen(false);
              }}
              title="截止日期"
            >
              <CalendarDays size={18} strokeWidth={2} />
              <span>{formattedDate()}</span>
              <Show when={countdown()}>
                {(cd) => (
                  <span class={`detail-cd detail-cd-${cd().cls}`}>
                    {cd().text}
                  </span>
                )}
              </Show>
            </button>
            <Show when={dateOpen()}>
              <div class="popover-menu" style={{ "min-width": "220px" }}>
                <div class="popover-section-label">开始日期</div>
                <DateTimePicker
                  value={startDate()}
                  onChange={(v) => {
                    setStartDate(v);
                    setDateOpen(false);
                    if (!isNew()) autoSave();
                  }}
                  onClose={() => setDateOpen(false)}
                />
                <div class="popover-divider" />
                <div class="popover-section-label">截止日期</div>
                <DateTimePicker
                  value={dueDate()}
                  onChange={(v) => {
                    setDueDate(v);
                    setDateOpen(false);
                    if (!isNew()) autoSave();
                  }}
                  onClose={() => setDateOpen(false)}
                />
              </div>
            </Show>
          </div>
        </div>

        <div class="detail-topbar-right">
          {/* 优先级 */}
          <div class="popover-wrapper">
            <button
              class="detail-action-btn"
              onClick={() => {
                setPriorityOpen(!priorityOpen());
                setDateOpen(false);
                setProjectOpen(false);
                setTagOpen(false);
              }}
              title="优先级"
            >
              <FlagTriangleRight
                size={18}
                strokeWidth={2}
                color={priorityColor(priority())}
              />
            </button>
            <Show when={priorityOpen()}>
              <div class="popover-menu popover-menu-right">
                <For each={PRIORITY_OPTIONS}>
                  {(opt) => (
                    <button
                      class="popover-item"
                      classList={{ active: priority() === opt.value }}
                      onClick={() => setPriorityAndClose(opt.value)}
                    >
                      <FlagTriangleRight
                        size={14}
                        strokeWidth={2}
                        color={opt.color}
                      />
                      {opt.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* 关闭 */}
          <button
            class="detail-action-btn"
            onClick={props.onClose}
            title="关闭"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 标题 */}
      <div class="detail-body">
        <textarea
          ref={(el) => {
            titleEl = el;
            autoResize(el);
          }}
          class="detail-title-input"
          placeholder="任务标题"
          value={title()}
          onInput={(e) => {
            setTitle(e.currentTarget.value);
            autoResize(e.currentTarget);
          }}
          onBlur={() => autoSave()}
          rows={1}
        />

        {/* 描述 */}
        <div class="desc-area">
          <Show
            when={!isNote() || !preview()}
            fallback={
              <div
                class="detail-desc-preview markdown-body"
                innerHTML={marked(description() || "") as string}
                onDblClick={() => setPreview(false)}
              />
            }
          >
            <textarea
              class="detail-desc-input"
              placeholder="添加描述..."
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              onBlur={() => {
                autoSave();
                if (isNote()) setPreview(true);
              }}
              rows={isNote() ? 8 : 4}
            />
          </Show>
        </div>

        {/* 子任务（note 模式不显示） */}
        <Show when={!isNew() && !isNote()}>
          <Subtasks
            taskId={props.task!.id}
            projectId={projectId()}
            parentKind={kind()}
            description={description()}
          />
        </Show>
      </div>

      {/* 底部属性 */}
      <div class="detail-bottom">
        <div class="detail-bottom-row">
          {/* 清单 */}
          <div class="popover-wrapper">
            <button
              class="detail-chip"
              classList={{ active: !!projectId() }}
              onClick={() => {
                closeAllPopovers();
                setProjectOpen(true);
              }}
            >
              {selectedProjectName()}
            </button>
            <Show when={projectOpen()}>
              <div class="popover-menu popover-menu-up">
                <button
                  class="popover-item"
                  classList={{ active: !projectId() }}
                  onClick={() => changeProject("")}
                >
                  无清单
                </button>
                <For each={store.projects()}>
                  {(p) => (
                    <button
                      class="popover-item"
                      classList={{ active: projectId() === p.id }}
                      onClick={() => changeProject(p.id)}
                    >
                      {p.kind === "note" ? (
                        <NotebookPen
                          size={14}
                          strokeWidth={2}
                          color={p.color}
                        />
                      ) : (
                        <ClipboardList
                          size={14}
                          strokeWidth={2}
                          color={p.color}
                        />
                      )}
                      {p.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* 标签 */}
          <div class="popover-wrapper">
            <button
              class="detail-chip"
              classList={{ active: currentTags().length > 0 }}
              onClick={() => {
                closeAllPopovers();
                setTagOpen(!tagOpen());
              }}
            >
              标签{currentTags().length > 0 ? ` (${currentTags().length})` : ""}
            </button>
            <Show when={tagOpen()}>
              <div class="popover-menu popover-menu-up">
                <Show
                  when={store.tags()!.length > 0}
                  fallback={<div class="popover-hint">暂无标签</div>}
                >
                  <For each={store.tags()!}>
                    {(tag) => (
                      <button
                        class="popover-item"
                        classList={{ active: currentTags().includes(tag.name) }}
                        onClick={() => toggleTag(tag.name)}
                      >
                        <span
                          class="color-dot"
                          style={{ background: tag.color }}
                        />
                        {tag.name}
                      </button>
                    )}
                  </For>
                </Show>
                <div class="popover-divider" />
                <div class="popover-custom">
                  <input
                    type="text"
                    placeholder="新建标签..."
                    value={newTagInput()}
                    onInput={(e) => setNewTagInput(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNewTag()}
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* 开关 */}
          <button
            class="detail-chip"
            classList={{ active: isPinned() }}
            onClick={() => {
              setIsPinned(!isPinned());
              autoSave();
            }}
          >
            <Pin size={13} strokeWidth={2} />
            置顶
          </button>
          <button
            class="detail-chip"
            classList={{ active: isFavorite() }}
            onClick={() => {
              setIsFavorite(!isFavorite());
              autoSave();
            }}
          >
            <Star size={13} strokeWidth={2} />
            收藏
          </button>
          <Show when={!isNew()}>
            <button class="detail-chip danger" onClick={handleDelete}>
              <Trash2 size={13} strokeWidth={2} />
              删除
            </button>
          </Show>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// 子任务列表
// ============================================================
function Subtasks(props: {
  taskId: string;
  projectId: string | null;
  parentKind: TaskKind;
  description: string | null;
}) {
  const [input, setInput] = createSignal("");
  const [subDate, setSubDate] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [datePopoverId, setDatePopoverId] = createSignal<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = createSignal(false);

  const children = () => {
    return store.tasks()?.filter((t) => t.parent_id === props.taskId) ?? [];
  };

  async function addSubtask() {
    const title = input().trim();
    if (!title) return;
    try {
      await store.createTask({
        title,
        parent_id: props.taskId,
        project_id: props.projectId,
        kind: props.parentKind,
        due_date: subDate() ? new Date(subDate()).toISOString() : null,
      });
      setInput("");
      setSubDate("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleBreakdown() {
    const desc = props.description;
    if (!desc || !desc.trim()) {
      alert("请先在任务描述中填写内容，AI 才能拆解子任务");
      return;
    }
    setBreakdownLoading(true);
    try {
      const result = await breakdownTask(
        store.tasks()?.find((t) => t.id === props.taskId)?.title || "",
        desc,
      );
      for (const title of result.subtasks) {
        await store.createTask({
          title,
          parent_id: props.taskId,
          project_id: props.projectId,
          kind: props.parentKind,
        });
      }
    } catch (err: any) {
      alert("AI 拆解失败: " + err.message);
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function toggleChild(id: string, completed: boolean) {
    try {
      await store.updateTask(id, { completed: !completed });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function deleteChild(id: string) {
    try {
      await store.removeTask(id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditTitle(title);
  }

  async function saveEdit() {
    const id = editingId();
    if (!id) return;
    const name = editTitle().trim();
    setEditingId(null);
    if (!name) return;
    try {
      await store.updateTask(id, { title: name });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function updateDate(id: string, dateStr: string) {
    setDatePopoverId(null);
    try {
      await store.updateTask(id, {
        due_date: dateStr ? new Date(dateStr).toISOString() : null,
      });
    } catch (err: any) {
      alert(err.message);
    }
  }

  function clearDate(id: string) {
    updateDate(id, "");
  }

  const dateQuickOptions = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const now = `${today.getHours().toString().padStart(2, "0")}:${today.getMinutes().toString().padStart(2, "0")}`;
    const toStr = (d: Date) => `${d.toISOString().slice(0, 10)}T${now}`;
    return [
      { label: "今天", value: toStr(today) },
      { label: "明天", value: toStr(tomorrow) },
      { label: "下周", value: toStr(nextWeek) },
    ];
  };

  return (
    <div class="subtasks">
      <For each={children()}>
        {(child) => (
          <div class="subtask-row" classList={{ done: child.completed }}>
            <button
              class="subtask-check"
              onClick={() => toggleChild(child.id, child.completed)}
            >
              {child.completed ? (
                <CheckCircle2 size={16} strokeWidth={2} class="check-done" />
              ) : (
                <span class="subtask-circle" />
              )}
            </button>
            {editingId() === child.id ? (
              <input
                class="subtask-edit-input"
                type="text"
                value={editTitle()}
                onInput={(e) => setEditTitle(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={saveEdit}
                ref={(el) => el?.focus()}
              />
            ) : (
              <span
                class="subtask-title"
                onDblClick={() => startEdit(child.id, child.title)}
              >
                {child.title}
              </span>
            )}
            <div class="popover-wrapper">
              <button
                class="subtask-date"
                onClick={() =>
                  setDatePopoverId(
                    datePopoverId() === child.id ? null : child.id,
                  )
                }
                title="设置日期"
              >
                {child.due_date ? (
                  <>
                    <CalendarDays size={12} strokeWidth={2} />
                    {new Date(child.due_date).toLocaleDateString("zh-CN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </>
                ) : (
                  <CalendarDays size={12} strokeWidth={2} />
                )}
              </button>
              <Show when={datePopoverId() === child.id}>
                <div
                  class="popover-menu popover-menu-right"
                  style={{ "min-width": "180px", bottom: "100%", top: "auto" }}
                >
                  <DateTimePicker
                    value={child.due_date?.slice(0, 16) ?? ""}
                    onChange={(v) => updateDate(child.id, v)}
                    onClose={() => setDatePopoverId(null)}
                  />
                </div>
              </Show>
            </div>
            <button
              class="icon-btn subtask-delete"
              onClick={() => deleteChild(child.id)}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </For>
      <div class="subtask-add">
        <input
          type="text"
          placeholder="添加子任务，Enter 提交"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubtask()}
          disabled={breakdownLoading()}
        />
        <input
          type="datetime-local"
          class="subtask-date-input"
          value={subDate()}
          onInput={(e) => setSubDate(e.currentTarget.value)}
        />
        <button
          class="ai-breakdown-btn"
          title="AI 智能拆解子任务（基于任务描述）"
          onClick={handleBreakdown}
          disabled={breakdownLoading()}
        >
          <Show
            when={breakdownLoading()}
            fallback={<Sparkles size={14} strokeWidth={2} />}
          >
            <Loader2 size={14} strokeWidth={2} class="animate-spin" />
          </Show>
        </button>
      </div>
    </div>
  );
}
