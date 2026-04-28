import type { LucideIcon } from "lucide-react"
import { Globe, MessageCircle, MessageSquare, Send, Slack, Terminal, Code2, Plug } from "lucide-react"

const MAP: Record<string, LucideIcon> = {
  cli: Terminal,
  api: Code2,
  web: Globe,
  mcp: Plug,
  telegram: Send,
  whatsapp: MessageCircle,
  imessage: MessageSquare,
  discord: Slack,
}

export function channelIcon(channel: string): LucideIcon {
  return MAP[channel] ?? MessageSquare
}

export function channelLabel(channel: string): string {
  switch (channel) {
    case "cli":
      return "命令行"
    case "api":
      return "API"
    case "web":
      return "Web"
    case "mcp":
      return "MCP"
    case "telegram":
      return "Telegram"
    case "whatsapp":
      return "WhatsApp"
    case "imessage":
      return "iMessage"
    case "discord":
      return "Discord"
    default:
      return channel
  }
}
