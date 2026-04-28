// OpenClaw CLI 桥接：调用本地 openclaw 二进制并解析输出
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { Conversation, ModelInfo, Project, SystemStatus } from "./types.js"

const execFileAsync = promisify(execFile)

const BIN = process.env.OPENCLAW_BIN ?? "openclaw"
const HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw")

async function runCli(args: string[], timeoutMs = 10_000): Promise<string> {
  const { stdout } = await execFileAsync(BIN, args, { timeout: timeoutMs })
  return stdout.trim()
}

export async function getOpenclawVersion(): Promise<string> {
  try {
    return await runCli(["--version"], 3000)
  } catch {
    return "unknown"
  }
}

export async function getStatus(): Promise<SystemStatus> {
  const [version] = await Promise.all([getOpenclawVersion()])

  // 从 ~/.openclaw/state.json 读取运行时信息（OpenClaw 写入的真实状态文件）
  let activeSessions = 0
  let defaultModel = "unknown"
  let gatewayHealthy = false
  let totalRequestsToday = 0
  let tokensUsedToday = 0
  let lastError: string | null = null

  try {
    const raw = await readFile(path.join(HOME, "state.json"), "utf8")
    const s = JSON.parse(raw)
    activeSessions = s.activeSessions ?? 0
    defaultModel = s.defaultModel ?? "unknown"
    gatewayHealthy = s.gatewayHealthy ?? false
    totalRequestsToday = s.totalRequestsToday ?? 0
    tokensUsedToday = s.tokensUsedToday ?? 0
    lastError = s.lastError ?? null
  } catch {
    // OpenClaw 未写入状态文件时，使用空值
  }

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    uptimeSec: Math.floor(os.uptime()),
    openclawVersion: version,
    defaultModel,
    gatewayHealthy,
    activeSessions,
    totalRequestsToday,
    tokensUsedToday,
    lastError,
    bridgeVersion: "0.1.0",
  }
}

export async function listConversations(): Promise<Conversation[]> {
  // 读取 ~/.openclaw/sessions/*.json
  const dir = path.join(HOME, "sessions")
  const out: Conversation[] = []
  try {
    const files = await readdir(dir)
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(dir, f), "utf8")
        const s = JSON.parse(raw)
        out.push({
          id: s.id ?? f.replace(".json", ""),
          title: s.title ?? "未命名会话",
          channel: s.channel ?? "cli",
          model: s.model ?? "unknown",
          startedAt: s.startedAt ?? new Date().toISOString(),
          lastMessageAt: s.lastMessageAt ?? new Date().toISOString(),
          messageCount: s.messages?.length ?? 0,
          tokensUsed: s.tokensUsed ?? 0,
          status: s.status ?? "idle",
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

export async function listProjects(): Promise<Project[]> {
  const dir = path.join(HOME, "projects")
  const out: Project[] = []
  try {
    const files = await readdir(dir)
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(dir, f), "utf8")
        const p = JSON.parse(raw)
        const st = await stat(path.join(dir, f))
        out.push({
          id: p.id ?? f.replace(".json", ""),
          name: p.name ?? f.replace(".json", ""),
          path: p.path ?? "",
          activeAgents: p.activeAgents ?? 0,
          lastActivityAt: p.lastActivityAt ?? st.mtime.toISOString(),
          status: p.status ?? "active",
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

export async function testModel(id: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now()
  try {
    const out = await runCli(["model", "test", id, "--prompt", "ping"], 30_000)
    return { ok: true, message: out.slice(0, 200), latencyMs: Date.now() - start }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - start,
    }
  }
}

export async function addModel(input: {
  provider: string
  id: string
  apiKey?: string
  baseUrl?: string
}): Promise<{ ok: boolean; message: string }> {
  const args = ["model", "add", input.provider, input.id]
  if (input.baseUrl) args.push("--base-url", input.baseUrl)
  if (input.apiKey) args.push("--api-key", input.apiKey)
  try {
    const out = await runCli(args, 15_000)
    return { ok: true, message: out || `已添加 ${input.provider}/${input.id}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function restartGateway(): Promise<{ ok: boolean; log: string }> {
  try {
    const out = await runCli(["gateway", "restart"], 30_000)
    return { ok: true, log: out || "网关已重启" }
  } catch (e) {
    return { ok: false, log: e instanceof Error ? e.message : String(e) }
  }
}

export async function upgradeOpenclaw(): Promise<{ ok: boolean; log: string }> {
  try {
    const { stdout } = await execFileAsync("npm", ["i", "-g", "openclaw@latest"], { timeout: 180_000 })
    return { ok: true, log: stdout.trim() || "升级完成" }
  } catch (e) {
    return { ok: false, log: e instanceof Error ? e.message : String(e) }
  }
}

export async function clearCache(): Promise<{ ok: boolean; log: string }> {
  try {
    const out = await runCli(["cache", "clear"], 15_000)
    return { ok: true, log: out || "缓存已清理" }
  } catch (e) {
    return { ok: false, log: e instanceof Error ? e.message : String(e) }
  }
}

export async function stopOpenclaw(): Promise<{ ok: boolean; log: string }> {
  try {
    const out = await runCli(["stop"], 10_000)
    return { ok: true, log: out || "已停止" }
  } catch (e) {
    return { ok: false, log: e instanceof Error ? e.message : String(e) }
  }
}
