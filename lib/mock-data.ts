import type {
  AgentInfo,
  ClawStatus,
  Conversation,
  DiagnosticItem,
  Heartbeat,
  LogLine,
  ModelInfo,
  Project,
  SystemMetrics,
} from "./types"

// Demo data shown when no Bridge Agent is connected, so the UI is always meaningful.
// Replaced 1:1 by real agent responses once configured.

export const mockAgentInfo: AgentInfo = {
  hostname: "claw-vps-01",
  platform: "linux",
  arch: "x64",
  uptimeSec: 60 * 60 * 73 + 14 * 60,
  bridgeVersion: "0.1.0",
  openclawVersion: "0.4.2",
  openclawInstalled: true,
}

export const mockMetrics: SystemMetrics = {
  cpuPercent: 18,
  memUsedMb: 1280,
  memTotalMb: 4096,
  diskUsedGb: 14.7,
  diskTotalGb: 80,
  loadAvg: [0.42, 0.38, 0.31],
}

export const mockStatus: ClawStatus = {
  running: true,
  pid: 21034,
  startedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  health: "healthy",
  activeConversations: 3,
  activeProjects: 2,
  pendingHeartbeats: 1,
  currentModel: "anthropic/claude-opus-4.6",
  gateway: {
    running: true,
    port: 8787,
    url: "http://127.0.0.1:8787",
    requestsPerMin: 14,
    errorsPerMin: 0,
  },
}

export const mockConversations: Conversation[] = [
  {
    id: "c1",
    title: "openclaw run · refactor auth",
    channel: "cli",
    participant: "shell",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    lastMessagePreview: "已经把测试跑完了，3 个 case 通过，1 个需要你确认。",
    status: "active",
    model: "anthropic/claude-opus-4.6",
    tokenUsage: 12480,
  },
  {
    id: "c2",
    title: "API · /v1/chat/completions",
    channel: "api",
    participant: "127.0.0.1",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    lastMessagePreview: "晚上 7 点的航班已经帮你 check-in，登机口 B12。",
    status: "idle",
    model: "openai/gpt-5-mini",
    tokenUsage: 3210,
  },
  {
    id: "c3",
    title: "MCP · Cursor IDE",
    channel: "mcp",
    participant: "cursor",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    lastMessagePreview: "在等你确认是否要把 PR 合并到 main。",
    status: "waiting",
    model: "anthropic/claude-opus-4.6",
    tokenUsage: 5640,
  },
  {
    id: "c4",
    title: "Web · /chat/abc123",
    channel: "web",
    participant: "browser",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
    lastMessagePreview: "好的，我来给你写一个完整的设计稿…",
    status: "idle",
    model: "google/gemini-3-flash",
    tokenUsage: 928,
  },
]

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "monitor-pwa",
    description: "为 OpenClaw 写一个手机端监控面板，跑通 WebSocket 实时推送。",
    status: "running",
    progress: 64,
    startedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    tasksDone: 9,
    tasksTotal: 14,
  },
  {
    id: "p2",
    name: "inbox-zero",
    description: "每小时扫一次未读邮件，自动归档营销邮件，重要邮件推送到 Telegram。",
    status: "running",
    progress: 100,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    tasksDone: 24,
    tasksTotal: 24,
  },
  {
    id: "p3",
    name: "whoop-daily-brief",
    description: "每天早上 7:30 拉取 WHOOP 数据并生成简报。",
    status: "queued",
    progress: 0,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    tasksDone: 0,
    tasksTotal: 5,
  },
]

export const mockHeartbeats: Heartbeat[] = [
  {
    id: "h1",
    timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
    source: "scheduler",
    message: "Heartbeat tick — 4 个 cron 任务待执行",
    level: "info",
  },
  {
    id: "h2",
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    source: "telegram",
    message: "收到来自 @you 的新消息，已分发到主 Agent",
    level: "info",
  },
  {
    id: "h3",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    source: "model.gateway",
    message: "上游 anthropic 接口延迟升高 (avg 1.4s)",
    level: "warn",
  },
]

export const mockLogs: LogLine[] = [
  {
    ts: new Date(Date.now() - 1000 * 5).toISOString(),
    level: "info",
    source: "openclaw",
    message: "[scheduler] running heartbeat #14823",
  },
  {
    ts: new Date(Date.now() - 1000 * 12).toISOString(),
    level: "info",
    source: "openclaw",
    message: "[telegram] message dispatched conv=c1 tokens=412",
  },
  {
    ts: new Date(Date.now() - 1000 * 24).toISOString(),
    level: "warn",
    source: "gateway",
    message: "[gateway] anthropic upstream slow (1.4s)",
  },
  {
    ts: new Date(Date.now() - 1000 * 60).toISOString(),
    level: "info",
    source: "skills",
    message: "[skill:gmail] processed 17 messages, archived 12",
  },
  {
    ts: new Date(Date.now() - 1000 * 90).toISOString(),
    level: "debug",
    source: "openclaw",
    message: "[memory] persisted 3 new memories to ~/.openclaw/memory.db",
  },
]

export const mockModels: ModelInfo[] = [
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    family: "claude",
    contextWindow: 200000,
    status: "ready",
    isDefault: true,
    isLocal: false,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    family: "gpt",
    contextWindow: 128000,
    status: "ready",
    isDefault: false,
    isLocal: false,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
  },
  {
    id: "ollama/minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "ollama",
    family: "minimax",
    contextWindow: 32768,
    status: "ready",
    sizeMb: 8420,
    isDefault: false,
    isLocal: true,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "ollama/qwen3-coder-30b",
    name: "Qwen3 Coder 30B",
    provider: "ollama",
    family: "qwen",
    contextWindow: 131072,
    status: "downloading",
    sizeMb: 18400,
    pullProgress: 42,
    isDefault: false,
    isLocal: true,
  },
  {
    id: "google/gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    family: "gemini",
    contextWindow: 1000000,
    status: "not_pulled",
    isDefault: false,
    isLocal: false,
  },
]

export const mockDiagnostics: DiagnosticItem[] = [
  { id: "d1", label: "OpenClaw CLI 可用", status: "pass", detail: "openclaw v0.4.2 在 PATH 中" },
  { id: "d2", label: "数据目录可读写", status: "pass", detail: "~/.openclaw 权限 0700" },
  { id: "d3", label: "网关端口监听", status: "pass", detail: "127.0.0.1:8787 LISTEN" },
  {
    id: "d4",
    label: "模型上游连通性",
    status: "warn",
    detail: "anthropic 平均延迟 1.4s（>1s 阈值）",
    fixHint: "检查上游 API key 和地理路由，必要时切换到 Vercel AI Gateway",
  },
  { id: "d5", label: "心跳调度器", status: "pass", detail: "最近一次 tick 30s 前，间隔 60s" },
  { id: "d6", label: "磁盘空间", status: "pass", detail: "65.3 GB 可用 / 80 GB" },
  {
    id: "d7",
    label: "系统更新",
    status: "warn",
    detail: "OpenClaw 有可用更新：0.4.2 → 0.4.5",
    fixHint: "在系统页执行『升级 OpenClaw』",
  },
]
