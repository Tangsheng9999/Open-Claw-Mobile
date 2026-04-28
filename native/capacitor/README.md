# Capacitor 打包（iOS + Android）

把 Open Claw Mobile PWA 用原生 WebView 加载并打包成 .ipa / .apk。
适合需要上 App Store / 需要原生通知 / 需要生物识别等高级能力的场景。

## 一次性准备

```bash
cd native/capacitor
pnpm install
# 修改 capacitor.config.ts 里的 server.url 为你的部署域名
```

## Android

```bash
pnpm run add:android       # 生成 android/ 项目
pnpm run open:android      # 用 Android Studio 打开
# 在 Android Studio 里 Build → Generate Signed Bundle / APK
```

## iOS（需要 macOS + Xcode）

```bash
pnpm run add:ios           # 生成 ios/ 项目
pnpm exec pod install --project-directory=ios/App
pnpm run open:ios          # 用 Xcode 打开 → Archive → Distribute App
```

## 原生 Push（可选，App Store 推荐）

iOS Web Push 受限较多。如果走 App Store 上架建议用 `@capacitor/push-notifications` + APNs：

1. Apple Developer 账号开通 Push Notification capability
2. 在 Capacitor App 启动时调用 `PushNotifications.register()`，把得到的 device token 通过 `agentApi.push.subscribe` 上报到 Bridge Agent
3. Bridge Agent 端如果要支持 APNs，需另行接入 `node-apn` —— 当前 `agent/src/push.ts` 只支持 Web Push（VAPID）。

不上 App Store、只通过 sideload / Cordova 私有渠道分发时，Web Push 在 iOS 16.4+ 已可用，无需改 Agent。

## 排错

- **App 打开是白屏**：检查 `capacitor.config.ts` 的 `server.url` 能否在手机浏览器直接访问
- **API 请求被 Mixed Content 拦截**：Bridge Agent 必须 HTTPS（套 Caddy / Nginx 或 Cloudflare Tunnel）
- **WebSocket 连不上**：iOS 默认禁止明文 WS，必须 wss://
