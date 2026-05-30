import { createSignal, onMount } from "solid-js";
import { Minus, Square, X, Maximize } from "lucide-solid";

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

function isMacOS() {
  return /mac/i.test(navigator.platform);
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
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.preventDefault();
    appWindow?.startDragging();
  }

  const mac = isMacOS();

  return (
    <div
      class="titlebar"
      classList={{ "titlebar-mac": mac }}
      data-tauri-drag-region
      onMouseDown={mac ? undefined : onDragStart}
    >
      {/* macOS 红绿灯在左侧 */}
      {mac && (
        <div class="titlebar-mac-controls">
          <button
            class="titlebar-mac-btn titlebar-mac-close"
            onClick={close}
            title="关闭"
          />
          <button
            class="titlebar-mac-btn titlebar-mac-minimize"
            onClick={minimize}
            title="最小化"
          />
          <button
            class="titlebar-mac-btn titlebar-mac-maximize"
            onClick={toggleMaximize}
            title="最大化"
          />
        </div>
      )}
      <span class="titlebar-title">{mac ? "" : "RinoTodo"}</span>
      {/* Windows/Linux 控件在右侧 */}
      {!mac && (
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
      )}
    </div>
  );
}
