// Open Claw Monitor — Service Worker
// 1. 缓存应用外壳（HTML/JS/CSS）做离线兜底
// 2. 接收 Web Push 消息并展示系统通知
// 3. 通知点击后跳到对应路径

const CACHE = "claw-monitor-v1"
const APP_SHELL = ["/", "/dashboard", "/conversations", "/projects", "/models", "/system", "/settings", "/manifest.webmanifest", "/icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// 网络优先 + 缓存兜底（API 请求绕过缓存）
self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  // API 请求始终走网络（数据需要新鲜）
  if (url.pathname.startsWith("/api/")) return
  // 跨域资源不缓存
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 缓存导航请求与静态资源
        if (res.ok && (req.mode === "navigate" || /\.(js|css|svg|png|webp|ico|woff2?)$/.test(url.pathname))) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  )
})

// === Web Push ===
self.addEventListener("push", (event) => {
  let payload = { title: "OpenClaw", body: "有新事件", data: { url: "/" } }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch (_) {
    if (event.data) payload.body = event.data.text()
  }
  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "claw-event",
    renotify: true,
    data: payload.data || {},
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(payload.title || "OpenClaw", options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})
