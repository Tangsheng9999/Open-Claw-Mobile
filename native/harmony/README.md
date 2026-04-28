# HarmonyOS Next（鸿蒙原生壳）

最小可用的鸿蒙 ArkTS 项目骨架，使用 `Web` 组件加载部署好的 PWA。
鸿蒙 Web 组件 API 12+ 支持 Service Worker、IndexedDB、Web Push，所以 PWA 的离线缓存与通知在原生壳里仍可工作。

## 前置

- DevEco Studio 5.x（华为官方 IDE）
- HarmonyOS Next SDK（API 12 或更高）
- 华为开发者账号（要上 AppGallery 必须实名）

## 步骤

1. 用 DevEco Studio 选择 **File → New → Empty Ability**，包名建议 `app.openclaw.monitor`。
2. 把本目录的 `entry/src/main/` 完整覆盖进新项目对应路径。
3. 修改 `pages/Index.ets` 里的 `PWA_URL` 为你的部署域名（必须 HTTPS）。
4. 在 DevEco 里 **Build → Build Hap(s) / APP(s)** 即可生成 .hap。
5. 用真机或鸿蒙模拟器调试。

## 上 AppGallery 注意事项

- 鸿蒙审核会校验 Web 组件加载的域名 — 必须是已备案域名。
- 如果应用主要功能依赖 PWA，可勾选「自由安装服务」（Atomic Service / 元服务）作为分发形式。
- PWA 端的 Web Push 需要鸿蒙 Web 组件 API 12+ 才支持。低版本设备退化为 SWR 5 秒轮询。

## 与 PWA 联调

应用启动后，会直接进入仓库根目录里的 PWA。Bridge Agent 配置（地址 + Token）保存在 Web 端 localStorage，鸿蒙 Web 组件默认开启了 `domStorageAccess`，刷新不丢失。
