"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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
import { agentRequest } from "@/lib/agent-client"
import { useConnection } from "@/components/connection-provider"
import { toast } from "@/hooks/use-toast"
import type { LucideIcon } from "lucide-react"

interface ActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  endpoint: string
  buttonLabel: string
  destructive?: boolean
  confirmTitle: string
  confirmDescription: string
}

export function ActionCard({
  icon: Icon,
  title,
  description,
  endpoint,
  buttonLabel,
  destructive,
  confirmTitle,
  confirmDescription,
}: ActionCardProps) {
  const { connection } = useConnection()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  async function run() {
    if (!connection) {
      toast({ title: "未连接 Agent", description: "请先到设置页配置连接", variant: "destructive" })
      return
    }
    setPending(true)
    setOutput(null)
    try {
      const res = await agentRequest<{ ok: boolean; message?: string; log?: string }>(connection, endpoint, {
        method: "POST",
      })
      setOutput(res.log ?? res.message ?? "操作已发送")
      toast({ title: "已下发指令", description: res.message ?? title })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误"
      setOutput(msg)
      toast({ title: "执行失败", description: msg, variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          }`}
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
        {pending ? <Spinner className="mr-2" /> : null}
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
    </Card>
  )
}
