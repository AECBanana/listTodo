import { createSignal, Show } from "solid-js";
import { JSEncrypt } from "jsencrypt";
import * as api from "../api/client";
import { store } from "../store";
import { ClipboardList } from "lucide-solid";

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

  return (
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <ClipboardList size={40} strokeWidth={1.5} />
        </div>
        <h1>ListTodo</h1>
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
