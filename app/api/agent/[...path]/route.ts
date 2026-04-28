import type { NextRequest } from "next/server"

// Same-origin proxy: PWA → /api/agent/<path>  →  user's Bridge Agent.
// The PWA passes the agent URL + token via headers (set by middleware-style fetch
// in the client) OR we read them out of cookies. To keep it simple and stateless
// we accept them via custom headers, falling back to query params.
//
// NOTE: All persistence stays on the user's own VPS/macOS — this proxy is just
// a CORS-friendly forwarder so the PWA installed on a phone can reach it.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getTarget(req: NextRequest): { url: string; token: string } | null {
  const url =
    req.headers.get("x-claw-agent-url") ||
    req.nextUrl.searchParams.get("__agent") ||
    req.cookies.get("claw_agent_url")?.value ||
    ""
  const token =
    req.headers.get("x-claw-agent-token") ||
    req.nextUrl.searchParams.get("__token") ||
    req.cookies.get("claw_agent_token")?.value ||
    ""
  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ""), token }
}

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const target = getTarget(req)
  if (!target) {
    return Response.json({ error: "agent_not_configured" }, { status: 400 })
  }
  const { path } = await ctx.params
  const joined = path?.join("/") ?? ""
  // Agent 的鉴权中间件挂载在 /api/* 下，所以这里统一加前缀。
  // 客户端调用 /api/agent/info  →  上游 <agentUrl>/api/info。
  const subPath = "/api/" + joined
  const search = req.nextUrl.search
    ? "?" +
      Array.from(req.nextUrl.searchParams.entries())
        .filter(([k]) => k !== "__agent" && k !== "__token")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : ""

  const upstream = `${target.url}${subPath}${search}`

  const init: RequestInit = {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      authorization: `Bearer ${target.token}`,
    },
    cache: "no-store",
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text()
  }

  try {
    const r = await fetch(upstream, init)
    const body = await r.text()
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    })
  } catch (err) {
    return Response.json(
      { error: "agent_unreachable", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward
export const PATCH = forward
