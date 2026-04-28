"use client"

// Web Push 客户端工具：注册 Service Worker、向浏览器请求通知权限、把订阅同步到 Bridge Agent。

import { agentApi } from "./agent-client"

export type PushPermission = "default" | "granted" | "denied" | "unsupported"

export function getPushPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported"
  if (typeof Notification === "undefined") return "unsupported"
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported"
  return Notification.permission
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) return existing
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch (err) {
    console.error("[push] sw register failed:", err)
    return null
  }
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  const permission = getPushPermission()
  if (permission === "unsupported") return { ok: false, reason: "当前浏览器不支持 Web Push" }
  if (permission === "denied") return { ok: false, reason: "你已拒绝通知权限，请在浏览器设置中重新启用" }

  if (permission === "default") {
    const next = await Notification.requestPermission()
    if (next !== "granted") return { ok: false, reason: "未授予通知权限" }
  }

  const reg = await ensureServiceWorker()
  if (!reg) return { ok: false, reason: "Service Worker 注册失败" }

  let vapid: { configured: boolean; publicKey: string | null }
  try {
    vapid = await agentApi.push.vapid()
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
  if (!vapid.configured || !vapid.publicKey) {
    return { ok: false, reason: "Bridge Agent 未配置 VAPID，请在 agent 目录运行 npm run vapid" }
  }

  let sub: PushSubscription
  try {
    const existing = await reg.pushManager.getSubscription()
    sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      }))
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  try {
    await agentApi.push.subscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      ua: navigator.userAgent,
    })
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true }
}

export async function unsubscribePush(): Promise<{ ok: boolean; reason?: string }> {
  const reg = await ensureServiceWorker()
  if (!reg) return { ok: false, reason: "Service Worker 不可用" }
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return { ok: true }
  try {
    await agentApi.push.unsubscribe(sub.endpoint)
  } catch {
    // 即使后端返回失败，也继续在浏览器端取消订阅
  }
  await sub.unsubscribe()
  return { ok: true }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}
