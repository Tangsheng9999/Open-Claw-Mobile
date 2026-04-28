# Bubblewrap（Android TWA / Play Store）

最快的安卓打包路径。生成的 .apk 实质是 Trusted Web Activity，由 Chrome Custom Tab 渲染你的 PWA，原生通知通过 Web Push 直接由 Chrome 代发。

## 前置

- Java JDK 17
- Android SDK
- 全局安装 Bubblewrap：`pnpm add -g @bubblewrap/cli`
- PWA 已部署到 HTTPS 域名

## 步骤

```bash
cd native/bubblewrap
# 1) 把 twa-manifest.json 里的 your-domain.com 改成你的域名
# 2) 初始化项目
bubblewrap init --manifest=https://your-domain.com/manifest.webmanifest

# 3) 用我们提供的 twa-manifest.json 覆盖刚才生成的（保留更细的颜色 / 快捷方式）
cp twa-manifest.json ./

# 4) 生成签名 keystore（首次）
keytool -genkey -v -keystore android.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000

# 5) 打包
bubblewrap build

# 产物：app-release-signed.apk / app-release-bundle.aab
```

## 重要：双向验证

为了让 Android 信任你的域名（不在地址栏出现浏览器 UI），必须配置 Digital Asset Links：

1. `bubblewrap build` 完成后会打印 SHA-256 fingerprint
2. 把它填入 `public/.well-known/assetlinks.json`（仓库已经提供模板）
3. 重新部署 PWA，确保 `https://your-domain.com/.well-known/assetlinks.json` 可访问
4. 用 `https://developers.google.com/digital-asset-links/tools/generator` 校验

## 上 Play Store

直接把 `.aab` 上传到 Play Console。第一次审核约 1-3 天。
