import { onMount, onCleanup, createEffect, Show, createSignal } from "solid-js";
import { store } from "../store";
import TaskDetail from "./TaskDetail";
import type { Task } from "../types";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

export default function GanttView() {
  let container!: HTMLDivElement;
  const [detailTask, setDetailTask] = createSignal<Task | null>(null);

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

    // 点击任务条打开详情
    gantt.attachEvent("onTaskClick", (id: string) => {
      const task = store.tasks()?.find((t) => t.id === id);
      if (task) setDetailTask(task);
      return true;
    });
  });

  // 数据更新时刷新
  createEffect(() => {
    const data = mapTasks();
    if (data.length > 0) {
      gantt.clearAll();
      gantt.parse({ data });
    } else {
      gantt.clearAll();
    }
  });

  onCleanup(() => {
    gantt.clearAll();
  });

  return (
    <div class="main-area">
      <div class="task-list gantt-view">
        <div ref={container} style="width:100%;height:100%;" />

        <Show when={detailTask()}>
          <div class="detail-backdrop" onClick={() => setDetailTask(null)} />
          <TaskDetail task={detailTask()} onClose={() => setDetailTask(null)} />
        </Show>
      </div>
    </div>
  );
}
