import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { WebSocketServer } from "ws"
import os from "node:os"
import { z } from "zod"
import {
  addModel,
  clearCache,
  getAgentInfo,
  getMetrics,
  getStatus,
  listConversations,
  listModels,
  listProjects,
  pullModel,
  removeModel,
  restartClaw,
  restartGateway,
  setDefaultModel,
  stopOpenclaw,
  testModel,
  upgradeOpenclaw,
} from "./openclaw.js"
import { runAllChecks } from "./diagnostics.js"
import { RingBuffer } from "./buffer.js"
import {
  addSubscription,
  broadcast,
  initPush,
  listSubscriptions,
  pushIsConfigured,
  pushPublicKey,
  removeSubscription,
} from "./push.js"
import type { Heartbeat, LogLine, WsEvent } from "./types.js"

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10)
const HOST = process.env.HOST ?? "0.0.0.0"
const TOKEN = process.env.BRIDGE_TOKEN
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim())

if (!TOKEN || TOKEN === "please-change-me") {
  console.warn("[bridge] 警告：未设置 BRIDGE_TOKEN，任何人都可访问 Agent。请尽快配置！")
}

await initPush()

// 心跳与日志环形缓冲区（最近 200 条）
const heartbeats = new RingBuffer<Heartbeat>(200)
const logs = new RingBuffer<LogLine>(500)

function recordHeartbeat(hb: Omit<Heartbeat, "id" | "timestamp">) {
  const full: Heartbeat = {
    id: `hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...hb,
  }
  heartbeats.push(full)
  broadcastWs({ type: "heartbeat", data: full })
  if (full.level !== "info") {
    void broadcast({
      title: full.level === "error" ? "OpenClaw 错误" : "OpenClaw 警告",
      body: `${full.source}: ${full.message}`,
      tag: `claw-${full.level}`,
    }).catch(() => undefined)
  }
}

function recordLog(line: Omit<LogLine, "ts">) {
  const full: LogLine = { ts: new Date().toISOString(), ...line }
  logs.push(full)
  broadcastWs({ type: "log", data: full })
}

const app = new Hono()

app.use(
  "*",
  cors({
    origin: (o) => (ALLOWED.includes("*") || ALLOWED.includes(o) ? o : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  }),
)

// 鉴权中间件 — 仅保护 /api/*
app.use("/api/*", async (c, next) => {
  if (!TOKEN) return next()
  const auth = c.req.header("Authorization") ?? ""
  const provided = auth.replace(/^Bearer\s+/i, "")
  if (provided !== TOKEN) return c.json({ error: "unauthorized" }, 401)
  await next()
})

// 公开的健康检查
app.get("/health", (c) => c.json({ ok: true, hostname: os.hostname(), bridgeVersion: "0.1.0" }))

// === 身份与心跳 ===
app.get("/api/info", async (c) => c.json(await getAgentInfo()))
app.get("/api/ping", async (c) => c.json({ ok: true, info: await getAgentInfo() }))

// === 实时状态 ===
app.get("/api/status", async (c) => c.json(await getStatus()))
app.get("/api/metrics", (c) => c.json(getMetrics()))

// === 对话 / 项目 ===
app.get("/api/conversations", async (c) => c.json(await listConversations()))
app.get("/api/projects", async (c) => c.json(await listProjects()))

// === 心跳 / 日志 ===
app.get("/api/heartbeats", (c) => {
  const limit = Number(c.req.query("limit") ?? 50)
  return c.json(heartbeats.list(limit))
})
app.get("/api/logs", (c) => {
  const limit = Number(c.req.query("limit") ?? 100)
  return c.json(logs.list(limit))
})

// === 模型 ===
app.get("/api/models", async (c) => c.json(await listModels()))

const addModelSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
})
app.post("/api/models", async (c) => {
  const parsed = addModelSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const out = await addModel(parsed.data)
  recordHeartbeat({ source: "models", message: `添加模型 ${out.id}`, level: "info" })
  return c.json(out)
})
app.delete("/api/models/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"))
  return c.json(await removeModel(id))
})
app.post("/api/models/default", async (c) => {
  const body = z.object({ id: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)
  recordHeartbeat({ source: "models", message: `默认模型切换为 ${body.data.id}`, level: "info" })
  return c.json(await setDefaultModel(body.data.id))
})
app.post("/api/models/pull", async (c) => {
  const body = z.object({ id: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)
  const out = await pullModel(body.data.id)
  recordHeartbeat({
    source: "models",
    message: out.ok ? `拉取 ${body.data.id} 成功` : `拉取 ${body.data.id} 失败`,
    level: out.ok ? "info" : "error",
  })
  return c.json(out)
})
app.post("/api/models/test", async (c) => {
  const body = z
    .object({ id: z.string().min(1), prompt: z.string().optional() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)
  return c.json(await testModel(body.data.id, body.data.prompt))
})

// === 系统操作 ===
app.post("/api/system/restart-gateway", async (c) => {
  const r = await restartGateway()
  recordHeartbeat({ source: "system", message: "网关已重启", level: r.ok ? "info" : "error" })
  return c.json(r)
})
app.post("/api/system/restart-claw", async (c) => {
  const r = await restartClaw()
  recordHeartbeat({ source: "system", message: "OpenClaw 已重启", level: r.ok ? "info" : "error" })
  return c.json(r)
})
app.post("/api/system/upgrade", async (c) => {
  const r = await upgradeOpenclaw()
  recordHeartbeat({ source: "system", message: r.ok ? "OpenClaw 升级完成" : "升级失败", level: r.ok ? "info" : "error" })
  if (r.ok) {
    void broadcast({ title: "OpenClaw 升级完成", body: "新版本已就绪", tag: "claw-upgrade" }).catch(() => undefined)
  }
  return c.json(r)
})
app.post("/api/system/clear-cache", async (c) => c.json(await clearCache()))
app.post("/api/system/stop", async (c) => {
  const r = await stopOpenclaw()
  recordHeartbeat({ source: "system", message: "OpenClaw 已停止", level: "warn" })
  return c.json(r)
})

// === 诊断（GET 形式，符合 PWA 客户端） ===
app.get("/api/diagnostics", async (c) => c.json(await runAllChecks()))
app.post("/api/diagnostics/run", async (c) => c.json(await runAllChecks()))

// === Web Push ===
app.get("/api/push/vapid", (c) =>
  c.json({ configured: pushIsConfigured(), publicKey: pushPublicKey() }),
)
const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  ua: z.string().optional(),
  createdAt: z.string().optional(),
})
app.post("/api/push/subscribe", async (c) => {
  const parsed = pushSubSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  return c.json(
    await addSubscription({
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      ua: parsed.data.ua,
      createdAt: parsed.data.createdAt ?? new Date().toISOString(),
    }),
  )
})
app.post("/api/push/unsubscribe", async (c) => {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  return c.json(await removeSubscription(parsed.data.endpoint))
})
app.get("/api/push/subscriptions", (c) => c.json(listSubscriptions()))
app.post("/api/push/test", async (c) => {
  const r = await broadcast({
    title: "Open Claw 测试通知",
    body: `来自 ${os.hostname()} 的桥接 Agent`,
    tag: "claw-test",
  })
  return c.json(r)
})

const server = serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[bridge] HTTP listening on http://${info.address}:${info.port}`)
})

