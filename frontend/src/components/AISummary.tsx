import { createSignal, Show, onMount } from "solid-js";
import { store } from "../store";
import {
  dailyOverview,
  weeklySummary,
  getAgentSettings,
  type DailyOverview,
  type WeeklySummary,
} from "../api/agent";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  CalendarCheck,
  BarChart3,
  Play,
} from "lucide-solid";

// ---- 本地缓存 key ----
const CACHE_KEY_DAILY = "ai_cache_daily";
const CACHE_KEY_WEEKLY = "ai_cache_weekly";

interface CacheEntry<T> {
  data: T;
  date: string; // "2026-05-27"
  time: string; // "14:30"
  taskCount: number;
}

function loadCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache<T>(key: string, data: T, taskCount: number) {
  const now = new Date();
  const entry: CacheEntry<T> = {
    data,
    date: now.toISOString().slice(0, 10),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    taskCount,
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

export default function AISummary() {
  const [loading, setLoading] = createSignal(false);
  const [mode, setMode] = createSignal<"daily" | "weekly">("daily");
  const [daily, setDaily] = createSignal<DailyOverview | null>(null);
  const [weekly, setWeekly] = createSignal<WeeklySummary | null>(null);
  const [error, setError] = createSignal("");
  const [dailyCache, setDailyCache] =
    createSignal<CacheEntry<DailyOverview> | null>(null);
  const [weeklyCache, setWeeklyCache] =
    createSignal<CacheEntry<WeeklySummary> | null>(null);

  // 初始化：加载缓存
  onMount(() => {
    setDailyCache(loadCache<DailyOverview>(CACHE_KEY_DAILY));
    setWeeklyCache(loadCache<WeeklySummary>(CACHE_KEY_WEEKLY));
  });

  const hasKey = () => {
    const s = getAgentSettings();
    return !!s?.apiKey;
  };

  // 今日任务 & 过期任务
  const todayStr = new Date().toISOString().slice(0, 10);
  const allTasks = () => store.tasks() || [];

  const todayTasks = () =>
    allTasks().filter((t) => {
      if (t.completed && t.kind !== "note") return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date).toISOString().slice(0, 10);
      return d === todayStr;
    });

  const overdueTasks = () =>
    allTasks().filter((t) => {
      if (t.completed) return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date).toISOString().slice(0, 10);
      return d < todayStr;
    });

  const weekCompleted = () => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    return allTasks().filter((t) => {
      if (!t.completed) return false;
      const done = t.completed_at ? new Date(t.completed_at).getTime() : 0;
      return done >= weekAgo && done <= now;
    });
  };

  const weekCreated = () => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    return allTasks().filter((t) => {
      const created = new Date(t.created_at).getTime();
      return created >= weekAgo && created <= now;
    }).length;
  };

  // 是否已分析过今天
  const isTodayCached = () => dailyCache()?.date === todayStr;
  // 是否已分析过本周（按周判断）
  const isThisWeekCached = () => {
    const c = weeklyCache();
    if (!c) return false;
    const cachedDate = new Date(c.date);
    const now = new Date();
    // 同一年同一周
    const getWeek = (d: Date) => {
      const start = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(
        ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7,
      );
    };
    return (
      getWeek(cachedDate) === getWeek(now) &&
      cachedDate.getFullYear() === now.getFullYear()
    );
  };

  async function analyzeDaily() {
    if (!hasKey()) {
      setError("请先在设置中配置 DeepSeek API Key");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await dailyOverview(
        todayTasks(),
        overdueTasks(),
        store.projects() || [],
      );
      setDaily(result);
      saveCache(
        CACHE_KEY_DAILY,
        result,
        todayTasks().length + overdueTasks().length,
      );
      setDailyCache(loadCache<DailyOverview>(CACHE_KEY_DAILY));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeWeekly() {
    if (!hasKey()) {
      setError("请先在设置中配置 DeepSeek API Key");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await weeklySummary(weekCompleted(), weekCreated());
      setWeekly(result);
      saveCache(CACHE_KEY_WEEKLY, result, weekCompleted().length);
      setWeeklyCache(loadCache<WeeklySummary>(CACHE_KEY_WEEKLY));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="main-area">
      <div class="task-list">
        <div class="task-header">
          <h1>AI 助手</h1>
        </div>

        <Show when={!hasKey()}>
          <div class="ai-empty">
            <Sparkles size={40} strokeWidth={1.5} class="empty-icon" />
            <p>请先在 设置 → AI 助手 中配置 DeepSeek API Key</p>
          </div>
        </Show>

        <Show when={hasKey()}>
          {/* Tab 切换 */}
          <div style="display:flex;gap:8px;margin-bottom:20px">
            <button
              class="ai-tab"
              classList={{ active: mode() === "daily" }}
              onClick={() => setMode("daily")}
            >
              <CalendarCheck size={16} strokeWidth={2} />
              今日概览
            </button>
            <button
              class="ai-tab"
              classList={{ active: mode() === "weekly" }}
              onClick={() => setMode("weekly")}
            >
              <BarChart3 size={16} strokeWidth={2} />
              7天总结
            </button>
          </div>

          {/* 加载中 */}
          <Show when={loading()}>
            <div class="ai-loading">
              <Loader2 size={24} strokeWidth={2} class="animate-spin" />
              <span>AI 分析中...</span>
            </div>
          </Show>

          {/* 错误 */}
          <Show when={error() && !loading()}>
            <div class="ai-error">
              <p>{error()}</p>
              <button
                class="btn-secondary"
                onClick={() =>
                  mode() === "daily" ? analyzeDaily() : analyzeWeekly()
                }
              >
                <RefreshCw size={14} strokeWidth={2} />
                重试
              </button>
            </div>
          </Show>

          {/* 今日概览 */}
          <Show when={mode() === "daily" && !loading()}>
            <Show
              when={daily()}
              fallback={
                <Show when={isTodayCached() && dailyCache()}>
                  {/* 有今日缓存且无新数据，展示缓存 */}
                  <DailyCard
                    data={dailyCache()!.data}
                    todayCount={todayTasks().length}
                    overdueCount={overdueTasks().length}
                    cacheTime={dailyCache()!.time}
                    onAnalyze={analyzeDaily}
                  />
                </Show>
              }
            >
              <DailyCard
                data={daily()!}
                todayCount={todayTasks().length}
                overdueCount={overdueTasks().length}
                cacheTime={dailyCache()?.time}
                onAnalyze={analyzeDaily}
              />
            </Show>

            {/* 无缓存且无数据，显示分析按钮 */}
            <Show when={!daily() && !isTodayCached()}>
              <div class="ai-start">
                <p class="ai-start-hint">
                  点击下方按钮，AI 将分析今日任务并给出建议
                </p>
                <button class="ai-analyze-btn" onClick={analyzeDaily}>
                  <Play size={18} strokeWidth={2} />
                  开始分析
                </button>
              </div>
            </Show>
          </Show>

          {/* 7天总结 */}
          <Show when={mode() === "weekly" && !loading()}>
            <Show
              when={weekly()}
              fallback={
                <Show when={isThisWeekCached() && weeklyCache()}>
                  <WeeklyCard
                    data={weeklyCache()!.data}
                    createdCount={weekCreated()}
                    completedCount={weekCompleted().length}
                    cacheTime={weeklyCache()!.time}
                    onAnalyze={analyzeWeekly}
                  />
                </Show>
              }
            >
              <WeeklyCard
                data={weekly()!}
                createdCount={weekCreated()}
                completedCount={weekCompleted().length}
                cacheTime={weeklyCache()?.time}
                onAnalyze={analyzeWeekly}
              />
            </Show>

            <Show when={!weekly() && !isThisWeekCached()}>
              <div class="ai-start">
                <p class="ai-start-hint">
                  点击下方按钮，AI 将分析过去7天的任务完成情况
                </p>
                <button class="ai-analyze-btn" onClick={analyzeWeekly}>
                  <Play size={18} strokeWidth={2} />
                  开始分析
                </button>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}

// ---- 今日概览卡片 ----
function DailyCard(props: {
  data: DailyOverview;
  todayCount: number;
  overdueCount: number;
  cacheTime?: string;
  onAnalyze: () => void;
}) {
  return (
    <AiCard cacheTime={props.cacheTime} onRefresh={props.onAnalyze}>
      <div class="ai-section">
        <div class="ai-label">概览</div>
        <p class="ai-summary">{props.data.summary}</p>
      </div>
      <div class="ai-section">
        <div class="ai-label">数据</div>
        <div class="ai-stats-row">
          <div class="ai-stat">
            <span class="ai-stat-num">{props.todayCount}</span>
            <span class="ai-stat-label">今日任务</span>
          </div>
          <div class="ai-stat warn">
            <span class="ai-stat-num">{props.overdueCount}</span>
            <span class="ai-stat-label">已过期</span>
          </div>
        </div>
      </div>
      <div class="ai-section">
        <div class="ai-label">AI 建议</div>
        <ul class="ai-suggestions">
          {props.data.suggestions.map((s) => (
            <li>{s}</li>
          ))}
        </ul>
      </div>
    </AiCard>
  );
}

// ---- 7天总结卡片 ----
function WeeklyCard(props: {
  data: WeeklySummary;
  createdCount: number;
  completedCount: number;
  cacheTime?: string;
  onAnalyze: () => void;
}) {
  return (
    <AiCard cacheTime={props.cacheTime} onRefresh={props.onAnalyze}>
      <div class="ai-section">
        <div class="ai-label">概览</div>
        <p class="ai-summary">{props.data.summary}</p>
      </div>
      <div class="ai-section">
        <div class="ai-label">数据</div>
        <p class="ai-stats-big">{props.data.stats}</p>
        <div class="ai-stats-row" style="margin-top:12px">
          <div class="ai-stat">
            <span class="ai-stat-num">{props.createdCount}</span>
            <span class="ai-stat-label">新建任务</span>
          </div>
          <div class="ai-stat done">
            <span class="ai-stat-num">{props.completedCount}</span>
            <span class="ai-stat-label">已完成</span>
          </div>
        </div>
      </div>
      <Show when={props.data.highlights.length > 0}>
        <div class="ai-section">
          <div class="ai-label">亮点</div>
          <ul class="ai-suggestions highlights">
            {props.data.highlights.map((h) => (
              <li>{h}</li>
            ))}
          </ul>
        </div>
      </Show>
      <Show when={props.data.suggestions.length > 0}>
        <div class="ai-section">
          <div class="ai-label">改进建议</div>
          <ul class="ai-suggestions">
            {props.data.suggestions.map((s) => (
              <li>{s}</li>
            ))}
          </ul>
        </div>
      </Show>
    </AiCard>
  );
}

// 卡片容器（含缓存时间戳 + 刷新按钮）
function AiCard(props: {
  children: any;
  cacheTime?: string;
  onRefresh: () => void;
}) {
  return (
    <div class="ai-card">
      <div class="ai-card-top">
        {props.cacheTime && (
          <span class="ai-cache-time">分析于 {props.cacheTime}</span>
        )}
        <button
          class="ai-refresh-btn"
          onClick={props.onRefresh}
          title="重新分析"
        >
          <RefreshCw size={14} strokeWidth={2} />
        </button>
      </div>
      {props.children}
    </div>
  );
}
