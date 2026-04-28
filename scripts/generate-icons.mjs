// 把 public/icon.svg 渲染为各种 PNG 尺寸：
//   /public/icon-192.png
//   /public/icon-512.png
//   /public/icon-maskable-512.png   （安全区域内缩 12%）
//   /public/apple-touch-icon.png     （180x180 不透明背景）
import sharp from "sharp"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const pub = path.join(root, "public")
const src = path.join(pub, "icon.svg")
const svg = await fs.readFile(src)

await sharp(svg, { density: 600 }).resize(192, 192).png().toFile(path.join(pub, "icon-192.png"))
await sharp(svg, { density: 600 }).resize(512, 512).png().toFile(path.join(pub, "icon-512.png"))

// maskable：内缩 12%，外圈用品牌底色填满，确保 Android 圆形遮罩不裁切到内容
const inner = await sharp(svg, { density: 600 }).resize(404, 404).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 26, g: 20, b: 16, alpha: 1 } },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(path.join(pub, "icon-maskable-512.png"))

// apple-touch-icon：iOS 不支持透明，180x180
const inner180 = await sharp(svg, { density: 600 }).resize(180, 180).png().toBuffer()
await sharp({
  create: { width: 180, height: 180, channels: 4, background: { r: 26, g: 20, b: 16, alpha: 1 } },
})
  .composite([{ input: inner180, gravity: "center" }])
  .png()
  .toFile(path.join(pub, "apple-touch-icon.png"))

console.log("[icons] generated 4 png variants in public/")
