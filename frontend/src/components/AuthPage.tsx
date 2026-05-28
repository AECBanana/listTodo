import { createSignal, Show, For } from "solid-js";
import { JSEncrypt } from "jsencrypt";
import * as api from "../api/client";
import { store } from "../store";
import {
  ClipboardList,
  Sparkles,
  Calendar,
  Grid3x3,
  RefreshCw,
  ShieldCheck,
} from "lucide-solid";

export default function AuthPage() {
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [regOpen, setRegOpen] = createSignal(true);

  async function checkRegOpen() {
    try {
      const res = await api.getPublicSettings();
      setRegOpen(res.registration_open);
    } catch {
      setRegOpen(true);
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    const u = username().trim();
    const p = password();
    if (!u || !p) {
      setError("请填写用户名和密码");
      return;
    }
    setLoading(true);
    try {
      // 1. 获取公钥
      const pubResp = await api.getPubkey();
      // 2. RSA 加密密码
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(pubResp.public_key);
      const encrypted = encrypt.encrypt(p);
      if (!encrypted) {
        setError("密码加密失败");
        setLoading(false);
        return;
      }
      // 3. 登录 / 注册
      const body = { username: u, encrypted_password: encrypted };
      const authResp =
        mode() === "login" ? await api.login(body) : await api.register(body);
      store.doLogin(authResp.token, authResp.user);
    } catch (err: any) {
      setError(err.message ?? "操作失败");
    } finally {
      setLoading(false);
    }
  }

  const highlights = [
    {
      icon: Sparkles,
      title: "AI 智能助手",
      desc: "自然语言创建任务，一键拆解子任务，自动生成周报总结",
      color: "#8b5cf6",
    },
    {
      icon: ClipboardList,
      title: "灵活任务管理",
      desc: "无限嵌套子任务、标签分类、优先级标记、Markdown 笔记",
      color: "#4772fa",
    },
    {
      icon: Calendar,
      title: "多视图切换",
      desc: "列表、日历、四象限、甘特图，总有一个适合你",
      color: "#f59e0b",
    },
    {
      icon: RefreshCw,
      title: "多端同步",
      desc: "本地优先架构，自动同步，Web + 桌面双端可用",
      color: "#22c55e",
    },
    {
      icon: ShieldCheck,
      title: "隐私安全",
      desc: "RSA 端到端加密传输，数据掌握在自己手中",
      color: "#14b8a6",
    },
  ];

  return (
    <div class="auth-page">
      <div class="auth-hero">
        <div class="auth-hero-brand">
          <ClipboardList size={44} strokeWidth={1.5} class="auth-hero-icon" />
          <h1 class="auth-hero-title">RinoTodo</h1>
          <p class="auth-hero-sub">简洁高效的待办清单，让每一天都有条不紊</p>
        </div>
        <div class="auth-highlights">
          <For each={highlights}>
            {(h) => (
              <div class="auth-highlight-item">
                <div
                  class="auth-highlight-icon"
                  style={{ background: h.color + "18", color: h.color }}
                >
                  <h.icon size={20} strokeWidth={1.5} />
                </div>
                <div class="auth-highlight-text">
                  <strong>{h.title}</strong>
                  <span>{h.desc}</span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="auth-card">
        <h2>{mode() === "login" ? "登录" : "注册"}</h2>
        <Show when={mode() === "register" && !regOpen()}>
          <p class="error">注册功能已被管理员关闭</p>
        </Show>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="用户名"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            minLength={3}
            maxLength={32}
            autocomplete="username"
          />
          <input
            type="password"
            placeholder="密码"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            autocomplete={
              mode() === "login" ? "current-password" : "new-password"
            }
          />
          {error() && <p class="error">{error()}</p>}
          <button
            type="submit"
            disabled={loading() || (mode() === "register" && !regOpen())}
          >
            {loading() ? "请稍候..." : mode() === "login" ? "登录" : "注册"}
          </button>
        </form>
        <p class="switch">
          {mode() === "login" ? "没有账号？" : "已有账号？"}
          <button
            type="button"
            class="link"
            onClick={() => {
              setMode(mode() === "login" ? "register" : "login");
              setError("");
              if (mode() === "login") checkRegOpen();
            }}
          >
            {mode() === "login" ? "去注册" : "去登录"}
          </button>
        </p>
      </div>
    </div>
  );
}
