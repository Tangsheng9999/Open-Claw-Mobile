import { access, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { DiagnosticCheck } from "./types.js"
import { getOpenclawVersion } from "./openclaw.js"

const execFileAsync = promisify(execFile)
const HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw")

async function checkBin(): Promise<DiagnosticCheck> {
  const start = Date.now()
  try {
    const v = await getOpenclawVersion()
    return {
      id: "bin",
      name: "OpenClaw 可执行文件",
      status: v === "unknown" ? "fail" : "pass",
      detail: v === "unknown" ? "未在 PATH 中找到 openclaw" : `版本 ${v}`,
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return {
      id: "bin",
      name: "OpenClaw 可执行文件",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkHomeDir(): Promise<DiagnosticCheck> {
  try {
    await access(HOME)
    const s = await stat(HOME)
    return {
      id: "home",
      name: "数据目录可访问",
      status: s.isDirectory() ? "pass" : "warn",
      detail: HOME,
    }
  } catch {
    return { id: "home", name: "数据目录可访问", status: "fail", detail: `${HOME} 不存在` }
  }
}

async function checkNetwork(): Promise<DiagnosticCheck> {
  const start = Date.now()
  try {
    const ctrl = AbortSignal.timeout(5000)
    const res = await fetch("https://api.openai.com/v1/models", { signal: ctrl })
    return {
      id: "network",
      name: "外网连通性",
      status: res.status < 500 ? "pass" : "warn",
      detail: `HTTP ${res.status}`,
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return {
      id: "network",
      name: "外网连通性",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkDisk(): Promise<DiagnosticCheck> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", HOME], { timeout: 3000 })
    const lines = stdout.trim().split("\n")
    const last = lines[lines.length - 1].trim().split(/\s+/)
    const usedPct = Number.parseInt(last[4]?.replace("%", "") ?? "0", 10)
    return {
      id: "disk",
      name: "磁盘空间",
      status: usedPct > 90 ? "fail" : usedPct > 75 ? "warn" : "pass",
      detail: `已使用 ${usedPct}% (${last[5] ?? HOME})`,
    }
  } catch {
    return { id: "disk", name: "磁盘空间", status: "warn", detail: "无法获取磁盘信息" }
  }
}

async function checkMemory(): Promise<DiagnosticCheck> {
  const total = os.totalmem()
  const free = os.freemem()
  const usedPct = Math.round(((total - free) / total) * 100)
  return {
    id: "memory",
    name: "内存使用率",
    status: usedPct > 90 ? "fail" : usedPct > 80 ? "warn" : "pass",
    detail: `已使用 ${usedPct}%（${Math.round((total - free) / 1024 ** 3)}G / ${Math.round(total / 1024 ** 3)}G）`,
  }
}

export async function runAllChecks(): Promise<DiagnosticCheck[]> {
  return Promise.all([checkBin(), checkHomeDir(), checkMemory(), checkDisk(), checkNetwork()])
}
