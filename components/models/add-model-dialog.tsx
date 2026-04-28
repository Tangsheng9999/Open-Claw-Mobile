"use client"

import * as React from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { mutate } from "swr"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { agentApi } from "@/lib/agent-client"

const PROVIDERS = [
  { value: "openai", label: "OpenAI 兼容（含本地代理）" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "ollama", label: "Ollama 本地" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "自定义 / 其他" },
]

export function AddModelDialog() {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [provider, setProvider] = React.useState("openai")
  const [id, setId] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [baseUrl, setBaseUrl] = React.useState("")

  async function onSubmit() {
    if (!id) {
      toast.error("请填写模型 ID")
      return
    }
    setSubmitting(true)
    try {
      await agentApi.addModel({ id, provider, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined })
      toast.success(`已添加 ${id}`)
      setOpen(false)
      setId("")
      setApiKey("")
      setBaseUrl("")
      mutate("agent.models")
    } catch (err) {
      toast.error("添加失败", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          添加模型
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加第三方模型</DialogTitle>
          <DialogDescription>
            会写入 OpenClaw 的模型配置。本地模型（Ollama 等）填 ID 即可，托管模型需要 API Key。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-muted-foreground">提供商</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-muted-foreground">模型 ID</Label>
            <Input
              placeholder="例如 anthropic/claude-opus-4.6  或  qwen3-coder-30b"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              className="font-mono text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-muted-foreground">Base URL（可选）</Label>
            <Input
              placeholder="留空使用默认 — 自定义网关时填写"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              inputMode="url"
              className="font-mono text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-muted-foreground">API Key（可选）</Label>
            <Input
              type="password"
              placeholder="本地模型可不填"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              className="font-mono text-[13px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
</content>
<parameter name="taskNameActive">添加模型对话框
