import { createMemo, createSignal, For, Show } from "solid-js";
import { store } from "../store";
import { Calendar } from "lucide-solid";
import TaskDetail from "./TaskDetail";
import type { Task } from "../types";

export default function MatrixView() {
  const [detailTask, setDetailTask] = createSignal<Task | null>(null);

  const isUrgent = (t: Task) => {
    if (!t.due_date) return false;
    const now = new Date();
    const due = new Date(t.due_date);
    const days = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 3;
  };

  const isImportant = (t: Task) => {
    return t.priority === "high" || t.priority === "medium" || t.is_favorite;
  };

  const quadrants = createMemo(() => {
    const result = {
      q1: [] as Task[],
      q2: [] as Task[],
      q3: [] as Task[],
      q4: [] as Task[],
    };
    for (const t of store.tasks() ?? []) {
      if (t.completed || t.kind === "note" || t.parent_id) continue;
      const urgent = isUrgent(t);
      const important = isImportant(t);
      if (important && urgent) result.q1.push(t);
      else if (important && !urgent) result.q2.push(t);
      else if (!important && urgent) result.q3.push(t);
      else result.q4.push(t);
    }
    return result;
  });

  const sections = [
    { key: "q1", title: "重要且紧急", desc: "立即去做", color: "#ef4444" },
    { key: "q2", title: "重要不紧急", desc: "计划去做", color: "#3b82f6" },
    { key: "q3", title: "不重要但紧急", desc: "授权/尽快", color: "#f59e0b" },
    { key: "q4", title: "不重要不紧急", desc: "减少/剔除", color: "#9ca3af" },
  ];

  return (
    <div class="main-area">
      <div class="task-list matrix-view">
        <div class="task-header">
          <h1>四象限</h1>
        </div>
        <div class="matrix-grid">
          <For each={sections}>
            {(s) => (
              <div class="matrix-quad">
                <div class="matrix-quad-header" style={{ color: s.color }}>
                  <h3>{s.title}</h3>
                  <span class="matrix-quad-desc">{s.desc}</span>
                  <span class="matrix-quad-count">
                    {(quadrants() as any)[s.key].length}
                  </span>
                </div>
                <div class="matrix-tasks">
                  <For each={(quadrants() as any)[s.key] as Task[]}>
                    {(task) => (
                      <div
                        class="matrix-task"
                        onClick={() => setDetailTask(task)}
                      >
                        <span
                          class="matrix-task-dot"
                          style={{ background: priorityColor(task.priority) }}
                        />
                        <span class="matrix-task-title">{task.title}</span>
                        <Show when={task.due_date}>
                          <span class="matrix-task-date">
                            <Calendar size={11} />
                            {new Date(task.due_date!).toLocaleDateString(
                              "zh-CN",
                            )}
                          </span>
                        </Show>
                      </div>
                    )}
                  </For>
                  <Show when={(quadrants() as any)[s.key].length === 0}>
                    <div class="matrix-empty">暂无任务</div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={detailTask()}>
          <div class="detail-backdrop" onClick={() => setDetailTask(null)} />
          <TaskDetail task={detailTask()} onClose={() => setDetailTask(null)} />
        </Show>
      </div>
    </div>
  );
}

function priorityColor(p: string) {
  const m: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e",
  };
  return m[p] ?? "#9ca3af";
}
