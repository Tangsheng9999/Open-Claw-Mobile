// OpenClaw CLI 桥接（基于 v2026.4.22 真实命令面）
//
// 设计原则：
// 1. 结构化数据优先 — `openclaw status --json` 是黄金来源
// 2. 直读 JSON 文件（sessions.json / models.json）做加速与降级
// 3. CLI 文本输出作为最后兜底
// 4. 系统级操作（重启网关、升级）降级链：openclaw <cmd> → systemctl → 失败提示

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { existsSync, statfsSync } from "node:fs"
import type {
  AgentInfo,
  ClawStatus,
  Conversation,
  GatewayStatus,
  ModelInfo,
  ModelTestResult,
  Project,
  SystemMetrics,
} from "./types.js"

const execFileAsync = promisify(execFile)

const BIN = process.env.OPENCLAW_BIN ?? "openclaw"
const HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw")
const BRIDGE_VERSION = "0.2.0"
const GATEWAY_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT ?? 18789)
const SYSTEMD_UNIT = process.env.OPENCLAW_SYSTEMD_UNIT ?? "openclaw-gateway"
const DEFAULT_AGENT = process.env.OPENCLAW_DEFAULT_AGENT ?? "main"

// === 通用 helpers ===

async function runCli(args: string[], timeoutMs = 10_000): Promise<string> {
  const { stdout } = await execFileAsync(BIN, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 })
  return stdout.toString().trim()
}

/** 跑 CLI 后从输出里抓第一段 JSON（OpenClaw 的子命令偶尔会有 emoji banner）。 */
async function runCliJson<T>(args: string[], timeoutMs = 8_000): Promise<T | null> {
  try {
    const out = await runCli(args, timeoutMs)
    const start = out.indexOf("{")
    const end = out.lastIndexOf("}")
    if (start < 0 || end < start) return null
    return JSON.parse(out.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

// === 版本与可用性 ===

let versionCache: { v: string | null; ts: number } | null = null
export async function getOpenclawVersion(): Promise<string | null> {
  if (versionCache && Date.now() - versionCache.ts < 60_000) return versionCache.v
  try {
    // openclaw --version 输出形如: "OpenClaw 2026.4.22 (00bd2cf)"
    const out = await runCli(["--version"], 3000)
    versionCache = { v: out, ts: Date.now() }
    return out
  } catch {
    versionCache = { v: null, ts: Date.now() }
    return null
  }
}

let installedCache: boolean | null = null
async function detectInstalled(): Promise<boolean> {
  if (installedCache !== null) return installedCache
  installedCache = !!(await getOpenclawVersion())
  return installedCache
}

// === Status JSON 缓存（2 秒 TTL，避免短时间多次调 CLI 拖慢） ===

interface OpenclawStatusJson {
  runtimeVersion?: string
  heartbeat?: { defaultAgentId?: string; agents?: Array<{ agentId: string; enabled: boolean; everyMs: number }> }
  channelSummary?: Array<unknown>
  queuedSystemEvents?: Array<unknown>
  tasks?: {
    total?: number
    active?: number
    terminal?: number
    failures?: number
    byStatus?: Record<string, number>
    byRuntime?: Record<string, number>
  }
  taskAudit?: { total?: number; warnings?: number; errors?: number; byCode?: Record<string, number> }
  sessions?: {
    paths?: string[]
    count?: number
    defaults?: { model?: string; contextTokens?: number }
    recent?: Array<Record<string, unknown>>
  }
}

let statusCache: { ts: number; data: OpenclawStatusJson } | null = null
export async function getRawStatus(): Promise<OpenclawStatusJson> {
  const now = Date.now()
  if (statusCache && now - statusCache.ts < 2000) return statusCache.data
  const data = (await runCliJson<OpenclawStatusJson>(["status", "--json"], 8000)) ?? {}
  statusCache = { ts: now, data }
  return data
}

// === AgentInfo ===

export async function getAgentInfo(): Promise<AgentInfo> {
  const [version, installed] = await Promise.all([getOpenclawVersion(), detectInstalled()])
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSec: Math.floor(os.uptime()),
    bridgeVersion: BRIDGE_VERSION,
    openclawVersion: version,
    openclawInstalled: installed,
  }
}

// === SystemMetrics（不依赖 OpenClaw） ===

function getDiskUsage(): { usedGb: number; totalGb: number } {
  try {
    const target = existsSync(HOME) ? HOME : os.homedir()
    const s = statfsSync(target)
    const totalBytes = s.blocks * s.bsize
    const freeBytes = s.bavail * s.bsize
    const usedBytes = totalBytes - freeBytes
    return {
      usedGb: +(usedBytes / 1024 ** 3).toFixed(2),
      totalGb: +(totalBytes / 1024 ** 3).toFixed(2),
    }
  } catch {
    return { usedGb: 0, totalGb: 0 }
  }
}

let lastCpu = { idle: 0, total: 0 }
function getCpuPercent(): number {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    for (const t of Object.values(c.times)) total += t
    idle += c.times.idle
  }
  const idleDelta = idle - lastCpu.idle
  const totalDelta = total - lastCpu.total
  lastCpu = { idle, total }
  if (totalDelta <= 0) {
    const load = os.loadavg()[0]
    return Math.min(100, Math.round((load / cpus.length) * 100))
  }
  const pct = Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100))
  return +pct.toFixed(1)
}

