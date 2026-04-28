# Open Claw Mobile

> 在手机上监控、管理与控制运行在 VPS / macOS 上的 [OpenClaw](https://openclaw.ai/) 实例。

一个 PWA（渐进式 Web 应用），同时支持 **Android、iOS、HarmonyOS** —— 把网址添加到主屏幕即可像原生 App 一样使用。

## 功能

- **实时仪表盘**：CPU / 内存 / 活跃会话 / 当日 Token 用量，每 2 秒通过 WebSocket 推送
- **会话监控**：正在进行的对话、所属渠道（CLI / API / Web / MCP）、模型、Token 消耗
- **项目监控**：活跃项目、最后活动时间、Agent 数量
- **模型管理**：查看当前默认模型，添加第三方模型（OpenAI / Anthropic / Ollama / 自定义 OpenAI 兼容），一键拉取与测试延迟
- **系统控制**：重启网关、升级 OpenClaw、清理缓存、停止服务
- **诊断面板**：可执行文件、数据目录、内存、磁盘、外网连通性 5 项一键检查

## 架构

```
┌────────────────────┐         HTTPS + Bearer Token          ┌──────────────────────┐
│  手机 PWA          │ ───────────────────────────────────►   │  VPS / macOS Agent   │
│  (Next.js)         │ ◄── WebSocket /ws (实时心跳) ──────    │  (Node.js + Hono)    │
└────────────────────┘                                          │  调用本地 openclaw   │
                                                                └──────────────────────┘
```

- `app/` — Next.js PWA，部署在 Vercel 或自托管
- `agent/` — 部署到运行 OpenClaw 的服务器上的桥接 Agent

## 快速开始

### 1. 部署 PWA（手机端）

最简单的方式是部署到 Vercel：

```bash
git clone https://github.com/<your-name>/open-claw-mobile.git
cd open-claw-mobile
pnpm install
pnpm dev          # 本地开发
# 或推到 Vercel 一键部署
```

部署完成后用手机浏览器打开域名 → 浏览器菜单 → "添加到主屏幕"。

### 2. 在 VPS / Mac 上部署 Bridge Agent

```bash
# 在你的 VPS 或 macOS 上
git clone https://github.com/<your-name>/open-claw-mobile.git
cd open-claw-mobile/agent
bash scripts/install.sh
```

安装脚本会：
- 检查 Node.js >= 20
- 安装依赖（`pnpm` / `npm`）
- 生成随机 `BRIDGE_TOKEN` 写入 `.env`
- 编译 TypeScript

启动方式：

```bash
# 前台测试
npm start

# Linux 后台（systemd）
sudo cp openclaw-bridge.service /etc/systemd/system/
sudo systemctl enable --now openclaw-bridge

# macOS 后台（launchd）
cp com.openclaw.bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.openclaw.bridge.plist
```

### 3. 在手机上连接

打开 PWA → 点击底部 **设置** Tab：

- **Agent 地址**：`https://your-vps.com:8787`（或 Tailscale / Cloudflare Tunnel 域名）
- **Token**：粘贴 `agent/.env` 中的 `BRIDGE_TOKEN`
- 点击 **测试连接** → 保存

完成后所有 Tab 都会显示真实数据。

## 安全建议

- **必须**给 Agent 套一层 HTTPS（Caddy / Nginx 反代 / Cloudflare Tunnel）
- **不要**把 8787 端口直接暴露公网而不带 TLS
- 推荐使用 [Tailscale](https://tailscale.com/) 把手机和 VPS 加进同一个 tailnet，连内网 IP 即可，零暴露面
- `BRIDGE_TOKEN` 至少 32 字节随机；定期轮换

## 浏览器/平台兼容

| 平台          | 安装方式                                    | 备注                  |
| ------------- | ------------------------------------------- | --------------------- |
| Android       | Chrome / Edge → 添加到主屏幕                | 完整 PWA 支持         |
| iOS / iPadOS  | Safari → 分享 → 添加到主屏幕                | 推送通知需 iOS 16.4+  |
| HarmonyOS     | 浏览器 → 添加到桌面                         | 鸿蒙原生浏览器已支持  |
| 桌面          | Chrome / Edge → 地址栏右侧"安装"            | 全部功能可用          |

## 目录结构

```
open-claw-mobile/
├── app/                  # Next.js PWA 页面（仪表盘 / 会话 / 项目 / 模型 / 系统 / 设置）
├── components/           # UI 组件
├── lib/                  # 共享类型、Agent 客户端、SWR Hooks
├── agent/                # VPS / macOS 桥接服务
│   ├── src/              # Hono + WebSocket + OpenClaw CLI 桥接
│   ├── scripts/          # 一键安装脚本
│   ├── openclaw-bridge.service        # systemd 单元
│   └── com.openclaw.bridge.plist      # launchd 单元
└── README.md
```

## 开发

```bash
# PWA
pnpm install
pnpm dev          # http://localhost:3000

# Agent（另开一个窗口）
cd agent
pnpm install
pnpm dev          # http://localhost:8787
```

## 路线图

- [ ] 离线模式 + 本地缓存最近一次状态
- [ ] 多 Agent 切换（同一 App 监控多台机器）
- [ ] Web Push 通知（CPU 飙升 / 错误 / 升级完成）
- [ ] 终端窗口（在 PWA 内执行 `openclaw` 命令）
- [ ] 鸿蒙 Next 上架元服务

## License

MIT — 详见 [LICENSE](./LICENSE)。

> 与 [OpenClaw](https://openclaw.ai/) 项目无官方关联。
