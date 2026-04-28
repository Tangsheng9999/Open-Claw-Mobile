// OpenClaw CLI 桥接：调用本地 openclaw 二进制并解析输出。
// 同时把系统指标采集放在这里，集中输出 PWA 端需要的所有形状。

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile, readdir, stat } from "node:fs/promises"
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
const BRIDGE_VERSION = "0.1.0"

async function runCli(args: string[], timeoutMs = 10_000): Promise<string> {
  const { stdout } = await execFileAsync(BIN, args, { timeout: timeoutMs })
  return stdout.trim()
}

let openclawInstalled: boolean | null = null
async function detectInstalled(): Promise<boolean> {
  if (openclawInstalled !== null) return openclawInstalled
  try {
    await runCli(["--version"], 3000)
    openclawInstalled = true
  } catch {
    openclawInstalled = false
  }
  return openclawInstalled
}

export async function getOpenclawVersion(): Promise<string | null> {
  try {
    return await runCli(["--version"], 3000)
  } catch {
    return null
  }
}

// ---------- AgentInfo ----------
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

// ---------- SystemMetrics ----------
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
    // 第一次采样：用 loadavg 估算
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

// ---------- ClawStatus ----------
async function readState(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(HOME, "state.json"), "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function getStatus(): Promise<ClawStatus> {
  const s = await readState()
  const installed = await detectInstalled()
  const gatewayPort = Number(s.gatewayPort ?? process.env.OPENCLAW_GATEWAY_PORT ?? 8788)
  const gatewayRunning = !!s.gatewayHealthy
  const gateway: GatewayStatus = {
    running: gatewayRunning,
    port: gatewayPort,
    url: `http://127.0.0.1:${gatewayPort}`,
    requestsPerMin: Number(s.requestsPerMin ?? 0),
    errorsPerMin: Number(s.errorsPerMin ?? 0),
  }
  const running = !!s.running || installed
  return {
    running,
    pid: typeof s.pid === "number" ? s.pid : null,
    startedAt: typeof s.startedAt === "string" ? s.startedAt : null,
    health: gatewayRunning ? "healthy" : running ? "degraded" : "down",
    activeConversations: Number(s.activeSessions ?? 0),
    activeProjects: Number(s.activeProjects ?? 0),
    pendingHeartbeats: Number(s.pendingHeartbeats ?? 0),
    currentModel: typeof s.defaultModel === "string" ? s.defaultModel : null,
    gateway,
  }
}

// ---------- Conversation ----------
export async function listConversations(): Promise<Conversation[]> {
  const dir = path.join(HOME, "sessions")
  const out: Conversation[] = []
  try {
    const files = await readdir(dir)
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(dir, f), "utf8")
        const s = JSON.parse(raw) as Record<string, unknown>
        const lastMsg =
          (Array.isArray(s.messages) && s.messages.length > 0
            ? (s.messages[s.messages.length - 1] as { content?: string }).content
            : "") ?? ""
        out.push({
          id: String(s.id ?? f.replace(".json", "")),
          title: String(s.title ?? "未命名会话"),
          channel: String(s.channel ?? "cli"),
          participant: String(s.participant ?? "—"),
          lastMessageAt: String(s.lastMessageAt ?? new Date().toISOString()),
          lastMessagePreview: String(lastMsg).slice(0, 200),
          status: (s.status as Conversation["status"]) ?? "idle",
          model: String(s.model ?? "unknown"),
          tokenUsage: Number(s.tokensUsed ?? 0),
        })
      } catch {
        // 跳过损坏的会话文件
      }
    }
  } catch {
    // sessions 目录不存在
  }
  return out.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