export function getMetrics(): SystemMetrics {
  const total = os.totalmem()
  const free = os.freemem()
  const disk = getDiskUsage()
  const load = os.loadavg() as [number, number, number]
  return {
    cpuPercent: getCpuPercent(),
    memUsedMb: Math.round((total - free) / 1024 ** 2),
    memTotalMb: Math.round(total / 1024 ** 2),
    diskUsedGb: disk.usedGb,
    diskTotalGb: disk.totalGb,
    loadAvg: [+load[0].toFixed(2), +load[1].toFixed(2), +load[2].toFixed(2)],
  }
}

// === ClawStatus ===

async function probeGatewayHealth(): Promise<{ running: boolean; rpm: number; epm: number }> {
  // OpenClaw 的网关默认监听 127.0.0.1:18789。
  // 我们尝试常见的健康检查端点；任何返回 < 500 都视为存活。
  const candidates = ["/healthz", "/health", "/api/health", "/"]
  for (const p of candidates) {
    try {
      const ctrl = AbortSignal.timeout(1500)
      const r = await fetch(`http://127.0.0.1:${GATEWAY_PORT}${p}`, { signal: ctrl })
      if (r.status < 500) {
        let rpm = 0
        let epm = 0
        try {
          const stats = (await r.json()) as { requestsPerMin?: number; errorsPerMin?: number }
          rpm = Number(stats.requestsPerMin ?? 0)
          epm = Number(stats.errorsPerMin ?? 0)
        } catch {
          // 不是 JSON 也没事，能连上就够了
        }
        return { running: true, rpm, epm }
      }
    } catch {
      continue
    }
  }
  // 端口探活兜底
  try {
    const { stdout } = await execFileAsync("ss", ["-tlnp"], { timeout: 2000 })
    if (stdout.includes(`:${GATEWAY_PORT}`)) {
      return { running: true, rpm: 0, epm: 0 }
    }
  } catch {
    // ignore
  }
  return { running: false, rpm: 0, epm: 0 }
}

async function findOpenclawPid(): Promise<{ pid: number | null; startedAt: string | null }> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-x", "openclaw"], { timeout: 2000 })
    const pid = Number.parseInt(stdout.trim().split("\n")[0], 10)
    if (!pid) return { pid: null, startedAt: null }
    let startedAt: string | null = null
    try {
      const { stdout: ls } = await execFileAsync("ps", ["-p", String(pid), "-o", "lstart="], { timeout: 2000 })
      const d = new Date(ls.trim())
      if (!Number.isNaN(d.getTime())) startedAt = d.toISOString()
    } catch {
      // ignore
    }
    return { pid, startedAt }
  } catch {
    return { pid: null, startedAt: null }
  }
}

export async function getStatus(): Promise<ClawStatus> {
  const [raw, gateway, proc] = await Promise.all([
    getRawStatus().catch(() => ({} as OpenclawStatusJson)),
    probeGatewayHealth(),
    findOpenclawPid(),
  ])

  const tasks = raw.tasks ?? {}
  const sessions = raw.sessions ?? {}
  const heartbeats = raw.heartbeat?.agents ?? []
  const enabledHb = heartbeats.filter((h) => h.enabled).length

  const gatewayStatus: GatewayStatus = {
    running: gateway.running,
    port: GATEWAY_PORT,
    url: `http://127.0.0.1:${GATEWAY_PORT}`,
    requestsPerMin: gateway.rpm,
    errorsPerMin: gateway.epm,
  }

  return {
    running: proc.pid !== null,
    pid: proc.pid,
    startedAt: proc.startedAt,
    health: gateway.running ? "healthy" : proc.pid !== null ? "degraded" : "down",
    activeConversations: Number(sessions.count ?? 0),
    activeProjects: Number(tasks.active ?? 0),
    pendingHeartbeats: enabledHb,
    currentModel: sessions.defaults?.model ?? null,
    gateway: gatewayStatus,
  }
}

