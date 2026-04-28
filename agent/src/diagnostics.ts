// 系统诊断 — 输出符合 PWA `DiagnosticItem` 形状的列表

import { access, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { DiagnosticItem } from "./types.js"
import { getOpenclawVersion } from "./openclaw.js"

const execFileAsync = promisify(execFile)
const HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw")

async function checkBin(): Promise<DiagnosticItem> {
  try {
    const v = await getOpenclawVersion()
    if (!v) {
      return {
        id: "bin",
        label: "OpenClaw CLI 可用",
        status: "fail",
        detail: "未在 PATH 中找到 openclaw 命令",
        fixHint: "运行 npm i -g openclaw 或检查 OPENCLAW_BIN 环境变量",
      }
    }
    return {
      id: "bin",
      label: "OpenClaw CLI 可用",
      status: "pass",
      detail: `${v} 在 PATH 中`,
    }
  } catch (e) {
    return {
      id: "bin",
      label: "OpenClaw CLI 可用",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

async function checkHomeDir(): Promise<DiagnosticItem> {
  try {
    await access(HOME)
    const s = await stat(HOME)
    return {
      id: "home",
      label: "数据目录可读写",
      status: s.isDirectory() ? "pass" : "warn",
      detail: HOME,
    }
  } catch {
    return {
      id: "home",
      label: "数据目录可读写",
      status: "fail",
      detail: `${HOME} 不存在`,
      fixHint: "OpenClaw 首次运行后会自动创建该目录",
    }
  }
}

async function checkGateway(): Promise<DiagnosticItem> {
  const port = Number(process.env.OPENCLAW_GATEWAY_PORT ?? 8788)
  try {
    const ctrl = AbortSignal.timeout(2000)
    const r = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: ctrl })
    return {
      id: "gateway",
      label: "网关端口监听",
      status: r.ok ? "pass" : "warn",
      detail: `127.0.0.1:${port} HTTP ${r.status}`,
    }
  } catch {
    return {
      id: "gateway",
      label: "网关端口监听",
      status: "warn",
      detail: `127.0.0.1:${port} 无响应（可能未启动）`,
      fixHint: "在系统页执行『重启网关』",
    }
  }
}

async function checkNetwork(): Promise<DiagnosticItem> {
  const start = Date.now()
  try {
    const ctrl = AbortSignal.timeout(5000)
    const res = await fetch("https://api.openai.com/v1/models", { signal: ctrl })
    const ms = Date.now() - start
    return {
      id: "network",
      label: "外网连通性",
      status: res.status < 500 ? (ms > 1500 ? "warn" : "pass") : "warn",
      detail: `HTTP ${res.status}, ${ms} ms`,
    }
  } catch (e) {
    return {
      id: "network",
      label: "外网连通性",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

async function checkDisk(): Promise<DiagnosticItem> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", HOME], { timeout: 3000 })
    const lines = stdout.trim().split("\n")
    const last = lines[lines.length - 1].trim().split(/\s+/)
    const usedPct = Number.parseInt(last[4]?.replace("%", "") ?? "0", 10)
    return {
      id: "disk",
      label: "磁盘空间",
      status: usedPct > 90 ? "fail" : usedPct > 75 ? "warn" : "pass",
      detail: `已使用 ${usedPct}%（${last[5] ?? HOME}）`,
      fixHint: usedPct > 75 ? "在系统页执行『清理缓存』" : undefined,
    }
  } catch {
    return { id: "disk", label: "磁盘空间", status: "warn", detail: "无法获取磁盘信息" }
  }
}

async function checkMemory(): Promise<DiagnosticItem> {
  const total = os.totalmem()
  const free = os.freemem()
  const usedPct = Math.round(((total - free) / total) * 100)
  return {
    id: "memory",
    label: "内存使用率",
    status: usedPct > 90 ? "fail" : usedPct > 80 ? "warn" : "pass",
    detail: `已使用 ${usedPct}%（${Math.round((total - free) / 1024 ** 3)}G / ${Math.round(total / 1024 ** 3)}G）`,
  }
}

export async function runAllChecks(): Promise<DiagnosticItem[]> {
  return Promise.all([checkBin(), checkHomeDir(), checkMemory(), checkDisk(), checkGateway(), checkNetwork()])
}
