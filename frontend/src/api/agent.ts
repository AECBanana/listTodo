// ============================================================
// AI Agent API — DeepSeek 驱动
// 自然语言解析 / 任务拆解 / 7天总结 / 今日概览
// ============================================================

import type { Priority, Task, Project } from "../types";

export interface AgentSettings {
  apiKey: string;
  model: string;
}

const DEFAULT_MODEL = "deepseek-v4-flash";
const BASE_URL = "https://api.deepseek.com/v1";

export interface ParsedTask {
  title: string;
  description?: string;
  priority?: Priority;
  due_date?: string;
  start_date?: string;
  tags?: string[];
  project_hint?: string;
}

export interface BreakdownResult {
  subtasks: string[];
}

// ---- localStorage 存取 ----
export function getAgentSettings(): AgentSettings | null {
  const raw = localStorage.getItem("ai_settings");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // 兼容旧格式（有 provider 字段）
    return {
      apiKey: parsed.apiKey || "",
      model: parsed.model || parsed.deepsync?.model || DEFAULT_MODEL,
    };
  } catch {
    return null;
  }
}

export function saveAgentSettings(s: AgentSettings) {
  localStorage.setItem("ai_settings", JSON.stringify(s));
}

function buildSettings(overrides?: Partial<AgentSettings>): AgentSettings {
  const saved = getAgentSettings();
  return {
    apiKey: overrides?.apiKey ?? saved?.apiKey ?? "",
    model: overrides?.model ?? saved?.model ?? DEFAULT_MODEL,
  };
}

// ---- 核心：调用 DeepSeek ----
async function chat(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1000,
): Promise<string> {
  const s = buildSettings();
  if (!s.apiKey) throw new Error("请先在设置中配置 DeepSeek API Key");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify({
      model: s.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${err}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");
  return content;
}

function cleanJson(s: string): string {
  return s
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
}

// ---- 自然语言 → 结构化任务 ----
const PARSE_PROMPT = `你是一个猫娘任务解析助手。用户用自然语言描述一个待办任务，提取结构化信息。

返回纯 JSON（不要 markdown 代码块）：
{"title":"任务标题","description":"描述(可选)","priority":"high/medium/low/none","due_date":"2026-05-28","start_date":"2026-05-25","tags":["标签1"],"project_hint":"清单名(可选)"}

规则：今天=${new Date().toISOString().slice(0, 10)}，明天=明天，"下周X"=下周对应日期，紧急/!!=high，#标签→tags`;

export async function parseTask(input: string): Promise<ParsedTask> {
  const content = await chat(PARSE_PROMPT, input);
  const parsed = JSON.parse(cleanJson(content));
  return {
    title: parsed.title || input,
    description: parsed.description || undefined,
    priority: parsed.priority || undefined,
    due_date: parsed.due_date || undefined,
    start_date: parsed.start_date || undefined,
    tags: parsed.tags || undefined,
    project_hint: parsed.project_hint || undefined,
  };
}

// ---- 智能任务拆解 ----
const BREAKDOWN_PROMPT = `你是猫娘任务拆解助手。把任务拆成3-8个可执行子任务。返回纯JSON：{"subtasks":["子任务1","子任务2"]}。子任务具体、有序、不含编号前缀。`;

export async function breakdownTask(
  title: string,
  description?: string,
): Promise<BreakdownResult> {
  let msg = `拆解："${title}"`;
  if (description) msg += `\n描述：${description}`;
  const content = await chat(BREAKDOWN_PROMPT, msg);
  return JSON.parse(cleanJson(content));
}

// ---- 今日概览 ----
export interface DailyOverview {
  summary: string;
  suggestions: string[];
}

const DAILY_PROMPT = `你是猫娘任务管理助手。用户会提供今天的待办任务列表和已过期任务。请给出简洁的建议。

返回纯JSON：{"summary":"一句话概览","suggestions":["建议1","建议2","建议3"]}

规则：
- summary 概括当前状态喵
- suggestions 3条，按优先级排序，每条不超过30字喵
- 考虑截止日期和优先级喵
- 中文输出喵`;

export async function dailyOverview(
  todayTasks: Task[],
  overdueTasks: Task[],
  projects: Project[],
): Promise<DailyOverview> {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const fmt = (t: Task) => {
    const proj = t.project_id ? projectMap.get(t.project_id) : null;
    const due = t.due_date
      ? ` 截止:${new Date(t.due_date).toLocaleDateString("zh-CN")}`
      : "";
    const tags = t.tags.length ? ` [${t.tags.join(",")}]` : "";
    return `- ${t.completed ? "✅" : "⬜"} ${t.title}${due}${tags}${proj ? ` @${proj}` : ""}`;
  };

  let msg = "";
  if (overdueTasks.length > 0) {
    msg += `⚠️ 已过期任务 (${overdueTasks.length})：\n${overdueTasks.map(fmt).join("\n")}\n\n`;
  }
  msg += `📋 今日任务 (${todayTasks.length})：\n${todayTasks.map(fmt).join("\n")}`;

  const content = await chat(DAILY_PROMPT, msg, 600);
  return JSON.parse(cleanJson(content));
}

// ---- 7天总结 ----
export interface WeeklySummary {
  summary: string;
  stats: string;
  highlights: string[];
  suggestions: string[];
}

const WEEKLY_PROMPT = `你是猫娘任务管理助手。用户提供过去7天的任务完成数据，请生成周报总结。

返回纯JSON：{"summary":"总体概述（30字内）","stats":"数据统计摘要（20字内）","highlights":["亮点1","亮点2"],"suggestions":["改进建议1","改进建议2"]}

规则：实用，中文输出喵`;

export async function weeklySummary(
  completedTasks: Task[],
  totalCreated: number,
): Promise<WeeklySummary> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const fmt = (t: Task) => {
    const done = t.completed_at
      ? new Date(t.completed_at).toLocaleDateString("zh-CN")
      : "?";
    return `- ${t.title} (完成于${done})`;
  };

  const msg = `过去7天 (${weekAgo.toLocaleDateString("zh-CN")} ~ ${today.toLocaleDateString("zh-CN")})：
共创建 ${totalCreated} 个任务，完成 ${completedTasks.length} 个。

已完成任务：
${completedTasks.map(fmt).join("\n")}`;

  const content = await chat(WEEKLY_PROMPT, msg, 800);
  return JSON.parse(cleanJson(content));
}