// === Conversations（来自 sessions.json） ===

interface RawSession {
  id?: string
  key?: string
  sessionId?: string
  title?: string
  model?: string
  status?: string
  channel?: string
  participant?: string
  lastMessage?: string
  last_message?: string
  lastMessageAt?: string
  updatedAt?: string
  lastActivityAt?: string
  tokensUsed?: number
  tokens?: number
  tokenCount?: number
  contextTokens?: number
}

const KNOWN_CHANNELS = new Set([
  "telegram",
  "discord",
  "whatsapp",
  "imessage",
  "slack",
  "mcp",
  "api",
  "web",
  "cli",
  "subagent",
  "cron",
  "explicit",
  "direct",
])

function sessionToConversation(s: RawSession, fallbackKey?: string): Conversation | null {
  if (!s) return null
  const id = String(s.id ?? s.sessionId ?? s.key ?? fallbackKey ?? Math.random().toString(36).slice(2, 10))
  const key = String(s.key ?? fallbackKey ?? id)
  const parts = key.split(":")

  // Key 形如 "agent:main:telegram:default:direct:2051401397"
  let channel = "cli"
  for (const p of parts) {
    if (KNOWN_CHANNELS.has(p)) {
      // 优先匹配真正的 chat channel
      if (["telegram", "discord", "whatsapp", "imessage", "slack", "mcp", "api", "web"].includes(p)) {
        channel = p
        break
      }
      channel = p
    }
  }

  const last = parts[parts.length - 1]
  let participant = "—"
  if (s.participant) participant = String(s.participant)
  else if (last && /^\d+$/.test(last)) participant = last
  else if (parts.length >= 3) participant = parts[parts.length - 1]

  const lastMsg = (s.lastMessage ?? s.last_message ?? "") as string
  const lastAt = String(s.lastMessageAt ?? s.updatedAt ?? s.lastActivityAt ?? new Date().toISOString())
  const tokens = Number(s.tokensUsed ?? s.tokens ?? s.tokenCount ?? s.contextTokens ?? 0)
  const status = (s.status ?? "idle") as Conversation["status"]

  return {
    id,
    title: s.title ? String(s.title) : key.split(":").slice(-2).join(":") || key,
    channel,
    participant,
    lastMessageAt: lastAt,
    lastMessagePreview: String(lastMsg).slice(0, 200),
    status: ["active", "idle", "waiting"].includes(status) ? status : "idle",
    model: String(s.model ?? "unknown"),
    tokenUsage: tokens,
  }
}

async function findSessionsPaths(): Promise<string[]> {
  // 1) status JSON 里直接给了路径
  const raw = await getRawStatus().catch(() => ({} as OpenclawStatusJson))
  const declared = raw.sessions?.paths ?? []
  const valid = declared.filter((p) => existsSync(p))
  if (valid.length > 0) return valid

  // 2) 兜底扫描 ~/.openclaw/agents/*/sessions/sessions.json
  const out: string[] = []
  try {
    const agentsDir = path.join(HOME, "agents")
    const entries = await readdir(agentsDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const f = path.join(agentsDir, e.name, "sessions", "sessions.json")
      if (existsSync(f)) out.push(f)
    }
  } catch {
    // ignore
  }
  return out
}

