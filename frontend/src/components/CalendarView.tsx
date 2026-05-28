import { createSignal, createMemo, For, Show } from "solid-js";
import { store } from "../store";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  GanttChartSquare,
} from "lucide-solid";
import TaskDetail from "./TaskDetail";
import type { Task } from "../types";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";
import { onMount, onCleanup, createEffect } from "solid-js";

export default function CalendarView() {
  const [year, setYear] = createSignal(new Date().getFullYear());
  const [month, setMonth] = createSignal(new Date().getMonth());
  const [detailTask, setDetailTask] = createSignal<Task | null>(null);
  const [mode, setMode] = createSignal<"calendar" | "gantt">("calendar");

  const daysInMonth = () => new Date(year(), month() + 1, 0).getDate();
  const firstDayOfWeek = () => new Date(year(), month(), 1).getDay();

  const dayTasks = createMemo(() => {
    const map = new Map<string, Task[]>();
    const ym = `${year()}-${String(month() + 1).padStart(2, "0")}`;
    for (const t of store.tasks() ?? []) {
      if (!t.due_date) continue;
      const start = t.start_date?.slice(0, 10) ?? t.due_date.slice(0, 10);
      const end = t.due_date.slice(0, 10);
      let s = new Date(start);
      const e = new Date(end);
      while (s <= e) {
        const ds = s.toISOString().slice(0, 10);
        if (ds.startsWith(ym)) {
          if (!map.has(ds)) map.set(ds, []);
          map.get(ds)!.push(t);
        }
        s.setDate(s.getDate() + 1);
      }
    }
    return map;
  });

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function prevMonth() {
    if (month() === 0) {
      setMonth(11);
      setYear(year() - 1);
    } else setMonth(month() - 1);
  }
  function nextMonth() {
    if (month() === 11) {
      setMonth(0);
      setYear(year() + 1);
    } else setMonth(month() + 1);
  }

  const monthNames =
    "一月 二月 三月 四月 五月 六月 七月 八月 九月 十月 十一月 十二月".split(
      " ",
    );
  const weekDays = "日 一 二 三 四 五 六".split(" ");

  return (
    <div class="main-area">
      <div class="task-list calendar-view">
        <div class="task-header">
          <h1>
            <button class="cal-nav-btn" onClick={prevMonth}>
              <ChevronLeft size={20} />
            </button>
            {year()}年 {monthNames[month()]}
            <button class="cal-nav-btn" onClick={nextMonth}>
              <ChevronRight size={20} />
            </button>
            <div class="cal-mode-toggle">
              <button
                class="cal-mode-btn"
                classList={{ active: mode() === "calendar" }}
                onClick={() => setMode("calendar")}
                title="日历视图"
              >
                <Calendar size={16} />
              </button>
              <button
                class="cal-mode-btn"
                classList={{ active: mode() === "gantt" }}
                onClick={() => setMode("gantt")}
                title="甘特图视图"
              >
                <GanttChartSquare size={16} />
              </button>
            </div>
          </h1>
        </div>

        <Show
          when={mode() === "calendar"}
          fallback={
            <GanttContent
              year={year()}
              month={month()}
              onTaskClick={(t) => setDetailTask(t)}
            />
          }
        >
          <div class="cal-weekdays">
            <For each={weekDays}>
              {(d) => <div class="cal-weekday">{d}</div>}
            </For>
          </div>
          <div class="cal-body">
            <div class="cal-grid">
              {(() => {
                const cells: any[] = [];
                const total = daysInMonth();
                const start = firstDayOfWeek();
                for (let i = 0; i < start; i++)
                  cells.push(<div class="cal-cell empty" />);
                for (let d = 1; d <= total; d++) {
                  const dateStr = `${year()}-${String(month() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const isToday = dateStr === today();
                  const tasks = dayTasks().get(dateStr) ?? [];
                  cells.push(
                    <div class="cal-cell" classList={{ today: isToday }}>
                      <span class={isToday ? "cal-today-dot" : "cal-day-num"}>
                        {d}
                      </span>
                      <Show when={tasks.length > 0}>
                        <div class="cal-bars">
                          {tasks.map((t) => {
                            const isOverdue = !!(
                              !t.completed &&
                              t.due_date &&
                              t.due_date.slice(0, 10) < today()
                            );
                            return (
                              <div
                                class="cal-bar"
                                classList={{
                                  done: t.completed,
                                  overdue: isOverdue,
                                }}
                                style={{
                                  background: t.completed
                                    ? "#d1d5db"
                                    : barColor(t),
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailTask(t);
                                }}
                              >
                                {t.title}
                              </div>
                            );
                          })}
                        </div>
                      </Show>
                    </div>,
                  );
                }
                return cells;
              })()}
            </div>
          </div>
        </Show>

        <Show when={detailTask()}>
          <div class="detail-backdrop" onClick={() => setDetailTask(null)} />
          <TaskDetail task={detailTask()} onClose={() => setDetailTask(null)} />
        </Show>
      </div>
    </div>
  );
}

function barColor(task: Task) {
  if (task.project_id) {
    const p = store.projects()?.find((p) => p.id === task.project_id);
    if (p) return p.color;
  }
  const m: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e",
  };
  return m[task.priority] ?? "#9ca3af";
}

function GanttContent(props: {
  year: number;
  month: number;
  onTaskClick: (t: Task) => void;
}) {
  let container!: HTMLDivElement;

  function mapTasks() {
    const all = store.tasks() ?? [];
    return all
      .filter((t) => t.due_date && t.kind !== "note")
      .map((t) => ({
        id: t.id,
        text: t.title,
        start_date: (t.start_date || t.due_date)!.replace("T", " "),
        end_date: t.due_date!.replace("T", " "),
        duration: t.start_date ? undefined : 1,
        progress: t.completed ? 1 : 0,
        parent: t.parent_id || undefined,
      }));
  }

  onMount(() => {
    gantt.config.date_format = "%Y-%m-%d %H:%i";
    gantt.config.scales = [
      { unit: "month", step: 1, format: "%Y年 %M" },
      { unit: "day", step: 1, format: "%d" },
    ];
    gantt.config.columns = [
      { name: "text", label: "任务", tree: true, width: 220 },
      { name: "start_date", label: "开始", width: 100, align: "center" },
      { name: "end_date", label: "结束", width: 100, align: "center" },
    ];
    gantt.config.autosize = true;
    gantt.config.show_unscheduled = true;
    gantt.init(container);

    gantt.attachEvent("onTaskClick", (id: string) => {
      const task = store.tasks()?.find((t) => t.id === id);
      if (task) props.onTaskClick(task);
      return true;
    });
  });

  createEffect(() => {
    const data = mapTasks();
    gantt.clearAll();
    if (data.length > 0) gantt.parse({ data });
  });

  onCleanup(() => gantt.clearAll());

  return <div ref={container} style="flex:1;min-height:0;" />;
}

function priorityColor(p: string) {
  const m: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e",
  };
  return m[p] ?? "#9ca3af";
}
