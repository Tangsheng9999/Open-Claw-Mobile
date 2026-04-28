// Web Push（VAPID）支持：管理订阅、根据告警条件向所有订阅推送通知。
// 订阅信息持久化到 ~/.openclaw/bridge/subscriptions.json，重启后保留。

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import webpush from "web-push"
import type { PushSubscription } from "./types.js"

const STATE_DIR = path.join(os.homedir(), ".openclaw", "bridge")
const SUBS_PATH = path.join(STATE_DIR, "subscriptions.json")

let publicKey = process.env.VAPID_PUBLIC_KEY ?? ""
let privateKey = process.env.VAPID_PRIVATE_KEY ?? ""
const contact = process.env.VAPID_CONTACT ?? "mailto:admin@localhost"
let subs: PushSubscription[] = []
let configured = false

export async function initPush(): Promise<void> {
  if (publicKey && privateKey) {
    webpush.setVapidDetails(contact, publicKey, privateKey)
    configured = true
  } else {
    console.warn("[bridge] VAPID 公钥/私钥未配置，Web Push 已禁用。运行 `npm run vapid` 生成。")
  }
  try {
    await mkdir(STATE_DIR, { recursive: true })
    const raw = await readFile(SUBS_PATH, "utf8")
    subs = JSON.parse(raw)
  } catch {
    subs = []
  }
}

export function pushPublicKey(): string | null {
  return configured ? publicKey : null
}

export function pushIsConfigured(): boolean {
  return configured
}

async function persist() {
  try {
    await mkdir(STATE_DIR, { recursive: true })
    await writeFile(SUBS_PATH, JSON.stringify(subs, null, 2), "utf8")
  } catch (err) {
    console.error("[bridge] 写入订阅失败:", err)
  }
}

export async function addSubscription(sub: PushSubscription): Promise<{ ok: true; total: number }> {
  if (subs.find((s) => s.endpoint === sub.endpoint)) return { ok: true, total: subs.length }
  subs.push({ ...sub, createdAt: sub.createdAt ?? new Date().toISOString() })
  await persist()
  return { ok: true, total: subs.length }
}

export async function removeSubscription(endpoint: string): Promise<{ ok: true; total: number }> {
  subs = subs.filter((s) => s.endpoint !== endpoint)
  await persist()
  return { ok: true, total: subs.length }
}

export function listSubscriptions() {
  return subs.map((s) => ({ endpoint: s.endpoint, ua: s.ua, createdAt: s.createdAt }))
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function broadcast(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!configured || subs.length === 0) return { sent: 0, failed: 0 }
  let sent = 0
  let failed = 0
  const dead: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        )
        sent++
      } catch (err: unknown) {
        failed++
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(s.endpoint)
      }
    }),
  )
  if (dead.length) {
    subs = subs.filter((s) => !dead.includes(s.endpoint))
    await persist()
  }
  return { sent, failed }
}