export async function listConversations(): Promise<Conversation[]> {
  const paths = await findSessionsPaths()
  const all: Conversation[] = []
  for (const file of paths) {
    try {
      const raw = JSON.parse(await readFile(file, "utf8"))
      // sessions.json 可能是 { sessions: {...} } / { sessions: [...] } / 直接对象 / 直接数组
      let entries: Array<[string, RawSession]> = []
      if (Array.isArray(raw)) {
        entries = raw.map((s, i) => [String((s as RawSession).id ?? `s${i}`), s as RawSession])
      } else if (Array.isArray((raw as { sessions?: unknown }).sessions)) {
        entries = (raw as { sessions: RawSession[] }).sessions.map((s, i) => [String(s.id ?? `s${i}`), s])
      } else if (raw && typeof raw === "object" && raw.sessions && typeof raw.sessions === "object") {
        entries = Object.entries(raw.sessions as Record<string, RawSession>)
      } else if (raw && typeof raw === "object") {
        entries = Object.entries(raw as Record<string, RawSession>)
      }
      for (const [key, s] of entries) {
        const conv = sessionToConversation(s, key)
        if (conv) all.push(conv)
      }
    } catch {
      // 跳过损坏的文件
    }
  }
  return all.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

// === Projects（映射到 OpenClaw "agents" 工作区） ===

export async function listProjects(): Promise<Project[]> {
  const dir = path.join(HOME, "agents")
  const out: Project[] = []
  // 先拿全局 task 摘要做填充
  const raw = await getRawStatus().catch(() => ({} as OpenclawStatusJson))
  const tasks = raw.tasks ?? {}
  const totalTasks = Number(tasks.total ?? 0)
  const activeTasks = Number(tasks.active ?? 0)
  const failedTasks = Number(tasks.failures ?? 0)

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const agentDir = path.join(dir, e.name)
      const st = await stat(agentDir).catch(() => null)
      let sessionsCount = 0
      const sessFile = path.join(agentDir, "sessions", "sessions.json")
      if (existsSync(sessFile)) {
        try {
          const data = JSON.parse(await readFile(sessFile, "utf8"))
          if (Array.isArray(data)) sessionsCount = data.length
          else if (Array.isArray(data.sessions)) sessionsCount = data.sessions.length
          else if (data.sessions && typeof data.sessions === "object")
            sessionsCount = Object.keys(data.sessions).length
          else sessionsCount = Object.keys(data).length
        } catch {
          // ignore
        }
      }

      const isMain = e.name === DEFAULT_AGENT
      out.push({
        id: e.name,
        name: e.name === "main" ? "主工作区 main" : e.name,
        description: `${sessionsCount} 个会话${isMain ? ` · ${totalTasks} 个任务（${activeTasks} 进行中）` : ""}`,
        status: failedTasks > 0 && isMain ? "failed" : activeTasks > 0 && isMain ? "running" : "queued",
        progress:
          isMain && totalTasks > 0 ? Math.round(((totalTasks - activeTasks) / totalTasks) * 100) : 0,
        startedAt: st?.birthtime?.toISOString?.() ?? new Date().toISOString(),
        lastActivityAt: st?.mtime?.toISOString?.() ?? new Date().toISOString(),
        tasksDone: isMain ? Math.max(0, totalTasks - activeTasks) : 0,
        tasksTotal: isMain ? totalTasks : sessionsCount,
      })
    }
  } catch {
    // ~/.openclaw/agents 不存在时返回空
  }
  return out
}

// === Models（直读 models.json） ===

interface OpenclawModelsJson {
  default?: string
  fallbacks?: string[]
  imageModel?: string
  imageFallbacks?: string[]
  aliases?: Record<string, string>
  models?:
    | Array<{
        id: string
        provider?: string
        family?: string
        contextWindow?: number
        apiKey?: string
        baseUrl?: string
        isLocal?: boolean
      }>
    | Record<string, { provider?: string; family?: string; contextWindow?: number; apiKey?: string; baseUrl?: string; isLocal?: boolean }>
  providers?: Record<string, { apiKey?: string; baseUrl?: string }>
}

function findModelsPath(agentName = DEFAULT_AGENT): string | null {
  const guess = path.join(HOME, "agents", agentName, "agent", "models.json")
  return existsSync(guess) ? guess : null
}

async function readModelsJson(agentName = DEFAULT_AGENT): Promise<OpenclawModelsJson | null> {
  const file = findModelsPath(agentName)
  if (!file) return null
  try {
    return JSON.parse(await readFile(file, "utf8")) as OpenclawModelsJson
  } catch {
    return null
  }
}

