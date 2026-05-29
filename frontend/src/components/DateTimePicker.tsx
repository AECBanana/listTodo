import { For, Show } from "solid-js";

const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toLocalTime = (d: Date) => {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
};

export default function DateTimePicker(props: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const datePart = () => props.value.slice(0, 10) || "";
  const timePart = () => props.value.slice(11, 16) || "";

  const quickOptions = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const now = toLocalTime(today);
    return [
      { label: "今天", value: `${toLocalDate(today)}T${now}` },
      { label: "明天", value: `${toLocalDate(tomorrow)}T${now}` },
      { label: "下周", value: `${toLocalDate(nextWeek)}T${now}` },
    ];
  };

  function setDate(d: string) {
    const t = timePart() || "23:59";
    props.onChange(`${d}T${t}`);
  }

  function setTime(t: string) {
    const d = datePart() || toLocalDate(new Date());
    props.onChange(`${d}T${t}`);
  }

  return (
    <div class="datetime-picker">
      <For each={quickOptions()}>
        {(opt) => (
          <button
            class="popover-item"
            onClick={() => props.onChange(opt.value)}
          >
            {opt.label}
          </button>
        )}
      </For>
      <div class="popover-divider" />
      <div class="popover-section-label">自定义</div>
      <div class="dtp-custom">
        <input
          type="date"
          value={datePart()}
          onInput={(e) => setDate(e.currentTarget.value)}
          class="dtp-date"
        />
        <input
          type="time"
          value={timePart()}
          onInput={(e) => setTime(e.currentTarget.value)}
          class="dtp-time"
        />
      </div>
      <Show when={props.value}>
        <div class="popover-divider" />
        <button
          class="popover-item danger"
          onClick={() => {
            props.onChange("");
            props.onClose();
          }}
        >
          清除日期
        </button>
      </Show>
    </div>
  );
}
