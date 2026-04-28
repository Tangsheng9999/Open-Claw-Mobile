#!/usr/bin/env node
// 生成 VAPID 公私钥对，并写回 .env（如果存在则补全空字段）。
// 用法：node scripts/generate-vapid.mjs

import webpush from "web-push"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.resolve(__dirname, "..", ".env")

const keys = webpush.generateVAPIDKeys()
console.log("VAPID_PUBLIC_KEY =", keys.publicKey)
console.log("VAPID_PRIVATE_KEY=", keys.privateKey)

let content = ""
try {
  content = await readFile(ENV_PATH, "utf8")
} catch {
  content = ""
}

function setOrAppend(key, value) {
  const re = new RegExp(`^${key}\\s*=.*$`, "m")
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`)
  } else {
    content = (content.endsWith("\n") || content === "" ? content : content + "\n") + `${key}=${value}\n`
  }
}

setOrAppend("VAPID_PUBLIC_KEY", keys.publicKey)
setOrAppend("VAPID_PRIVATE_KEY", keys.privateKey)

await writeFile(ENV_PATH, content, "utf8")
console.log(`已写入 ${ENV_PATH}`)