export async function listModels(): Promise<ModelInfo[]> {
  const raw = await readModelsJson()
  // 同时从 status JSON 拿默认模型作为备份
  const status = await getRawStatus().catch(() => ({} as OpenclawStatusJson))
  const fallbackDefault = status.sessions?.defaults?.model ?? null
  if (!raw) {
    return fallbackDefault
      ? [
          {
            id: fallbackDefault,
            name: fallbackDefault.split("/").pop() ?? fallbackDefault,
            provider: fallbackDefault.split("/")[0] ?? "unknown",
            family: "remote",
            contextWindow: Number(status.sessions?.defaults?.contextTokens ?? 0),
            status: "ready",
            isDefault: true,
            isLocal: false,
          },
        ]
      : []
  }
  const defaultId = raw.default ?? fallbackDefault ?? null

  const entries: Array<[string, OpenclawModelsJson["models"] extends Array<infer T> ? T : never]> = []
  if (Array.isArray(raw.models)) {
    raw.models.forEach((m, i) => entries.push([m.id ?? `m${i}`, m as never]))
  } else if (raw.models && typeof raw.models === "object") {
    for (const [id, m] of Object.entries(raw.models)) entries.push([id, m as never])
  }

  return entries.map(([id, m]) => ({
    id,
    name: id.split("/").pop() ?? id,
    provider: String((m as { provider?: string }).provider ?? id.split("/")[0] ?? "unknown"),
    family: String((m as { family?: string }).family ?? (m as { provider?: string }).provider ?? "remote"),
    contextWindow: Number((m as { contextWindow?: number }).contextWindow ?? 0),
    status: "ready" as const,
    isDefault: id === defaultId,
    isLocal: !!(m as { isLocal?: boolean }).isLocal,
  }))
}