// ---------- Project ----------
export async function listProjects(): Promise<Project[]> {
  const dir = path.join(HOME, "projects")
  const out: Project[] = []
  try {
    const files = await readdir(dir)
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(dir, f), "utf8")
        const p = JSON.parse(raw) as Record<string, unknown>
        const st = await stat(path.join(dir, f))
        const total = Number(p.tasksTotal ?? 0)
        const done = Number(p.tasksDone ?? 0)
        out.push({
          id: String(p.id ?? f.replace(".json", "")),
          name: String(p.name ?? f.replace(".json", "")),
          description: String(p.description ?? ""),
          status: (p.status as Project["status"]) ?? "running",
          progress: total > 0 ? Math.round((done / total) * 100) : Number(p.progress ?? 0),
          startedAt: String(p.startedAt ?? st.birthtime.toISOString()),
          lastActivityAt: String(p.lastActivityAt ?? st.mtime.toISOString()),
          tasksDone: done,
          tasksTotal: total,
        })
      } catch {
        // skip
      }
    }
  } catch {
    // ignore
  }
  return out
}

// ---------- ModelInfo ----------
export async function listModels(): Promise<ModelInfo[]> {
  try {
    const out = await runCli(["model", "list", "--json"], 5000)
    const parsed = JSON.parse(out) as ModelInfo[]
    return parsed
  } catch {
    return []
  }
}

export async function pullModel(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await runCli(["model", "pull", id], 600_000)
    return { ok: true, message: out || `已拉取 ${id}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function testModel(id: string, prompt = "Say hi in 5 words."): Promise<ModelTestResult> {
  const start = Date.now()
  try {
    const out = await runCli(["model", "test", id, "--prompt", prompt], 30_000)
    return {
      modelId: id,
      ok: true,
      latencyMs: Date.now() - start,
      sample: out.slice(0, 200),
    }
  } catch (e) {
    return {
      modelId: id,
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function addModel(input: {
  provider: string
  id: string
  apiKey?: string
  baseUrl?: string
}): Promise<ModelInfo> {
  const args = ["model", "add", input.provider, input.id]
  if (input.baseUrl) args.push("--base-url", input.baseUrl)
  if (input.apiKey) args.push("--api-key", input.apiKey)
  try {
    await runCli(args, 15_000)
  } catch {
    // 即便 CLI 不存在，也回填一个基础对象，便于 UI 立刻反应
  }
  return {
    id: input.id,
    name: input.id.split("/").pop() || input.id,
    provider: input.provider,
    family: input.provider,
    contextWindow: 0,
    status: "ready",
    isDefault: false,
    isLocal: input.provider === "ollama" || input.provider === "llamacpp",
  }
}

export async function removeModel(id: string): Promise<{ ok: boolean }> {
  try {
    await runCli(["model", "remove", id], 10_000)
  } catch {
    // 忽略
  }
  return { ok: true }
}

export async function setDefaultModel(id: string): Promise<{ ok: boolean }> {
  try {
    await runCli(["model", "default", id], 5_000)
  } catch {
    // 忽略
  }
  return { ok: true }
}

// ---------- 系统操作 ----------
export async function restartGateway(): Promise<{ ok: boolean; output: string }> {
  try {
    const out = await runCli(["gateway", "restart"], 30_000)
    return { ok: true, output: out || "网关已重启" }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function restartClaw(): Promise<{ ok: boolean; output: string }> {
  try {
    const out = await runCli(["restart"], 30_000)
    return { ok: true, output: out || "OpenClaw 已重启" }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function upgradeOpenclaw(): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout } = await execFileAsync("npm", ["i", "-g", "openclaw@latest"], { timeout: 180_000 })
    openclawInstalled = null // 清缓存，让下次 detectInstalled 重新探测
    return { ok: true, output: stdout.trim() || "升级完成" }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function clearCache(): Promise<{ ok: boolean; output: string }> {
  try {
    const out = await runCli(["cache", "clear"], 15_000)
    return { ok: true, output: out || "缓存已清理" }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function stopOpenclaw(): Promise<{ ok: boolean; output: string }> {
  try {
    const out = await runCli(["stop"], 10_000)
    return { ok: true, output: out || "已停止" }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}
