import { createSignal, onMount } from "solid-js";
import { Minus, Square, X, Maximize } from "lucide-solid";

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

export default function TitleBar() {
  if (!isTauri()) return null;

  const [ready, setReady] = createSignal(false);
  const [maximized, setMaximized] = createSignal(false);
  let appWindow: any = null;

  onMount(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      appWindow = getCurrentWindow();
      setReady(true);

      const isMax = await appWindow.isMaximized();
      setMaximized(isMax);

      appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      });
    } catch (e) {
      console.error("TitleBar: Failed to load Tauri window API", e);
    }
  });

  async function minimize() {
    appWindow?.minimize();
  }

  async function toggleMaximize() {
    await appWindow?.toggleMaximize();
  }

  async function close() {
    await appWindow?.close();
  }

  function onDragStart(e: MouseEvent) {
    // 只在点击标题栏背景时启动拖拽，不拦截按钮点击
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.preventDefault();
    appWindow?.startDragging();
  }

  return (
    <div class="titlebar" data-tauri-drag-region onMouseDown={onDragStart}>
      <span class="titlebar-title">RinoTodo</span>
      <div class="titlebar-controls">
        <button class="titlebar-btn" onClick={minimize} title="最小化">
          <Minus size={14} strokeWidth={2} />
        </button>
        <button
          class="titlebar-btn"
          onClick={toggleMaximize}
          title={maximized() ? "还原" : "最大化"}
        >
          {maximized() ? (
            <Square size={12} strokeWidth={2} />
          ) : (
            <Maximize size={14} strokeWidth={2} />
          )}
        </button>
        <button
          class="titlebar-btn titlebar-close"
          onClick={close}
          title="关闭"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
