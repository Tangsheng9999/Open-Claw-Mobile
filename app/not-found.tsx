import Link from "next/link"
import { Compass } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
        <Compass className="h-7 w-7" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-lg font-semibold tracking-tight">这里什么也没有</h1>
        <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          你访问的路径不存在。
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
      >
        回到仪表盘
      </Link>
    </main>
  )
}
