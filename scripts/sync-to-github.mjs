// 通过 GitHub Git Data API 把当前工作区作为一个新分支推上去并发起 PR。
// 用法：GH_TOKEN=$(gh auth token) node scripts/sync-to-github.mjs
import { promises as fs } from "node:fs"
import path from "node:path"

const OWNER = "Tangsheng9999"
const REPO = "Open-Claw-Mobile"
const BASE = "main"
const HEAD = "v0/full-stack-overhaul"
const ROOT = "/vercel/share/v0-project"
const TOKEN = process.env.GH_TOKEN
if (!TOKEN) {
  console.error("Missing GH_TOKEN")
  process.exit(1)
}

const API = "https://api.github.com"
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "v0-sync",
}

async function gh(method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} -> ${res.status}: ${text}`)
  }
  return text ? JSON.parse(text) : null
}

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".turbo",
  ".vercel",
  ".cache",
  "android",
  "ios",
])
const EXCLUDE_FILE_NAMES = new Set([".DS_Store"])
const EXCLUDE_FILE_PATTERNS = [/\.log$/]

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue
      yield* walk(path.join(dir, ent.name))
    } else if (ent.isFile()) {
      if (EXCLUDE_FILE_NAMES.has(ent.name)) continue
      if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(ent.name))) continue
      yield path.join(dir, ent.name)
    }
  }
}

async function pLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

console.log("[sync] collecting files...")
const files = []
for await (const p of walk(ROOT)) files.push(p)
console.log(`[sync] file count: ${files.length}`)

console.log("[sync] reading base ref...")
const baseRef = await gh("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`)
const baseCommitSha = baseRef.object.sha
const baseCommit = await gh("GET", `/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`)
const baseTreeSha = baseCommit.tree.sha
console.log(`[sync] base commit ${baseCommitSha.slice(0, 7)} tree ${baseTreeSha.slice(0, 7)}`)

console.log("[sync] uploading blobs (concurrency 8)...")
let done = 0
const blobs = await pLimit(files, 8, async (filePath) => {
  const buf = await fs.readFile(filePath)
  const blob = await gh("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: buf.toString("base64"),
    encoding: "base64",
  })
  done++
  if (done % 20 === 0 || done === files.length) {
    console.log(`  ${done}/${files.length}`)
  }
  return {
    path: path.relative(ROOT, filePath),
    mode: "100644",
    type: "blob",
    sha: blob.sha,
  }
})

console.log("[sync] creating tree (additive on top of base)...")
const tree = await gh("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  base_tree: baseTreeSha,
  tree: blobs,
})
console.log(`[sync] tree ${tree.sha.slice(0, 7)}`)

console.log("[sync] creating commit...")
const message =
  "chore: full-stack overhaul via v0\n\n" +
  "- Agent: align all REST contracts and types with the PWA client\n" +
  "- Agent: ring buffers for heartbeats/logs, web-push integration with VAPID\n" +
  "- PWA: WebSocket realtime layer hooked into SWR cache\n" +
  "- PWA: multi-agent profiles + top-bar switcher\n" +
  "- PWA: service worker (offline shell + push events) + full icon set\n" +
  "- PWA: error boundary, not-found, channel taxonomy fix\n" +
  "- Native: Capacitor / Bubblewrap (TWA) / HarmonyOS scaffolds\n" +
  "- Misc: fix install.sh, add .env.example, generate-vapid script\n"

const commit = await gh("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
  message,
  tree: tree.sha,
  parents: [baseCommitSha],
})
console.log(`[sync] commit ${commit.sha.slice(0, 7)}`)

console.log(`[sync] creating/updating ref refs/heads/${HEAD}...`)
try {
  await gh("POST", `/repos/${OWNER}/${REPO}/git/refs`, {
    ref: `refs/heads/${HEAD}`,
    sha: commit.sha,
  })
} catch (e) {
  if (String(e).includes("Reference already exists")) {
    console.log("  branch exists, force-updating...")
    await gh("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${HEAD}`, {
      sha: commit.sha,
      force: true,
    })
  } else {
    throw e
  }
}

console.log("[sync] creating PR...")
let prUrl = null
try {
  const pr = await gh("POST", `/repos/${OWNER}/${REPO}/pulls`, {
    title: "v0: full-stack overhaul (PWA + Agent + native scaffolds)",
    head: HEAD,
    base: BASE,
    body:
      "Full-stack overhaul performed by v0 in a Vercel Sandbox. Covers the offline PWA, multi-agent switching, Web Push, and native packaging from the README roadmap, and aligns the PWA <-> Bridge Agent contracts.\n\n" +
      "**Highlights**\n" +
      "- Agent: complete REST surface for `info / metrics / heartbeats / logs / diagnostics / system / models / push`, with ring buffers\n" +
      "- PWA: WebSocket realtime layer (1s heartbeats/metrics) wired into SWR cache; multi-agent profiles + top-bar switcher\n" +
      "- PWA: service worker (offline shell + push events) and full icon set (192/512/maskable/apple-touch-icon)\n" +
      "- Native: `native/capacitor` (Android+iOS), `native/bubblewrap` (TWA), `native/harmony` (HarmonyOS Next) scaffolds\n" +
      "- Fixes: `install.sh` no longer crashes when `.env.example` is missing; added `generate-vapid.mjs`\n\n" +
      "Build status: PWA 8 routes `next build` green; Agent `tsc --noEmit` green.",
  })
  prUrl = pr.html_url
  console.log(`[sync] PR created: ${prUrl}`)
} catch (e) {
  if (String(e).includes("A pull request already exists")) {
    const existing = await gh(
      "GET",
      `/repos/${OWNER}/${REPO}/pulls?head=${OWNER}:${HEAD}&base=${BASE}&state=open`,
    )
    prUrl = existing[0]?.html_url
    console.log(`[sync] PR exists: ${prUrl}`)
  } else {
    throw e
  }
}

console.log("\n=== done ===")
console.log(`branch: https://github.com/${OWNER}/${REPO}/tree/${HEAD}`)
if (prUrl) console.log(`PR:     ${prUrl}`)
