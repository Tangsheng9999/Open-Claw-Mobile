"use client"

import * as React from "react"

/**
 * 在浏览器空闲时注册 Service Worker。
 * - 仅在 https / localhost 下尝试
 * - 失败不会阻塞页面（监控台对离线缓存属于增强功能）
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV === "development") return

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // SW 注册失败不影响主流程，吞掉错误即可
        })
    }

    const w = window as unknown as Window & {
      requestIdleCallback?: (cb: () => void) => void
    }
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(register)
    } else {
      window.setTimeout(register, 1500)
    }
  }, [])

  return null
}