// === WebSocket：实时心跳 / 指标 / 日志 ===
// `serve` 返回的 ServerType 与 ws 期待的 http.Server 形状一致，但 TS 看不到。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wss = new WebSocketServer({ server: server as any, path: "/ws" })
const wsClients = new Set<import("ws").WebSocket>()

wss.on("connection", async (socket, req) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const token = url.searchParams.get("token") ?? ""
  if (TOKEN && token !== TOKEN) {
    socket.close(4401, "unauthorized")
    return
  }
  wsClients.add(socket)
  console.log(`[bridge] ws client connected (total ${wsClients.size})`)

  // 立即推送一次状态 + 指标
  try {
    const [status, info] = await Promise.all([getStatus(), getAgentInfo()])
    sendMsg(socket, { type: "hello", data: { bridgeVersion: info.bridgeVersion, serverTime: new Date().toISOString() } })
    sendMsg(socket, { type: "status", data: status })
    sendMsg(socket, { type: "metrics", data: getMetrics() })
  } catch {
    // ignore
  }

  socket.on("close", () => {
    wsClients.delete(socket)
  })
  socket.on("error", () => {
    wsClients.delete(socket)
  })
})

function sendMsg(socket: import("ws").WebSocket, msg: WsEvent) {
  try {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
  } catch {
    // ignore
  }
}

function broadcastWs(msg: WsEvent) {
  for (const sock of wsClients) sendMsg(sock, msg)
}

// 每 2 秒推送一次指标
setInterval(() => {
  if (wsClients.size === 0) return
  broadcastWs({ type: "metrics", data: getMetrics() })
}, 2000)

// 每 10 秒推送一次状态摘要
setInterval(async () => {
  if (wsClients.size === 0) return
  try {
    broadcastWs({ type: "status", data: await getStatus() })
  } catch {
    // ignore
  }
}, 10_000)

// 启动横幅
recordLog({ level: "info", source: "bridge", message: `bridge ${`0.1.0`} 已启动 on :${PORT}` })
recordHeartbeat({ source: "bridge", message: `Bridge Agent 已上线 on ${HOST}:${PORT}`, level: "info" })

// 阈值监控：CPU / 内存超过阈值发送 Web Push
const PUSH_CPU_THRESHOLD = Number(process.env.PUSH_CPU_THRESHOLD ?? 90)
const PUSH_MEM_THRESHOLD = Number(process.env.PUSH_MEM_THRESHOLD ?? 90)
let lastPushedCpu = 0
let lastPushedMem = 0
setInterval(async () => {
  const m = getMetrics()
  const memPct = m.memTotalMb > 0 ? (m.memUsedMb / m.memTotalMb) * 100 : 0
  const now = Date.now()
  if (m.cpuPercent >= PUSH_CPU_THRESHOLD && now - lastPushedCpu > 5 * 60_000) {
    lastPushedCpu = now
    void broadcast({
      title: "OpenClaw CPU 飙升",
      body: `${os.hostname()} 当前 CPU ${m.cpuPercent.toFixed(0)}%`,
      tag: "claw-cpu",
    }).catch(() => undefined)
  }
  if (memPct >= PUSH_MEM_THRESHOLD && now - lastPushedMem > 5 * 60_000) {
    lastPushedMem = now
    void broadcast({
      title: "OpenClaw 内存吃紧",
      body: `${os.hostname()} 当前内存 ${memPct.toFixed(0)}%`,
      tag: "claw-mem",
    }).catch(() => undefined)
  }
}, 30_000)

console.log(`[bridge] WebSocket listening on ws://${HOST}:${PORT}/ws`)
