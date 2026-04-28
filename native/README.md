# 原生壳打包脚手架

本目录提供把 PWA 打包成 Android、iOS、HarmonyOS Next 原生应用的最小脚手架。
PWA 主体已经在仓库根目录，部署一次（推荐部署到 Vercel）拿到 `https://your-domain.com`，
然后选择下面任一方案把它包装成原生 App 发布。

| 目录            | 平台                       | 推荐场景                                                                 |
| --------------- | -------------------------- | ------------------------------------------------------------------------ |
| `bubblewrap/`   | Android（TWA / Play Store）| 最轻量，5 分钟拿到 .apk / .aab，原生通知由浏览器代发。                   |
| `capacitor/`    | iOS + Android              | 需要原生功能（生物识别、原生 Push、剪贴板等）或要发 App Store 时用。     |
| `harmony/`      | HarmonyOS Next 元服务      | 鸿蒙单独的 ArkTS 项目，用 Web 组件加载部署好的 PWA。                     |

## 共同前置

1. 在 Vercel / 自建服务器上把 PWA 部署成 HTTPS 可访问的域名。
2. PWA 必须能正常运行 — 至少一台 Bridge Agent 已配好。
3. 准备好 OpenClaw / Open Claw Mobile 的应用图标（512×512 PNG，本仓库已有 `public/icon-512.png`）。

## 选择建议

- **只需要让用户在手机上像 App 一样使用** → 不打包，直接让用户在 Chrome / Safari 选「添加到主屏幕」。
- **需要上 Play Store** → `bubblewrap/`。
- **需要上 App Store / 要原生 Push** → `capacitor/`。
- **需要上华为 AppGallery / 鸿蒙原生** → `harmony/`。

