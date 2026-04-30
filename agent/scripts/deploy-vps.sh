#!/usr/bin/env bash
# Open Claw Bridge Agent · VPS 一键部署
#
# 用法（在你的 VPS 上）：
#   curl -fsSL https://raw.githubusercontent.com/Tangsheng9999/Open-Claw-Mobile/v0/full-stack-overhaul/agent/scripts/deploy-vps.sh | sudo bash
#
# 或者：
#   sudo BRIDGE_TOKEN=xxxx bash deploy-vps.sh
#
# 这个脚本会：
#   1) 安装 Node.js 22（如未安装）
#   2) 把 agent/ 源码 clone 到 /opt/openclaw-bridge
#   3) 安装依赖、生成 BRIDGE_TOKEN（若未提供）、生成 VAPID 密钥
#   4) 写 systemd unit /etc/systemd/system/openclaw-bridge.service 并启用
#   5) 配置 firewalld / ufw 放行 8787（仅 IPv4）
#
# 环境变量（可选）：
#   BRIDGE_TOKEN  访问 token，默认随机生成
#   PORT          监听端口，默认 8787
#   INSTALL_DIR   安装目录，默认 /opt/openclaw-bridge
#   GIT_REF       要拉取的分支/标签，默认 v0/full-stack-overhaul

set -e

REPO="https://github.com/Tangsheng9999/Open-Claw-Mobile.git"
GIT_REF="${GIT_REF:-v0/full-stack-overhaul}"
INSTALL_DIR="${INSTALL_DIR:-/opt/openclaw-bridge}"
PORT="${PORT:-8787}"
SERVICE_NAME="openclaw-bridge"
SERVICE_USER="${SERVICE_USER:-root}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 sudo 运行：sudo bash $0"
  exit 1
fi

echo "================================================================"
echo " Open Claw Bridge Agent · 一键部署"
echo "================================================================"
echo "  仓库     : $REPO @ $GIT_REF"
echo "  目录     : $INSTALL_DIR"
echo "  端口     : $PORT"
echo "  systemd  : $SERVICE_NAME"
echo "----------------------------------------------------------------"

# ---------- 1. 装 Node ----------
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
  if [ "$NODE_MAJOR" -ge 20 ]; then NODE_OK=1; fi
fi

if [ "$NODE_OK" -ne 1 ]; then
  echo "==> 安装 Node.js 22"
  if command -v dnf >/dev/null 2>&1; then
    dnf module reset -y nodejs >/dev/null 2>&1 || true
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y nodejs
  elif command -v apt >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    echo "未识别的包管理器，请手动安装 Node.js 22 后重试"
    exit 1
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> 安装 pnpm"
  npm install -g pnpm@10
fi

if ! command -v git >/dev/null 2>&1; then
  echo "==> 安装 git"
  if command -v dnf >/dev/null 2>&1; then dnf install -y git
  elif command -v apt >/dev/null 2>&1; then apt-get install -y git
  fi
fi

# ---------- 2. 拉源码 ----------
echo "==> 拉取源码"
mkdir -p "$INSTALL_DIR"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git fetch --depth 1 origin "$GIT_REF"
  git checkout -B "$GIT_REF" "origin/$GIT_REF" 2>/dev/null || git checkout "$GIT_REF"
else
  git clone --depth 1 --branch "$GIT_REF" "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---------- 3. 安装依赖 + 编译 ----------
echo "==> 安装依赖"
cd "$INSTALL_DIR/agent"
pnpm install --prod=false

echo "==> 编译"
pnpm build

# ---------- 4. 配置 .env ----------
echo "==> 准备 .env"
if [ ! -f .env ]; then
  cp .env.example .env
  GEN_TOKEN="${BRIDGE_TOKEN:-$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')}"
  sed -i "s|^BRIDGE_TOKEN=.*|BRIDGE_TOKEN=$GEN_TOKEN|" .env
  sed -i "s|^PORT=.*|PORT=$PORT|" .env
  echo "[token] 已写入 .env"
else
  echo "[token] 已有 .env，跳过"
fi

# 适配真实 OpenClaw 默认端口
if grep -q "^# OPENCLAW_GATEWAY_PORT" .env; then
  sed -i "s|^# OPENCLAW_GATEWAY_PORT=.*|OPENCLAW_GATEWAY_PORT=18789|" .env
fi

echo "==> 生成 VAPID 推送密钥"
if grep -q "^VAPID_PUBLIC_KEY=$" .env || ! grep -q "^VAPID_PUBLIC_KEY=" .env; then
  node scripts/generate-vapid.mjs || echo "VAPID 生成失败，可稍后再运行 npm run vapid"
fi

# ---------- 5. systemd unit ----------
NODE_BIN="$(command -v node)"
echo "==> 写入 systemd unit"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Open Claw Bridge Agent
After=network.target openclaw-gateway.service
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/agent
EnvironmentFile=$INSTALL_DIR/agent/.env
ExecStart=$NODE_BIN $INSTALL_DIR/agent/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# 给桥接 systemctl 操作 openclaw-gateway 的权限
# 如不是 root 用户，请额外配 sudoers NOPASSWD
NoNewPrivileges=false

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

# ---------- 6. 防火墙 ----------
if command -v firewall-cmd >/dev/null 2>&1; then
  echo "==> firewalld 放行 ${PORT}/tcp"
  firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
elif command -v ufw >/dev/null 2>&1; then
  echo "==> ufw 放行 ${PORT}/tcp"
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
fi

# ---------- 7. 总结 ----------
sleep 2
TOKEN=$(grep "^BRIDGE_TOKEN=" "$INSTALL_DIR/agent/.env" | cut -d= -f2-)
PUBIP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo "================================================================"
echo " 部署完成"
echo "================================================================"
echo "  systemctl status $SERVICE_NAME"
echo "  journalctl -u $SERVICE_NAME -f"
echo ""
echo "  在手机端 PWA 设置页填入："
echo "    Agent URL : http://$PUBIP:$PORT"
echo "    Token     : $TOKEN"
echo ""
echo "  生产建议："
echo "    1) 配置 HTTPS（Caddy / Nginx 反代）"
echo "    2) ALLOWED_ORIGINS 改为你的 PWA 域名"
echo "    3) 给 $SERVICE_USER 配 sudoers，授权 systemctl restart openclaw-gateway"
echo "================================================================"
