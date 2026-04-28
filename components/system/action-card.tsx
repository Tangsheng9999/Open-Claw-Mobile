"use client"

import * as React from "react"
import { Loader2, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useConnection } from "@/components/connection-provider"
import { cn } from "@/lib/utils"

type ActionFn = () => Promise<{ ok: boolean; output?: string; message?: string }>

interface ActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonLabel: string
  destructive?: boolean
  confirmTitle: string
  confirmDescription: string
  /** 该操作要执行的 agentApi 方法，由父组件注入 */
  action: ActionFn
}

export function ActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  destructive,
  confirmTitle,
  confirmDescription,
  action,
}: ActionCardProps) {
  const { config } = useConnection()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [output, setOutput] = React.useState<string | null>(null)

  async function run() {
    if (!config) {
      toast.error("尚未连接 Agent", { description: "请先到设置页配置连接" })
      return
    }
    setPending(true)
    setOutput(null)
    try {
      const res = await action()
      const text = res.output ?? res.message ?? "操作已下发"
      setOutput(text)
      if (res.ok) toast.success(title, { description: text.slice(0, 80) })
      else toast.error(title + " 失败", { description: text.slice(0, 200) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误"
      setOutput(msg)
      toast.error("执行失败", { description: msg })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        variant={destructive ? "destructive" : "default"}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {buttonLabel}
      </Button>

      {output ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {output}
        </pre>
      ) : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              确认执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
