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

// 离线/未连接时展示的 Demo 数据，让 UI 始终是「有内容」的状态。
// 这些数据按 OpenClaw 2026.4.22 的真实 schema 仿造（来自 probe.sh 实测）。

export const mockAgentInfo: AgentInfo = {
  hostname: "claw-vps-01",
  platform: "linux",
  arch: "arm64",
  uptimeSec: 60 * 60 * 100 + 14 * 60,
  bridgeVersion: "0.2.0",
  openclawVersion: "OpenClaw 2026.4.22 (00bd2cf)",
  openclawInstalled: true,
}

export const mockMetrics: SystemMetrics = {
  cpuPercent: 8,
  memUsedMb: 1750,
  memTotalMb: 22 * 1024,
  diskUsedGb: 22,
  diskTotalGb: 30,
  loadAvg: [0.05, 0.12, 0.21],
}

export const mockStatus: ClawStatus = {
  running: true,
  pid: 6925,
  startedAt: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(),
  health: "healthy",
  activeConversations: 11,
  activeProjects: 0,
  pendingHeartbeats: 1,
  currentModel: "windhub/gpt-5.4",
  gateway: {
    running: true,
    port: 18789,
    url: "http://127.0.0.1:18789",
    requestsPerMin: 4,
    errorsPerMin: 0,
  },
}

export const mockConversations: Conversation[] = [
  {
    id: "agent:main:main",
    title: "agent:main:main",
    channel: "cli",
    participant: "shell",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    lastMessagePreview: "任务完成，3 个 case 通过，1 个等待你确认。",
    status: "active",
    model: "gpt-5.4",
    tokenUsage: 12000,
  },
  {
    id: "agent:main:explicit-test-session2",
    title: "explicit:test-session2",
    channel: "explicit",
    participant: "test-session2",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    lastMessagePreview: "回归测试样例待执行。",
    status: "idle",
    model: "gpt-5.4",
    tokenUsage: 0,
  },
  {
    id: "agent:main:subagent-2ec1a8",
    title: "subagent:2ec1a8",
    channel: "subagent",
    participant: "8b834fbc",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    lastMessagePreview: "子 Agent 完成代码审查。",
    status: "idle",
    model: "minimax-m2.5",
    tokenUsage: 8900,
  },
  {
    id: "agent:main:telegram-2051401397",
    title: "telegram:2051401397",
    channel: "telegram",
    participant: "2051401397",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    lastMessagePreview: "已经把日报推送给你了。",
    status: "waiting",
    model: "minimax-m2.5",
    tokenUsage: 11000,
  },
  {
    id: "agent:main:explicit-2051401397",
    title: "explicit:2051401397",
    channel: "explicit",
    participant: "2051401397",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    lastMessagePreview: "Telegram 消息默认转发完成。",
    status: "idle",
    model: "qwen3.5-397b-a17b",
    tokenUsage: 14000,
  },
]

// OpenClaw 没有「项目」概念 —— 这里映射为 agents 工作区
export const mockProjects: Project[] = [
  {
    id: "main",
    name: "主工作区 main",
    description: "11 个会话 · 4 个任务（0 进行中）",
    status: "queued",
    progress: 100,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    tasksDone: 4,
    tasksTotal: 4,
  },
]

export const mockHeartbeats: Heartbeat[] = [
  {
    id: "h1",
    timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
    source: "scheduler",
    message: "Agent main heartbeat tick — 间隔 30m",
    level: "info",
  },
  {
    id: "h2",
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    source: "gateway",
    message: "WebSocket Gateway 在线，监听 127.0.0.1:18789",
    level: "info",
  },
  {
    id: "h3",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    source: "model.windhub",
    message: "windhub 上游平均延迟 0.6s",
    level: "info",
  },
]

export const mockLogs: LogLine[] = [
  {
    ts: new Date(Date.now() - 1000 * 5).toISOString(),
    level: "info",
    source: "openclaw-gateway",
    message: "[gateway] heartbeat ok agents=1 sessions=11",
  },
  {
    ts: new Date(Date.now() - 1000 * 12).toISOString(),
    level: "info",
    source: "openclaw",
    message: "[scheduler] running heartbeat tick agent=main",
  },
  {
    ts: new Date(Date.now() - 1000 * 24).toISOString(),
    level: "info",
    source: "openclaw",
    message: "[sessions] persisted 11 sessions to /root/.openclaw/agents/main/sessions/sessions.json",
  },
  {
    ts: new Date(Date.now() - 1000 * 60).toISOString(),
    level: "info",
    source: "skills",
    message: "[infer] windhub/gpt-5.4 latency=612ms tokens=412",
  },
  {
    ts: new Date(Date.now() - 1000 * 90).toISOString(),
    level: "debug",
    source: "openclaw",
    message: "[memory] reindexed 0 new memories",
  },
]

// 来自 ~/.openclaw/agents/main/agent/models.json
export const mockModels: ModelInfo[] = [
  {
    id: "windhub/gpt-5.4",
    name: "gpt-5.4",
    provider: "windhub",
    family: "windhub",
    contextWindow: 200000,
    status: "ready",
    isDefault: true,
    isLocal: false,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    id: "windhub/gpt-5.2",
    name: "gpt-5.2",
    provider: "windhub",
    family: "windhub",
    contextWindow: 200000,
    status: "ready",
    isDefault: false,
    isLocal: false,
  },
  {
    id: "windhub/gpt-5.4-mini",
    name: "gpt-5.4-mini",
    provider: "windhub",
    family: "windhub",
    contextWindow: 128000,
    status: "ready",
    isDefault: false,
    isLocal: false,
  },
  {
    id: "windhub/gpt-5.3-codex",
    name: "gpt-5.3-codex",
    provider: "windhub",
    family: "windhub",
    contextWindow: 200000,
    status: "ready",
    isDefault: false,
    isLocal: false,
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

export const mockDiagnostics: DiagnosticItem[] = [
  { id: "bin", label: "OpenClaw CLI 可用", status: "pass", detail: "OpenClaw 2026.4.22 (00bd2cf)" },
  { id: "home", label: "数据目录可读写", status: "pass", detail: "/root/.openclaw" },
  {
    id: "memory",
    label: "内存使用率",
    status: "pass",
    detail: "已使用 8%（2G / 22G）",
  },
  {
    id: "disk",
    label: "磁盘空间",
    status: "warn",
    detail: "已使用 75%（/dev/mapper/ocivolume-root）",
    fixHint: "在系统页执行『清理缓存』",
  },
  {
    id: "gateway",
    label: "网关端口监听",
    status: "pass",
    detail: "127.0.0.1:18789 已监听",
  },
  {
    id: "network",
    label: "外网连通性",
    status: "pass",
    detail: "HTTP 200, 312 ms",
  },
  {
    id: "doctor-0",
    label: "OpenClaw doctor",
    status: "pass",
    detail: "openclaw doctor 全部检查通过",
  },
]
