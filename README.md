# Rino Todo

> 简洁高效的待办清单应用 — 支持 AI 智能助手、多视图切换、多端同步。

<p align="center">
  <img src="https://img.shields.io/badge/Rust-1.80+-orange?logo=rust" />
  <img src="https://img.shields.io/badge/SolidJS-1.9+-blue?logo=solid" />
  <img src="https://img.shields.io/badge/Tauri-2.0-ffc131?logo=tauri" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql" />
</p>

## 功能亮点

| 功能 | 说明 |
|---|---|
| AI 智能助手 | 自然语言创建任务、一键拆解子任务、7 天总结、今日概览（DeepSeek 驱动） |
| 灵活任务管理 | 无限嵌套子任务、标签分类、优先级、Markdown 笔记、自定义过滤器 |
| 多视图切换 | 列表、日历、四象限、甘特图，按需切换 |
| 多端同步 | 本地优先架构（IndexedDB），自动与远端 PostgreSQL 同步 |
| 主题系统 | 亮/暗模式、8 色主题色、自定义背景图 + 模糊强度 |
| 隐私安全 | RSA 端到端加密登录，API Key 仅存本地浏览器 |
| 跨平台 | Web + Tauri 桌面应用，Windows / macOS / Linux |
| Markdown 笔记 | 清单可切换为笔记模式，支持 GitHub Flavored Markdown |

## 项目架构

```
RinoTodo/
├── backend/              # Rust Axum API 服务
│   └── src/
│       ├── handlers/     # auth, project, task, tag, sync, server, user
│       ├── models.rs     # Diesel ORM 模型
│       └── main.rs       # 入口
├── frontend/             # SolidJS + Vite 前端
│   └── src/
│       ├── components/   # UI 组件
│       ├── api/          # API 客户端 + AI Agent
│       ├── db/           # IndexedDB 本地存储
│       ├── store.ts      # 全局状态 + 同步引擎
│       └── sync.ts       # Pull/Push 同步
├── shared/               # Rust 共享类型（Serde）
├── src-tauri/            # Tauri 桌面壳
└── build.ps1 / build.sh  # 构建脚本
```

## 快速开始

### 环境要求

- [Rust](https://rustup.rs/) 1.80+
- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 15+
- [Tauri CLI](https://v2.tauri.app/) (桌面构建)

### 1. 初始化数据库

```sql
CREATE DATABASE rinotodo;
```

### 2. 配置后端

```bash
cd backend
cp .env.example .env
```

编辑 `.env`：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/rinotodo
JWT_SECRET=your-secret-key
RSA_PRIVATE_KEY=your-rsa-private-key
```

### 3. 启动后端

```bash
cargo run -p backend
# 服务启动在 http://127.0.0.1:3000
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
# 开发服务器启动在 http://localhost:1420
```

### 5. 桌面构建（可选）

```bash
# Windows
.\build.ps1

# Linux
./build.sh
```

## AI 助手配置

Rino Todo 集成 **DeepSeek** AI，提供智能任务管理。

1. 前往 [platform.deepseek.com](https://platform.deepseek.com) 获取 API Key
2. 登录后进入 **设置 -> AI 助手**
3. 粘贴 Key，选择模型（V4 Flash 推荐），保存

**可用功能：**

- **智能解析** — 快速添加栏输入自然语言，Enter 自动识别日期/优先级/标签
- **任务拆解** — 任务详情中点击 AI 按钮，基于描述自动生成子任务
- **今日概览** — AI 分析今日任务，给出优先级建议
- **7 天总结** — 自动生成周报，结果本地缓存

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET/POST | `/api/tasks` | 任务列表/创建 |
| PATCH/DELETE | `/api/tasks/:id` | 更新/删除任务 |
| GET/POST | `/api/projects` | 清单列表/创建 |
| PATCH/DELETE | `/api/projects/:id` | 更新/删除清单 |
| GET/POST | `/api/tags` | 标签列表/创建 |
| GET/PATCH | `/api/user` | 用户设置 |
| GET | `/api/sync/pull` | 拉取同步数据 |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | SolidJS + Vite |
| 桌面壳 | Tauri 2 |
| 后端 | Rust + Axum |
| 数据库 | PostgreSQL + Diesel ORM |
| 本地存储 | IndexedDB |
| 图标 | Lucide |
| Markdown | marked + github-markdown-css |
| 甘特图 | dhtmlx-gantt |
| 加密 | RSA + bcrypt + JWT |

## License

MIT
