import "github-markdown-css/github-markdown.css";
import { Show, createSignal, onMount } from "solid-js";
import { store } from "../store";
import * as api from "../api/client";
import {
  Trash2,
  BrainCircuit,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from "lucide-solid";
import pkg from "../../package.json";
import { getAgentSettings, saveAgentSettings } from "../api/agent";
import { JSEncrypt } from "jsencrypt";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  normal: "普通用户",
  vip: "VIP 用户",
};

export default function SettingsPanel() {
  const user = store.user;
  const initial = () => (user()?.username || "?")[0].toUpperCase();
  const avatarSrc = () => user()?.avatar || null;

  async function handleAvatarChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const updated = await api.updateProfile({
          avatar: reader.result as string,
        });
        store.setUser(updated);
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  const [regOpen, setRegOpen] = createSignal(true);
  const [regLoaded, setRegLoaded] = createSignal(false);

  async function loadRegStatus() {
    if (regLoaded()) return;
    try {
      const res = await api.getServerSettings();
      setRegOpen(res.registration_open);
    } catch {}
    setRegLoaded(true);
  }

  async function toggleRegistration() {
    try {
      const newVal = !regOpen();
      await api.updateServerSettings({ registration_open: newVal });
      setRegOpen(newVal);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div class="main-area">
      <div class="task-list">
        <div class="task-header">
          <h1>设置</h1>
        </div>

        <Show when={store.settingsTab() === "account"}>
          <div class="settings-content">
            <label class="avatar-upload">
              {avatarSrc() ? (
                <img class="settings-avatar-img" src={avatarSrc()!} alt="" />
              ) : (
                <div class="settings-avatar-lg">{initial()}</div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                hidden
              />
              <span class="avatar-hint">点击更换头像</span>
            </label>
            <h2>{user()?.username}</h2>
            <span
              class="role-badge"
              classList={{
                admin: user()?.role === "admin",
                vip: user()?.role === "vip",
              }}
            >
              {ROLE_LABELS[user()?.role || "normal"] || "普通用户"}
            </span>
            <p class="settings-desc">
              注册时间：
              {user()?.created_at
                ? new Date(user()!.created_at).toLocaleDateString("zh-CN")
                : "-"}
            </p>
            <p class="settings-desc settings-uuid">UUID：{user()?.id}</p>
            <ChangePassword />
          </div>
        </Show>

        <Show when={store.settingsTab() === "server"}>
          <ServerSettings
            loadRegStatus={loadRegStatus}
            regOpen={regOpen}
            regLoaded={regLoaded}
            toggleRegistration={toggleRegistration}
          />
        </Show>

        <Show when={store.settingsTab() === "theme"}>
          <ThemeSettings />
        </Show>

        <Show when={store.settingsTab() === "ai"}>
          <AiSettings />
        </Show>

        <Show when={store.settingsTab() === "about"}>
          <div class="settings-content">
            <h2>RinoTodo</h2>
            <p class="settings-desc">一个简洁高效的待办清单应用</p>
            <p class="settings-desc" style="color: var(--text-secondary)">
              版本 {pkg.version}
            </p>

            <div style="font-size: 13px; line-height: 1.7; color: var(--text-secondary); max-height: 320px; overflow-y: auto;">
              <Changelog />
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

function ServerSettings(props: {
  loadRegStatus: () => void;
  regOpen: () => boolean;
  regLoaded: () => boolean;
  toggleRegistration: () => void;
}) {
  props.loadRegStatus();
  return (
    <div class="settings-content" style="text-align: left; padding: 20px;">
      <div class="settings-toggle-row">
        <span>开放注册</span>
        <button
          class="toggle-switch"
          classList={{ active: props.regOpen() }}
          onClick={props.toggleRegistration}
          disabled={!props.regLoaded()}
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// AI 助手设置（DeepSeek）
// ============================================================
function AiSettings() {
  const saved = getAgentSettings();
  const [apiKey, setApiKey] = createSignal(saved?.apiKey || "");
  const [model, setModel] = createSignal(saved?.model || "deepseek-v4-flash");
  const [showKey, setShowKey] = createSignal(false);

  function handleSave() {
    const key = apiKey().trim();
    if (!key) {
      alert("请输入 DeepSeek API Key");
      return;
    }
    saveAgentSettings({
      apiKey: key,
      model: model().trim() || "deepseek-v4-flash",
    });
    alert("AI 设置已保存");
  }

  return (
    <div class="settings-content" style="text-align: left; padding: 20px;">
      <div
        class="settings-toggle-row"
        style="flex-direction:column;align-items:flex-start;gap:8px"
      >
        <span>DeepSeek API Key</span>
        <div style="display:flex;gap:6px;align-items:center;width:100%">
          <input
            class="bg-url-input"
            type={showKey() ? "text" : "password"}
            placeholder="sk-..."
            value={apiKey()}
            onInput={(e) => setApiKey(e.currentTarget.value)}
            style="flex:1"
          />
          <button
            class="header-icon-btn"
            onClick={() => setShowKey(!showKey())}
            title={showKey() ? "隐藏" : "显示"}
          >
            <Show when={showKey()} fallback={<Eye size={16} strokeWidth={2} />}>
              <EyeOff size={16} strokeWidth={2} />
            </Show>
          </button>
        </div>
        <span
          class="settings-desc"
          style="font-size:11px;color:var(--text-secondary)"
        >
          密钥仅保存在浏览器本地，不会上传到服务器
        </span>
      </div>

      <div
        class="settings-toggle-row"
        style="flex-direction:column;align-items:flex-start;gap:8px"
      >
        <span>模型</span>
        <div style="display:flex;gap:6px">
          {[
            { key: "deepseek-v4-flash", label: "V4 Flash（推荐）" },
            { key: "deepseek-v4-pro", label: "V4 Pro" },
          ].map((m) => (
            <button
              class="provider-chip"
              classList={{ active: model() === m.key }}
              onClick={() => setModel(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button class="save-btn" onClick={handleSave} style="margin-top:16px">
        保存设置
      </button>

      <div
        class="ai-features-info"
        style="margin-top:20px;padding:12px;background:var(--primary-light);border-radius:var(--radius);font-size:13px;color:var(--text-tertiary);line-height:1.6"
      >
        <strong style="color:var(--primary)">可用功能：</strong>
        <ul style="margin-top:6px;padding-left:18px">
          <li>
            <strong>智能解析</strong> —
            快速添加栏输入自然语言，自动识别日期/优先级/标签
          </li>
          <li>
            <strong>任务拆解</strong> — 任务详情中一键生成子任务
          </li>
          <li>
            <strong>今日概览</strong> — AI 分析今日任务，给出优先级建议
          </li>
          <li>
            <strong>7天总结</strong> — 每周自动生成完成情况报告
          </li>
        </ul>
        <p style="margin-top:8px;font-size:11px">
          获取 Key：
          <a
            href="https://platform.deepseek.com"
            target="_blank"
            rel="noopener"
            style="color:var(--primary)"
          >
            platform.deepseek.com
          </a>
        </p>
      </div>
    </div>
  );
}

function ThemeSettings() {
  const THEME_COLORS = [
    "#4772fa",
    "#ef4444",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  const settingsBody = () => ({
    theme: store.theme(),
    primary_color: store.primaryColor(),
    background_image: store.bgImage() || null,
    blur_amount: store.blurAmount(),
  });

  async function setColor(c: string) {
    store.setPrimaryColor(c);
    try {
      await api.updateUserSettings({ ...settingsBody(), primary_color: c });
    } catch {}
  }

  async function toggleTheme() {
    const t = store.theme() === "light" ? "dark" : "light";
    store.setTheme(t);
    try {
      await api.updateUserSettings({ ...settingsBody(), theme: t });
    } catch {}
  }

  async function setBg() {
    const url = prompt("背景图片 URL：", store.bgImage());
    if (url === null) return;
    store.setBgImage(url);
    try {
      await api.updateUserSettings({
        ...settingsBody(),
        background_image: url || null,
      });
    } catch {}
  }

  return (
    <div class="settings-content" style="text-align: left; padding: 20px;">
      <div class="settings-toggle-row">
        <span>深色模式</span>
        <button
          class="toggle-switch"
          classList={{ active: store.theme() === "dark" }}
          onClick={toggleTheme}
        >
          <span class="toggle-knob" />
        </button>
      </div>
      <div
        class="settings-toggle-row"
        style="flex-direction:column;align-items:flex-start;gap:8px"
      >
        <span>主题色</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          {THEME_COLORS.map((c) => (
            <button
              class="ctx-color-dot"
              classList={{ active: store.primaryColor() === c }}
              style={{ background: c, width: "28px", height: "28px" }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div
        class="settings-toggle-row"
        style="flex-direction:column;align-items:flex-start;gap:8px"
      >
        <span>背景图片</span>
        <div style="display:flex;gap:8px;align-items:center;width:100%">
          <input
            class="bg-url-input"
            type="text"
            placeholder="输入图片 URL..."
            value={store.bgImage()}
            onInput={(e) => {
              store.setBgImage(e.currentTarget.value);
              try {
                api.updateUserSettings({
                  ...settingsBody(),
                  background_image: e.currentTarget.value || null,
                });
              } catch {}
            }}
          />
          <Show when={store.bgImage()}>
            <button
              class="icon-btn"
              onClick={() => {
                store.setBgImage("");
                api.updateUserSettings({
                  ...settingsBody(),
                  background_image: null,
                });
              }}
              title="清除背景"
            >
              <Trash2 size={24} strokeWidth={2} color={store.primaryColor()} />
            </button>
          </Show>
        </div>
      </div>
      <Show when={store.bgImage()}>
        <div
          class="settings-toggle-row"
          style="flex-direction:column;align-items:flex-start;gap:8px"
        >
          <span>模糊强度：{store.blurAmount()}px</span>
          <input
            type="range"
            min="0"
            max="40"
            value={store.blurAmount()}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              store.setBlurAmount(v);
              try {
                api.updateUserSettings({ ...settingsBody(), blur_amount: v });
              } catch {}
            }}
            style="width:100%"
          />
        </div>
      </Show>
    </div>
  );
}

// ============================================================
// 修改密码
// ============================================================
function ChangePassword() {
  const [showForm, setShowForm] = createSignal(false);
  const [oldPassword, setOldPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [msg, setMsg] = createSignal("");
  const [msgOk, setMsgOk] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [showOld, setShowOld] = createSignal(false);
  const [showNew, setShowNew] = createSignal(false);
  const [showConfirm, setShowConfirm] = createSignal(false);

  function reset() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMsg("");
    setShowForm(false);
  }

  async function handleChange() {
    setMsg("");
    const oldP = oldPassword();
    const newP = newPassword();
    const confirmP = confirmPassword();

    if (!oldP || !newP || !confirmP) {
      setMsgOk(false);
      setMsg("请填写所有密码字段");
      return;
    }
    if (newP.length < 6) {
      setMsgOk(false);
      setMsg("新密码长度不能少于 6 位");
      return;
    }
    if (newP !== confirmP) {
      setMsgOk(false);
      setMsg("两次输入的新密码不一致");
      return;
    }
    if (oldP === newP) {
      setMsgOk(false);
      setMsg("新密码不能与旧密码相同");
      return;
    }

    setLoading(true);
    try {
      const pubResp = await api.getPubkey();
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(pubResp.public_key);

      const oldEncrypted = encrypt.encrypt(oldP);
      const newEncrypted = encrypt.encrypt(newP);
      if (!oldEncrypted || !newEncrypted) {
        setMsgOk(false);
        setMsg("密码加密失败，请重试");
        setLoading(false);
        return;
      }

      await api.changePassword({
        old_encrypted_password: oldEncrypted,
        new_encrypted_password: newEncrypted,
      });

      setMsgOk(true);
      setMsg("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMsgOk(false);
      setMsg(err.message ?? "修改失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      class="settings-content"
      style="text-align: left; padding: 20px; margin-top: 24px;"
    >
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          "border-radius": "var(--radius)",
          padding: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "10px",
            "margin-bottom": "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              "border-radius": "8px",
              background: "#22c55e18",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
            }}
          >
            <ShieldCheck size={18} color="#22c55e" />
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 600;">账号安全</div>
          </div>
        </div>

        <button
          class="save-btn"
          onClick={() => setShowForm(true)}
          style="display: flex; align-items: center; gap: 6px"
        >
          <Lock size={16} />
          修改密码
        </button>
      </div>

      <Show when={showForm()}>
        <div class="modal-overlay" onClick={reset}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h2>修改密码</h2>

            <div class="form-group">
              <label>旧密码</label>
              <div style="display:flex;gap:6px;align-items:center">
                <input
                  type={showOld() ? "text" : "password"}
                  placeholder="输入旧密码"
                  value={oldPassword()}
                  onInput={(e) => setOldPassword(e.currentTarget.value)}
                  autocomplete="current-password"
                />
                <button
                  class="header-icon-btn"
                  onClick={() => setShowOld(!showOld())}
                  title={showOld() ? "隐藏" : "显示"}
                >
                  <Show when={showOld()} fallback={<Eye size={16} />}>
                    <EyeOff size={16} />
                  </Show>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>新密码</label>
              <div style="display:flex;gap:6px;align-items:center">
                <input
                  type={showNew() ? "text" : "password"}
                  placeholder="输入新密码（至少 6 位）"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  autocomplete="new-password"
                />
                <button
                  class="header-icon-btn"
                  onClick={() => setShowNew(!showNew())}
                  title={showNew() ? "隐藏" : "显示"}
                >
                  <Show when={showNew()} fallback={<Eye size={16} />}>
                    <EyeOff size={16} />
                  </Show>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>确认新密码</label>
              <div style="display:flex;gap:6px;align-items:center">
                <input
                  type={showConfirm() ? "text" : "password"}
                  placeholder="再次输入新密码"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  autocomplete="new-password"
                />
                <button
                  class="header-icon-btn"
                  onClick={() => setShowConfirm(!showConfirm())}
                  title={showConfirm() ? "隐藏" : "显示"}
                >
                  <Show when={showConfirm()} fallback={<Eye size={16} />}>
                    <EyeOff size={16} />
                  </Show>
                </button>
              </div>
            </div>

            {msg() && (
              <p
                style={`margin: 8px 0 0; font-size: 13px; color: ${
                  msgOk() ? "var(--success, #22c55e)" : "var(--danger, #ef4444)"
                }`}
              >
                {msg()}
              </p>
            )}

            <div class="modal-actions">
              <button class="icon-btn" onClick={reset} disabled={loading()}>
                取消
              </button>
              <button
                class="btn-primary"
                onClick={handleChange}
                disabled={loading()}
              >
                {loading() ? "提交中..." : "确认修改"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function Changelog() {
  const [html, setHtml] = createSignal("");

  onMount(async () => {
    try {
      const { marked } = await import("marked");
      const res = await fetch("/CHANGELOG.md");
      const md = await res.text();
      setHtml(await marked(md));
    } catch (err) {
      setHtml('<p style="color: var(--text-secondary)">无法加载更新日志</p>');
    }
  });

  return <div class="markdown-body" innerHTML={html()} />;
}
