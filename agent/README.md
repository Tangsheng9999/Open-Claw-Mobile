# Open Claw Bridge Agent

部署在运行 OpenClaw 的 VPS / macOS 上的桥接服务，通过 HTTPS + Bearer Token + WebSocket 把本地状态与控制接口暴露给手机端 PWA。

## 系统要求

- Node.js >= 20
- 已安装 `openclaw` CLI（[openclaw.ai](https://openclaw.ai/)）
- Linux（systemd）或 macOS（launchd）

## 安装

```bash
bash scripts/install.sh
```

## 接口

所有 `/api/*` 路径都需要 `Authorization: Bearer <BRIDGE_TOKEN>`。

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET  | `/health` | 公开健康检查 |
| GET  | `/api/status` | 系统总览 |
| GET  | `/api/conversations` | 会话列表 |
| GET  | `/api/projects` | 项目列表 |
| GET  | `/api/models` | 模型列表 |
| POST | `/api/models/add` | 添加第三方模型（body: provider/id/apiKey/baseUrl）|
| POST | `/api/models/:id/pull` | 拉取模型 |
| POST | `/api/models/:id/test` | 测试模型 |
| POST | `/api/system/gateway/restart` | 重启网关 |
| POST | `/api/system/upgrade` | 升级 OpenClaw |
| POST | `/api/system/cache/clear` | 清理缓存 |
| POST | `/api/system/stop` | 停止服务 |
| POST | `/api/diagnostics/run` | 运行诊断 |
| WS   | `/ws?token=<TOKEN>` | 实时心跳推送（每 2 秒） |

## 环境变量

见 [`.env.example`](./.env.example)。

## 安全建议

- 用 Caddy / Nginx / Cloudflare Tunnel 套 HTTPS
- 优先用 Tailscale 走内网而非暴露公网
- `BRIDGE_TOKEN` 至少 32 字节随机，定期轮换

## 故障排查

- `openclaw 未在 PATH 中找到`：`which openclaw` 后把绝对路径填到 `.env` 的 `OPENCLAW_BIN`
- `EADDRINUSE`：8787 端口被占用，改 `.env` 的 `PORT`
- `journalctl -u openclaw-bridge -f`（systemd）查看日志
- `tail -f /tmp/openclaw-bridge.log`（macOS launchd）查看日志
