"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * 全局错误边界。Next.js 在任何路由渲染抛错时会兜底到这里。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[claw] runtime error:", error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/30">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-lg font-semibold tracking-tight">监控台遇到了一个错误</h1>
        <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          这通常是因为 Bridge Agent 不可达或返回了未预期的数据。
          可以尝试刷新；如果反复出现，请在 GitHub 提 issue 并附上下面的错误摘要。
        </p>
      </div>
      <pre className="max-w-full overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {error.message}
        {error.digest ? `  (#${error.digest})` : ""}
      </pre>
      <Button onClick={reset} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        重新加载
      </Button>
    </main>
  )
}
