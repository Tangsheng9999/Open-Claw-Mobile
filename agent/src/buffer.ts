// 简易环形缓冲区，用于在内存里保留最近 N 条日志/心跳。
// PWA 通过 GET /api/logs 和 /api/heartbeats 拉取，WS 用于增量推送。

export class RingBuffer<T> {
  private items: T[] = []
  constructor(private readonly cap: number) {}

  push(item: T) {
    this.items.push(item)
    if (this.items.length > this.cap) this.items.splice(0, this.items.length - this.cap)
  }

  pushMany(items: T[]) {
    for (const it of items) this.push(it)
  }

  list(limit?: number): T[] {
    if (!limit || limit >= this.items.length) return this.items.slice().reverse()
    return this.items.slice(-limit).reverse()
  }

  size() {
    return this.items.length
  }
}
