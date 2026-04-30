// 系统诊断 — 输出符合 PWA `DiagnosticItem` 形状的列表
//
// 数据源：
//   1) 本地探测（不依赖 OpenClaw）：CLI 可用性、数据目录、磁盘、内存、外网
//   2) OpenClaw 自带的 doctor 子命令（包含官方推荐的 quick fixes）
//   3) 网关端口 / 健康接口

import { access, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { DiagnosticItem } from "./types.js"
import { getOpenclawVersion } from "./openclaw.js"

const execFileAsync = promisify(execFile)
const HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw")
const GATEWAY_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT ?? 18789)
const BIN = process.env.OPENCLAW_BIN ?? "openclaw"

async function checkBin(): Promise<DiagnosticItem> {
  const v = await getOpenclawVersion()
  if (!v) {
    return {
      id: "bin",
      label: "OpenClaw CLI 可用",
      status: "fail",
      detail: "未在 PATH 中找到 openclaw 命令",
      fixHint: "确保 openclaw 在 PATH 中，或设置 OPENCLAW_BIN 环境变量",
    }
  }
  return {
    id: "bin",
    label: "OpenClaw CLI 可用",
    status: "pass",
    detail: v,
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
  // OpenClaw 网关默认监听 127.0.0.1:18789
  for (const p of ["/healthz", "/health", "/api/health", "/"]) {
    try {
      const ctrl = AbortSignal.timeout(2000)
      const r = await fetch(`http://127.0.0.1:${GATEWAY_PORT}${p}`, { signal: ctrl })
      return {
        id: "gateway",
        label: "网关端口监听",
        status: r.status < 500 ? "pass" : "warn",
        detail: `127.0.0.1:${GATEWAY_PORT}${p} HTTP ${r.status}`,
      }
    } catch {
      continue
    }
  }
  // 端口探活兜底
  try {
    const { stdout } = await execFileAsync("ss", ["-tlnp"], { timeout: 2000 })
    if (stdout.includes(`:${GATEWAY_PORT}`)) {
      return {
        id: "gateway",
        label: "网关端口监听",
        status: "pass",
        detail: `127.0.0.1:${GATEWAY_PORT} 端口已监听（无健康端点）`,
      }
    }
  } catch {
    // ignore
  }
  return {
    id: "gateway",
    label: "网关端口监听",
    status: "fail",
    detail: `127.0.0.1:${GATEWAY_PORT} 未响应`,
    fixHint: "在系统页执行『重启网关』",
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

/**
 * 调用 `openclaw doctor` 把它的检查结果合并进诊断面板。
 * 不同 OpenClaw 版本的 doctor 输出格式可能不同 —— 这里做兜底解析：
 *   - 优先尝试 `--json`
 *   - 否则按行扫描，识别 ✓ ✗ ⚠ / [PASS] [FAIL] [WARN] / ok / fail 等关键词
 */
async function runOpenclawDoctor(): Promise<DiagnosticItem[]> {
  // 先试 JSON
  try {
    const { stdout } = await execFileAsync(BIN, ["doctor", "--json"], { timeout: 15_000 })
    const out = stdout.toString().trim()
    const start = out.indexOf("[")
    const end = out.lastIndexOf("]")
    if (start >= 0 && end > start) {
      const arr = JSON.parse(out.slice(start, end + 1)) as Array<Record<string, unknown>>
      return arr.map((it, idx) => mapDoctorItem(it, idx))
    }
  } catch {
    // 继续走文本路径
  }

  try {
    const { stdout } = await execFileAsync(BIN, ["doctor"], { timeout: 15_000 })
    return parseDoctorText(stdout.toString())
  } catch (e) {
    return [
      {
        id: "doctor",
        label: "OpenClaw doctor",
        status: "warn",
        detail: e instanceof Error ? e.message.slice(0, 200) : "openclaw doctor 调用失败",
      },
    ]
  }
}

function mapDoctorItem(it: Record<string, unknown>, idx: number): DiagnosticItem {
  const status =
    typeof it.status === "string"
      ? (it.status as string).toLowerCase()
      : it.ok === true
        ? "pass"
        : it.ok === false
          ? "fail"
          : "warn"
  const normStatus: DiagnosticItem["status"] =
    status === "pass" || status === "ok" || status === "success"
      ? "pass"
      : status === "fail" || status === "error" || status === "failed"
        ? "fail"
        : "warn"
  return {
    id: `doctor-${(it.id as string) ?? idx}`,
    label: String(it.label ?? it.name ?? it.title ?? `检查 ${idx + 1}`),
    status: normStatus,
    detail: String(it.detail ?? it.message ?? it.note ?? ""),
    fixHint: it.fix || it.fixHint || it.hint ? String(it.fix ?? it.fixHint ?? it.hint) : undefined,
  }
}

function parseDoctorText(text: string): DiagnosticItem[] {
  // 移除 ANSI 颜色与 OpenClaw 的 emoji banner（🦞 那一行）
  const cleaned = text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")
    .filter((l) => !/^\s*🦞/.test(l))

  const items: DiagnosticItem[] = []
  let counter = 0
  const PASS = /^[\s•·\-]*([✓✔]|\[OK\]|\[PASS\])\s*(.+)$/i
  const FAIL = /^[\s•·\-]*([✗✘×]|\[FAIL\]|\[ERROR\])\s*(.+)$/i
  const WARN = /^[\s•·\-]*([⚠!]|\[WARN\]|\[WARNING\])\s*(.+)$/i

  for (const line of cleaned) {
    const m = PASS.exec(line) ?? FAIL.exec(line) ?? WARN.exec(line)
    if (!m) continue
    const status: DiagnosticItem["status"] = PASS.test(line) ? "pass" : FAIL.test(line) ? "fail" : "warn"
    // label 有可能是 "Foo: bar"，把冒号后面当 detail
    const body = m[2].trim()
    const colonIdx = body.indexOf(":")
    const label = colonIdx > 0 ? body.slice(0, colonIdx).trim() : body
    const detail = colonIdx > 0 ? body.slice(colonIdx + 1).trim() : ""
    items.push({ id: `doctor-${counter++}`, label, status, detail })
  }

  if (items.length === 0) {
    // 完全没识别出条目时，把整段输出折叠成一条
    items.push({
      id: "doctor",
      label: "OpenClaw doctor 输出",
      status: "pass",
      detail: cleaned.join(" ").trim().slice(0, 400),
    })
  }
  return items
}

export async function runAllChecks(): Promise<DiagnosticItem[]> {
  const [bin, home, mem, disk, gateway, network, doctor] = await Promise.all([
    checkBin(),
    checkHomeDir(),
    checkMemory(),
    checkDisk(),
    checkGateway(),
    checkNetwork(),
    runOpenclawDoctor(),
  ])
  return [bin, home, mem, disk, gateway, network, ...doctor]
}
