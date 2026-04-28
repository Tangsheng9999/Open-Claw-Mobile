import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { WebSocketServer } from "ws"
import os from "node:os"
import { z } from "zod"
import {
  addModel,
  clearCache,
  getStatus,
  listConversations,
  listModels,
  listProjects,
  pullModel,
  restartGateway,
  stopOpenclaw,
  testModel,
  upgradeOpenclaw,
} from "./openclaw.js"
import { runAllChecks } from "./diagnostics.js"
import type { Heartbeat, WSMessage } from "./types.js"

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10)
const HOST = process.env.HOST ?? "0.0.0.0"
const TOKEN = process.env.BRIDGE_TOKEN
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim())

if (!TOKEN || TOKEN === "please-change-me") {
  console.warn("[bridge] 警告：未设置 BRIDGE_TOKEN，任何人都可访问 Agent。请尽快配置！")
}

const app = new Hono()

app.use(
  "*",
  cors({
    origin: (o) => (ALLOWED.includes("*") || ALLOWED.includes(o) ? o : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  }),
)

// 鉴权中间件
app.use("/api/*", async (c, next) => {
  if (!TOKEN) return next()
  const auth = c.req.header("Authorization") ?? ""
  const provided = auth.replace(/^Bearer\s+/i, "")
  if (provided !== TOKEN) return c.json({ error: "unauthorized" }, 401)
  await next()
})

// 公开的健康检查
app.get("/health", (c) => c.json({ ok: true, hostname: os.hostname(), bridge: "0.1.0" }))

// 状态聚合
app.get("/api/status", async (c) => c.json(await getStatus()))
app.get("/api/conversations", async (c) => c.json({ items: await listConversations() }))
app.get("/api/projects", async (c) => c.json({ items: await listProjects() }))
app.get("/api/models", async (c) => c.json({ items: await listModels() }))

// 模型操作
const addModelSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
})

app.post("/api/models/add", async (c) => {
  const body = addModelSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)
  return c.json(await addModel(body.data))
})

app.post("/api/models/:id/pull", async (c) => c.json(await pullModel(c.req.param("id"))))
app.post("/api/models/:id/test", async (c) => c.json(await testModel(c.req.param("id"))))

// 系统控制
app.post("/api/system/gateway/restart", async (c) => c.json(await restartGateway()))
app.post("/api/system/upgrade", async (c) => c.json(await upgradeOpenclaw()))
app.post("/api/system/cache/clear", async (c) => c.json(await clearCache()))
app.post("/api/system/stop", async (c) => c.json(await stopOpenclaw()))

// 诊断
app.post("/api/diagnostics/run", async (c) => c.json({ checks: await runAllChecks() }))

const server = serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[bridge] HTTP listening on http://${info.address}:${info.port}`)
})

// WebSocket：实时心跳
const wss = new WebSocketServer({ server, path: "/ws" })

wss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const token = url.searchParams.get("token") ?? ""
  if (TOKEN && token !== TOKEN) {
    socket.close(4401, "unauthorized")
    return
  }
  console.log("[bridge] ws client connected")

  // 立即推送一次状态
  getStatus()
    .then((data) => sendMsg(socket, { type: "status", data }))
    .catch(() => undefined)

  const tick = async () => {
    if (socket.readyState !== socket.OPEN) return
    const load = os.loadavg()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const hb: Heartbeat = {
      ts: new Date().toISOString(),
      cpu: Math.min(100, Math.round((load[0] / os.cpus().length) * 100)),
      memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
      loadAvg: load,
      activeRequests: 0,
      queuedRequests: 0,
    }
    sendMsg(socket, { type: "heartbeat", data: hb })
  }

  const interval = setInterval(tick, 2000)
  socket.on("close", () => clearInterval(interval))
  socket.on("error", () => clearInterval(interval))
})

function sendMsg(socket: import("ws").WebSocket, msg: WSMessage) {
  try {
    socket.send(JSON.stringify(msg))
  } catch {
    // ignore
  }
}

console.log(`[bridge] WebSocket listening on ws://${HOST}:${PORT}/ws`)
