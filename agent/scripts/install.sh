#!/usr/bin/env bash
# Open Claw Bridge Agent 一键安装脚本（Linux / macOS）
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "==> 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 node，请先安装 Node.js >= 20: https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 版本过低（$(node -v)），需要 >= 20"
  exit 1
fi

echo "==> 安装依赖"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
elif command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "未检测到 pnpm 或 npm"
  exit 1
fi

echo "==> 准备 .env"
if [ ! -f .env ]; then
  if [ ! -f .env.example ]; then
    echo "警告：未找到 .env.example，跳过自动生成 .env"
  else
    cp .env.example .env
    TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [ "$(uname)" = "Darwin" ]; then
      sed -i "" "s/please-change-me/$TOKEN/" .env
    else
      sed -i "s/please-change-me/$TOKEN/" .env
    fi
    echo "已生成随机 BRIDGE_TOKEN，请妥善保存："
    echo "  $TOKEN"
  fi
fi

echo "==> 生成 VAPID 推送密钥（首次运行）"
if grep -q "^VAPID_PUBLIC_KEY=$" .env 2>/dev/null || ! grep -q "^VAPID_PUBLIC_KEY=" .env 2>/dev/null; then
  if [ -f scripts/generate-vapid.mjs ]; then
    node scripts/generate-vapid.mjs || echo "VAPID 生成失败（可稍后再运行 npm run vapid）"
  fi
fi

echo "==> 编译 TypeScript"
if command -v pnpm >/dev/null 2>&1; then
  pnpm build
else
  npm run build
fi

echo
echo "安装完成！"
echo "前台启动： npm start"
echo "Linux 后台： sudo cp openclaw-bridge.service /etc/systemd/system/ && sudo systemctl enable --now openclaw-bridge"
echo "macOS 后台： cp com.openclaw.bridge.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.openclaw.bridge.plist"
