import type { LucideIcon } from "lucide-react"
import { Globe, MessageCircle, MessageSquare, Send, Slack, Terminal } from "lucide-react"

const MAP: Record<string, LucideIcon> = {
  telegram: Send,
  whatsapp: MessageCircle,
  imessage: MessageSquare,
  discord: Slack,
  cli: Terminal,
  web: Globe,
}

export function channelIcon(channel: string): LucideIcon {
  return MAP[channel] ?? MessageSquare
}

export function channelLabel(channel: string): string {
  switch (channel) {
    case "telegram":
      return "Telegram"
    case "whatsapp":
      return "WhatsApp"
    case "imessage":
      return "iMessage"
    case "discord":
      return "Discord"
    case "cli":
      return "命令行"
    case "web":
      return "Web"
    default:
      return channel
  }
}
</content>
<parameter name="taskNameActive">渠道图标
