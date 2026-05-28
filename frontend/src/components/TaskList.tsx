import { createSignal, For, Show } from "solid-js";
import { store, type TaskNode } from "../store";
import TaskItem from "./TaskItem";
import TaskDetail from "./TaskDetail";
import type { Task } from "../types";
import {
  CheckCircle2,
  Plus,
  Rocket,
  ArrowDownWideNarrow,
  Sparkles,
  Loader2,
} from "lucide-solid";
import { parseTask, getAgentSettings } from "../api/agent";

export default function TaskList() {
  const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
  const [isNewTask, setIsNewTask] = createSignal(false);
  const [sortOpen, setSortOpen] = createSignal(false);

  const groupLabel = () => {
    const m: Record<string, string> = {
      none: "不分组",
      project: "按清单",
      priority: "按优先级",
      date: "按日期",
    };
    return m[store.groupMode()] ?? "不分组";
  };
  const sortLabel = () => {
    const m: Record<string, string> = {
      manual: "手动",
      priority: "优先级",
      date: "日期",
      alpha: "字母",
    };
    return m[store.sortMode()] ?? "手动";
  };

  function handleNew() {
    setSelectedTask(null);
    setIsNewTask(true);
  }
  function handleEdit(task: Task) {
    setIsNewTask(false);
    setSelectedTask(task);
  }
  function handleCloseDetail() {
    setIsNewTask(false);
    setSelectedTask(null);
  }

  const [quickTitle, setQuickTitle] = createSignal("");
  const [aiLoading, setAiLoading] = createSignal(false);

  async function handleQuickAdd() {
    const title = quickTitle().trim();
    if (!title) return;
    // 如果配置了 AI，Enter 走 AI 智能解析
    const settings = getAgentSettings();
    if (settings?.apiKey) {
      handleAiParse();
      return;
    }
    const pId =
      store.taskView() === "project" ? store.selectedProjectId() : null;
    let taskKind: "task" | "note" = "task";
    if (pId) {
      const proj = store.projects()?.find((p) => p.id === pId);
      if (proj?.kind === "note") taskKind = "note";
    }
    try {
      await store.createTask({ title, project_id: pId, kind: taskKind });
      setQuickTitle("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAiParse() {
    const input = quickTitle().trim();
    if (!input) return;
    setAiLoading(true);
    try {
      const parsed = await parseTask(input);
      // 匹配 project_hint 到现有清单
      let projectId: string | null =
        store.taskView() === "project" ? store.selectedProjectId() : null;
      if (!projectId && parsed.project_hint) {
        const proj = store
          .projects()
          ?.find(
            (p) =>
              p.name.toLowerCase() === parsed.project_hint!.toLowerCase() ||
              p.name.includes(parsed.project_hint!),
          );
        if (proj) projectId = proj.id;
      }
      // 确定 kind
      let taskKind: "task" | "note" = "task";
      if (projectId) {
        const proj = store.projects()?.find((p) => p.id === projectId);
        if (proj?.kind === "note") taskKind = "note";
      }
      await store.createTask({
        title: parsed.title || input,
        description: parsed.description || null,
        priority: parsed.priority || "none",
        due_date: parsed.due_date || null,
        start_date: parsed.start_date || null,
        tags: parsed.tags || [],
        project_id: projectId,
        kind: taskKind,
      });
      setQuickTitle("");
    } catch (err: any) {
      alert("AI 解析失败: " + err.message);
    } finally {
      setAiLoading(false);
    }
  }

  const showDetail = () => isNewTask() || selectedTask() !== null;

  return (
    <div class="main-area">
      <div class="task-list">
        <div class="task-header">
          <h1>{store.viewTitle()}</h1>
          <div class="task-header-actions">
            <div class="popover-wrapper">
              <button
                class="header-icon-btn"
                title="排序和分组"
                onClick={() => setSortOpen(!sortOpen())}
              >
                <ArrowDownWideNarrow size={16} strokeWidth={2} />
              </button>
              <Show when={sortOpen()}>
                <div
                  class="popover-menu popover-menu-right"
                  style={{ "min-width": "140px" }}
                >
                  <div class="popover-section-label">分组</div>
                  {(
                    [
                      ["none", "不分组"],
                      ["project", "按清单"],
                      ["priority", "按优先级"],
                      ["date", "按日期"],
                    ] as [string, string][]
                  ).map(([v, label]) => (
                    <button
                      class="popover-item"
                      classList={{ active: store.groupMode() === v }}
                      onClick={() => {
                        store.setGroupMode(v as any);
                        setSortOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <div class="popover-divider" />
                  <div class="popover-section-label">排序</div>
                  {(
                    [
                      ["manual", "手动"],
                      ["priority", "优先级"],
                      ["date", "日期"],
                      ["alpha", "字母"],
                    ] as [string, string][]
                  ).map(([v, label]) => (
                    <button
                      class="popover-item"
                      classList={{ active: store.sortMode() === v }}
                      onClick={() => {
                        store.setSortMode(v as any);
                        setSortOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Show>
            </div>
            <button
              class="header-icon-btn"
              onClick={handleNew}
              title="新建任务"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 过滤器编辑栏 */}
        <FilterEditor />

        <Show when={store.taskView() !== "completed"}>
          <div class="quick-add">
            <input
              type="text"
              placeholder={
                getAgentSettings()?.apiKey
                  ? "输入任务，Enter AI 解析..."
                  : "快速添加任务，按 Enter 提交..."
              }
              value={quickTitle()}
              onInput={(e) => setQuickTitle(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
            />
            <button
              class="ai-parse-btn"
              title="AI 智能解析（自动识别日期/优先级/标签/清单）"
              onClick={handleAiParse}
              disabled={aiLoading() || !quickTitle().trim()}
            >
              <Show
                when={aiLoading()}
                fallback={<Sparkles size={16} strokeWidth={2} />}
              >
                <Loader2 size={16} strokeWidth={2} class="animate-spin" />
              </Show>
            </button>
          </div>
        </Show>

        <Show
          when={store.filteredTasks().length > 0}
          fallback={
            <div class="empty">
              <Rocket size={40} strokeWidth={1.5} class="empty-icon" />
              <p>
                {store.taskView() === "completed"
                  ? "暂无已完成任务"
                  : "暂无任务，开始创建吧"}
              </p>
            </div>
          }
        >
          <Show when={store.groupMode() === "none"}>
            <TaskNodeList
              nodes={store.filteredTaskTree()}
              selectedId={selectedTask()?.id ?? null}
              onEdit={handleEdit}
            />
          </Show>
          <Show when={store.groupMode() !== "none"}>
            <For each={store.groupedTasks()}>
              {(group) => (
                <>
                  <Show when={group.label}>
                    <h3 class="group-heading">
                      {group.label} ({group.tasks.length})
                    </h3>
                  </Show>
                  <ul>
                    <For each={group.tasks}>
                      {(task) => (
                        <TaskItem
                          task={task}
                          onEdit={handleEdit}
                          isSelected={selectedTask()?.id === task.id}
                        />
                      )}
                    </For>
                  </ul>
                </>
              )}
            </For>
          </Show>
        </Show>
      </div>

      <Show when={showDetail()}>
        <div class="detail-backdrop" onClick={handleCloseDetail} />
        <TaskDetail
          task={isNewTask() ? null : selectedTask()}
          onClose={handleCloseDetail}
        />
      </Show>
    </div>
  );
}

// ============================================================
// 递归渲染任务树
// ============================================================
function TaskNodeList(props: {
  nodes: TaskNode[];
  selectedId: string | null;
  onEdit: (t: Task) => void;
  depth?: number;
}) {
  const d = props.depth ?? 0;
  const pending = () =>
    props.nodes.filter((t) => !t.completed || t.kind === "note");
  const done = () =>
    props.nodes.filter((t) => t.completed && t.kind !== "note");
  const showDone = () => d === 0 && done().length > 0;

  return (
    <>
      <For each={pending()}>
        {(node) => (
          <TaskTreeItem
            node={node}
            selectedId={props.selectedId}
            onEdit={props.onEdit}
            depth={d}
          />
        )}
      </For>
      <Show when={showDone()}>
        <h3 class="done-heading">
          <CheckCircle2 size={14} strokeWidth={2} />
          已完成 ({done().length})
        </h3>
        <For each={done()}>
          {(node) => (
            <TaskTreeItem
              node={node}
              selectedId={props.selectedId}
              onEdit={props.onEdit}
              depth={d}
            />
          )}
        </For>
      </Show>
    </>
  );
}

function TaskTreeItem(props: {
  node: TaskNode;
  selectedId: string | null;
  onEdit: (t: Task) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = createSignal(true);
  const hasChildren = () => props.node.children.length > 0;

  return (
    <>
      <TaskItem
        task={props.node}
        onEdit={props.onEdit}
        isSelected={props.selectedId === props.node.id}
        depth={props.depth}
      />
      <Show when={expanded() && hasChildren()}>
        <TaskNodeList
          nodes={props.node.children}
          selectedId={props.selectedId}
          onEdit={props.onEdit}
          depth={props.depth + 1}
        />
      </Show>
    </>
  );
}

// ============================================================
// 过滤器编辑栏
// ============================================================
function FilterEditor() {
  const f = () => store.filters().find((f) => f.id === store.activeFilterId());
  if (!f()) return null;

  const c = () => f()!.conditions;

  function set(name: string, value: any) {
    store.updateFilter(f()!.id, {
      conditions: { ...c(), [name]: value || undefined },
    });
  }

  return (
    <div class="filter-editor">
      <span class="filter-chip">
        清单：
        <select
          value={c().project_id ?? ""}
          onChange={(e) => set("project_id", e.currentTarget.value || null)}
        >
          <option value="">全部</option>
          {store.projects()?.map((p) => (
            <option value={p.id}>{p.name}</option>
          ))}
        </select>
      </span>
      <span class="filter-chip">
        优先级：
        <select
          value={c().priority ?? ""}
          onChange={(e) => set("priority", e.currentTarget.value || null)}
        >
          <option value="">全部</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
          <option value="none">无</option>
        </select>
      </span>
      <span class="filter-chip">
        标签：
        <select
          value={c().tag ?? ""}
          onChange={(e) => set("tag", e.currentTarget.value || null)}
        >
          <option value="">全部</option>
          {store.tags()?.map((t) => (
            <option value={t.name}>#{t.name}</option>
          ))}
        </select>
      </span>
      <span class="filter-chip">
        <input
          type="text"
          placeholder="搜索..."
          value={c().search ?? ""}
          onInput={(e) => set("search", e.currentTarget.value)}
        />
      </span>
    </div>
  );
}