export async function setDefaultModel(id: string): Promise<{ ok: boolean }> {
  // 优先用 CLI（会触发 OpenClaw 自己的校验与 reload）
  try {
    await runCli(["config", "set", "default-model", id], 5000)
    return { ok: true }
  } catch {
    // CLI 路径不行就直改 JSON
    const file = findModelsPath()
    if (!file) return { ok: false }
    try {
      const raw = (await readModelsJson()) ?? {}
      const next: OpenclawModelsJson = { ...raw, default: id }
      await writeFile(file, JSON.stringify(next, null, 2))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }
}

export async function addModel(input: {
  provider: string
  id: string
  apiKey?: string
  baseUrl?: string
}): Promise<ModelInfo> {
  const file = findModelsPath()
  if (file) {
    try {
      const raw = (await readModelsJson()) ?? {}
      const next: OpenclawModelsJson = { ...raw }
      const newEntry = {
        provider: input.provider,
        ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
      }
      if (Array.isArray(next.models)) {
        next.models = [...next.models, { id: input.id, ...newEntry }]
      } else {
        next.models = { ...(next.models ?? {}), [input.id]: newEntry }
      }
      await writeFile(file, JSON.stringify(next, null, 2))
    } catch {
      // 写失败也返回乐观 UI 数据，让前端立刻反馈
    }
  }
  return {
    id: input.id,
    name: input.id.split("/").pop() ?? input.id,
    provider: input.provider,
    family: input.provider,
    contextWindow: 0,
    status: "ready",
    isDefault: false,
    isLocal: input.provider === "ollama" || input.provider === "llamacpp",
  }
}

export async function removeModel(id: string): Promise<{ ok: boolean }> {
  const file = findModelsPath()
  if (!file) return { ok: false }
  try {
    const raw = (await readModelsJson()) ?? {}
    const next: OpenclawModelsJson = { ...raw }
    if (Array.isArray(next.models)) {
      next.models = next.models.filter((m) => m.id !== id)
    } else if (next.models && typeof next.models === "object") {
      const obj = { ...next.models }
      delete obj[id]
      next.models = obj
    }
    if (next.default === id) delete next.default
    await writeFile(file, JSON.stringify(next, null, 2))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function pullModel(id: string): Promise<{ ok: boolean; message: string }> {
  // OpenClaw 模型基本都是远程 API（windhub / anthropic / nvidia 等），不需要本地下载。
  // 我们用一次轻量级 ping 验证：能调通 = 这个模型可用。
  const test = await testModel(id, "ping")
  if (test.ok) return { ok: true, message: `${id} 可用，响应延迟 ${test.latencyMs} ms。` }
  return {
    ok: false,
    message: `${id} 当前不可达：${test.error ?? "未知错误"}`,
  }
}

export async function testModel(id: string, prompt = "Say hi in five words."): Promise<ModelTestResult> {
  const start = Date.now()
  // OpenClaw 把推理放在 `infer` 子命令族下（probe 看到的 help 列出了 `infer *`）
  // 不同版本可能有 `infer chat` / `infer once` / `capability run` 等子命令；尝试多种再放弃
  const attempts: string[][] = [
    ["infer", "chat", "--model", id, "--prompt", prompt, "--no-stream"],
    ["infer", "once", "--model", id, "--prompt", prompt],
    ["capability", "run", "--model", id, "--prompt", prompt],
    ["agent", "--model", id, "--once", prompt],
  ]
  let lastError: string | null = null
  for (const args of attempts) {
    try {
      const out = await runCli(args, 30_000)
      return {
        modelId: id,
        ok: true,
        latencyMs: Date.now() - start,
        sample: out.slice(0, 200),
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      continue
    }
  }
  return {
    modelId: id,
    ok: false,
    latencyMs: Date.now() - start,
    error: lastError ?? "未找到可用的 openclaw infer 子命令",
  }
}

// === 系统操作（多级降级） ===

async function trySystemctl(action: "restart" | "stop" | "start"): Promise<{ ok: boolean; output: string }> {
  // 优先 systemd，最后才考虑 sudo
  const candidates: Array<[string, string[]]> = [
    ["systemctl", [action, SYSTEMD_UNIT]],
    ["systemctl", ["--user", action, SYSTEMD_UNIT]],
    ["sudo", ["-n", "systemctl", action, SYSTEMD_UNIT]],
  ]
  let lastErr = ""
  for (const [cmd, args] of candidates) {
    try {
      const { stdout } = await execFileAsync(cmd, args, { timeout: 30_000 })
      return { ok: true, output: stdout.trim() || `${cmd} ${args.join(" ")} 成功` }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      continue
    }
  }
  return { ok: false, output: `systemctl ${action} ${SYSTEMD_UNIT} 失败：${lastErr}` }
}

export async function restartGateway(): Promise<{ ok: boolean; output: string }> {
  // 1) 先试 OpenClaw 自带的命令
  try {
    const out = await runCli(["gateway", "restart"], 30_000)
    return { ok: true, output: out || "openclaw gateway restart 成功" }
  } catch {
    // 2) 降级到 systemctl
    const r = await trySystemctl("restart")
    if (!r.ok) {
      r.output += "\n提示：bridge 进程需要 sudoers NOPASSWD 或归属能管理该 unit 的用户。"
    }
    return r
  }
}

export async function restartClaw(): Promise<{ ok: boolean; output: string }> {
  // OpenClaw 主进程在 probe 看到时是 daemon-like —— 重启网关就够了
  return restartGateway()
}

export async function upgradeOpenclaw(): Promise<{ ok: boolean; output: string }> {
  // OpenClaw 安装路径多样（/bin/openclaw 通常是脚本或 npm 链接）。
  // 顺序尝试：自带的 self-update / upgrade → npm 全局升级
  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: BIN, args: ["self-update"] },
    { cmd: BIN, args: ["upgrade"] },
    { cmd: "npm", args: ["i", "-g", "openclaw@latest"] },
  ]
  for (const a of attempts) {
    try {
      const { stdout } = await execFileAsync(a.cmd, a.args, { timeout: 180_000 })
      installedCache = null
      versionCache = null
      return { ok: true, output: stdout.trim() || `${a.cmd} ${a.args.join(" ")} 完成` }
    } catch {
      continue
    }
  }
  return {
    ok: false,
    output:
      "自动升级失败：未找到 openclaw self-update / upgrade，也无法用 npm 全局更新。请在 VPS 上手动执行 OpenClaw 官方升级流程。",
  }
}

export async function clearCache(): Promise<{ ok: boolean; output: string }> {
  // 清理 7 天以前的 OpenClaw 临时日志（不会动 systemd 接管的 journal）
  try {
    const { stdout } = await execFileAsync(
      "sh",
      ["-c", `find /tmp/openclaw -type f -name "*.log" -mtime +7 -print -delete 2>/dev/null | wc -l`],
      { timeout: 10_000 },
    )
    const n = Number.parseInt(stdout.trim(), 10) || 0
    return { ok: true, output: `已清理 ${n} 个 7 天前的 OpenClaw 日志文件` }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function stopOpenclaw(): Promise<{ ok: boolean; output: string }> {
  return trySystemctl("stop")
}
