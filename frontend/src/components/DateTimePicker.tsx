import { createSignal, For, Show } from "solid-js";
import { Eraser } from "lucide-solid";

const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ============================================================
// 自定义日期时间选择器
// 日期 Tab：单个日历 + 时间（截止日期）
// 时间段 Tab：开始日期 + 结束日期
// ============================================================

let lastMode: "date" | "range" = "date";

export default function DateTimePicker(props: {
  startValue: string;
  dueValue: string;
  onStartChange: (v: string) => void;
  onDueChange: (v: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = createSignal<"date" | "range">(lastMode);
  const [viewYear, setViewYear] = createSignal(new Date().getFullYear());
  const [viewMonth, setViewMonth] = createSignal(new Date().getMonth());
  const [timeOpen, setTimeOpen] = createSignal(false);
  const [startTimeOpen, setStartTimeOpen] = createSignal(false);
  const [localStart, setLocalStart] = createSignal(props.startValue);
  const [localDue, setLocalDue] = createSignal(props.dueValue);

  const todayStr = () => toLocalDate(new Date());

  // ---- 快捷日期 ----
  const quickOptions = () => {
    const t = new Date();
    const addDays = (n: number) => {
      const d = new Date(t.getTime() + n * 86400000);
      return toLocalDate(d);
    };
    return [
      { label: "今天", value: addDays(0) },
      { label: "明天", value: addDays(1) },
      { label: "后天", value: addDays(2) },
      { label: "下周", value: addDays(7) },
    ];
  };

  // ---- 日历数据 ----
  const monthLabel = () => `${viewYear()}年${viewMonth() + 1}月`;

  const dayHeaders = ["日", "一", "二", "三", "四", "五", "六"];

  const calendarDays = () => {
    const firstDay = new Date(viewYear(), viewMonth(), 1).getDay();
    const daysInMonth = new Date(viewYear(), viewMonth() + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  function prevMonth() {
    if (viewMonth() === 0) {
      setViewMonth(11);
      setViewYear(viewYear() - 1);
    } else setViewMonth(viewMonth() - 1);
  }

  function nextMonth() {
    if (viewMonth() === 11) {
      setViewMonth(0);
      setViewYear(viewYear() + 1);
    } else setViewMonth(viewMonth() + 1);
  }

  function formatDate(day: number) {
    const m = (viewMonth() + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${viewYear()}-${m}-${d}`;
  }

  // ---- 30 分钟间隔 ----
  const timeSlots = () => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++)
      for (let m = 0; m < 60; m += 30)
        slots.push(
          `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
        );
    return slots;
  };

  // ---- 日期模式（截止日期） ----
  const dueDate = () => localDue().slice(0, 10);
  const dueTime = () => localDue().slice(11, 16);
  const startTime = () => localStart().slice(11, 16);

  function selectDueDay(day: number) {
    const date = formatDate(day);
    const t = dueTime() || "23:59";
    setLocalDue(`${date}T${t}`);
  }

  function selectDueTime(t: string) {
    const d = dueDate() || todayStr();
    setLocalDue(`${d}T${t}`);
    setTimeOpen(false);
  }

  function selectStartTime(t: string) {
    const d = startDate() || todayStr();
    setLocalStart(`${d}T${t}`);
    setStartTimeOpen(false);
  }

  function setDueFromQuick(value: string) {
    const t = dueTime() || "23:59";
    setLocalDue(`${value}T${t}`);
  }

  // ---- 时间段模式 ----
  const startDate = () => localStart().slice(0, 10);
  const endDate = () => localDue().slice(0, 10);

  function setStartFromQuick(value: string) {
    const t = startTime() || "00:00";
    setLocalStart(`${value}T${t}`);
  }

  function setEndFromQuick(value: string) {
    const t = dueTime() || "23:59";
    setLocalDue(`${value}T${t}`);
  }

  function selectStartDay(day: number) {
    const date = formatDate(day);
    const t = startTime() || "00:00";
    setLocalStart(`${date}T${t}`);
  }

  function selectEndDay(day: number) {
    const d = formatDate(day);
    const t = dueTime() || "23:59";
    setLocalDue(`${d}T${t}`);
  }

  // ---- 辅助 ----
  const isToday = (day: number) => formatDate(day) === todayStr();
  const isSelected = (day: number, target: string) =>
    formatDate(day) === target;

  const fmtDate = (v: string) => {
    if (!v) return "未设";
    const d = new Date(v.slice(0, 10));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div class="dtp-new">
      {/* 第一行：Tab */}
      <div class="dtp-tabs">
        <button
          class="dtp-tab"
          classList={{ active: mode() === "date" }}
          onClick={() => {
            setMode("date");
            lastMode = "date";
          }}
        >
          日期
        </button>
        <button
          class="dtp-tab"
          classList={{ active: mode() === "range" }}
          onClick={() => {
            setMode("range");
            lastMode = "range";
          }}
        >
          时间段
        </button>
        <button
          class="dtp-tab-clear"
          onClick={() => {
            setLocalStart("");
            setLocalDue("");
          }}
          title="清空日期"
        >
          <Eraser size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ---- 日期模式 ---- */}
      <Show when={mode() === "date"}>
        {/* 快捷日期 */}
        <div class="dtp-quick-row">
          <For each={quickOptions()}>
            {(opt) => (
              <button
                class="dtp-quick-btn"
                onClick={() => setDueFromQuick(opt.value)}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>

        {/* 日历 */}
        <div class="dtp-calendar">
          <div class="dtp-year-nav">
            <button class="dtp-nav-btn" onClick={prevMonth}>
              &lt;
            </button>
            <span class="dtp-month-label">{monthLabel()}</span>
            <button class="dtp-nav-btn" onClick={nextMonth}>
              &gt;
            </button>
          </div>
          <div class="dtp-weekdays">
            <For each={dayHeaders}>
              {(h) => <span class="dtp-weekday">{h}</span>}
            </For>
          </div>
          <div class="dtp-days">
            <For each={calendarDays()}>
              {(day) => (
                <Show
                  when={day !== null}
                  fallback={<button class="dtp-day" disabled />}
                >
                  <button
                    class="dtp-day"
                    classList={{
                      today: isToday(day!),
                      selected: isSelected(day!, dueDate()),
                    }}
                    onClick={() => selectDueDay(day!)}
                  >
                    {day}
                  </button>
                </Show>
              )}
            </For>
          </div>
        </div>

        {/* 时间选择 */}
        <div class="dtp-time-row">
          <button
            class="dtp-time-trigger"
            onClick={() => setTimeOpen(!timeOpen())}
          >
            <span>{dueTime() || "时间"}</span>
            <span class="dtp-time-arrow">{timeOpen() ? "▲" : "▼"}</span>
          </button>
          <Show when={timeOpen()}>
            <div class="dtp-time-menu">
              <div class="dtp-time-manual">
                <input
                  type="time"
                  value={dueTime()}
                  onInput={(e) => selectDueTime(e.currentTarget.value)}
                  class="dtp-time-input"
                />
              </div>
              <div class="dtp-time-grid">
                <For each={timeSlots()}>
                  {(slot) => (
                    <button
                      class="dtp-time-slot"
                      classList={{ active: dueTime() === slot }}
                      onClick={() => selectDueTime(slot)}
                    >
                      {slot}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* ---- 时间段模式 ---- */}
      <Show when={mode() === "range"}>
        {/* 快捷开始日期 */}
        <div class="popover-section-label">开始日期</div>
        <div class="dtp-quick-row">
          <For each={quickOptions()}>
            {(opt) => (
              <button
                class="dtp-quick-btn"
                onClick={() => setStartFromQuick(opt.value)}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>

        {/* 开始日历 */}
        <div class="dtp-calendar">
          <div class="dtp-year-nav">
            <button class="dtp-nav-btn" onClick={prevMonth}>
              &lt;
            </button>
            <span class="dtp-month-label">{monthLabel()}</span>
            <button class="dtp-nav-btn" onClick={nextMonth}>
              &gt;
            </button>
          </div>
          <div class="dtp-weekdays">
            <For each={dayHeaders}>
              {(h) => <span class="dtp-weekday">{h}</span>}
            </For>
          </div>
          <div class="dtp-days">
            <For each={calendarDays()}>
              {(day) => (
                <Show
                  when={day !== null}
                  fallback={<button class="dtp-day" disabled />}
                >
                  <button
                    class="dtp-day"
                    classList={{
                      today: isToday(day!),
                      selected: isSelected(day!, startDate()),
                    }}
                    onClick={() => selectStartDay(day!)}
                  >
                    {day}
                  </button>
                </Show>
              )}
            </For>
          </div>
        </div>

        {/* 开始时间 */}
        <div class="dtp-time-row">
          <button
            class="dtp-time-trigger"
            onClick={() => setStartTimeOpen(!startTimeOpen())}
          >
            <span>{startTime() || "时间"}</span>
            <span class="dtp-time-arrow">{startTimeOpen() ? "▲" : "▼"}</span>
          </button>
          <Show when={startTimeOpen()}>
            <div class="dtp-time-menu">
              <div class="dtp-time-manual">
                <input
                  type="time"
                  value={startTime()}
                  onInput={(e) => selectStartTime(e.currentTarget.value)}
                  class="dtp-time-input"
                />
              </div>
              <div class="dtp-time-grid">
                <For each={timeSlots()}>
                  {(slot) => (
                    <button
                      class="dtp-time-slot"
                      classList={{ active: startTime() === slot }}
                      onClick={() => selectStartTime(slot)}
                    >
                      {slot}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>

        <div class="popover-divider" />

        {/* 结束日期 */}
        <div class="popover-section-label">结束日期</div>
        <div class="dtp-quick-row">
          <For each={quickOptions()}>
            {(opt) => (
              <button
                class="dtp-quick-btn"
                onClick={() => setEndFromQuick(opt.value)}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>

        <div class="dtp-calendar">
          <div class="dtp-year-nav">
            <button class="dtp-nav-btn" onClick={prevMonth}>
              &lt;
            </button>
            <span class="dtp-month-label">{monthLabel()}</span>
            <button class="dtp-nav-btn" onClick={nextMonth}>
              &gt;
            </button>
          </div>
          <div class="dtp-weekdays">
            <For each={dayHeaders}>
              {(h) => <span class="dtp-weekday">{h}</span>}
            </For>
          </div>
          <div class="dtp-days">
            <For each={calendarDays()}>
              {(day) => (
                <Show
                  when={day !== null}
                  fallback={<button class="dtp-day" disabled />}
                >
                  <button
                    class="dtp-day"
                    classList={{
                      today: isToday(day!),
                      selected: isSelected(day!, endDate()),
                    }}
                    onClick={() => selectEndDay(day!)}
                  >
                    {day}
                  </button>
                </Show>
              )}
            </For>
          </div>
        </div>

        {/* 结束时间 */}
        <div class="dtp-time-row">
          <button
            class="dtp-time-trigger"
            onClick={() => setTimeOpen(!timeOpen())}
          >
            <span>{dueTime() || "时间"}</span>
            <span class="dtp-time-arrow">{timeOpen() ? "▲" : "▼"}</span>
          </button>
          <Show when={timeOpen()}>
            <div class="dtp-time-menu">
              <div class="dtp-time-manual">
                <input
                  type="time"
                  value={dueTime()}
                  onInput={(e) => selectDueTime(e.currentTarget.value)}
                  class="dtp-time-input"
                />
              </div>
              <div class="dtp-time-grid">
                <For each={timeSlots()}>
                  {(slot) => (
                    <button
                      class="dtp-time-slot"
                      classList={{ active: dueTime() === slot }}
                      onClick={() => selectDueTime(slot)}
                    >
                      {slot}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <div class="popover-divider" />
      <div class="dtp-actions">
        <button class="dtp-btn dtp-btn-cancel" onClick={() => props.onClose()}>
          取消
        </button>
        <button
          class="dtp-btn dtp-btn-confirm"
          onClick={() => {
            props.onStartChange(localStart());
            props.onDueChange(localDue());
            props.onClose();
          }}
        >
          确认
        </button>
      </div>
    </div>
  );
}
