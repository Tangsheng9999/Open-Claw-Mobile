import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor 5 配置
 *
 * 把 PWA 部署到 https://your-domain.com 之后，把 server.url 替换成线上地址，
 * 这样 App 内嵌的 WebView 直接加载在线版本，PWA 端发版就等于 App 发版。
 *
 * 也可以走 "build → copy" 模式：去掉 server.url，让 webDir 指向本地 Next.js
 * 静态导出产物。但因为我们用了 SWR + WebSocket 实时数据，更推荐 server.url。
 */
const config: CapacitorConfig = {
  appId: "app.openclaw.monitor",
  appName: "Claw Monitor",
  webDir: "www",
  server: {
    // 上线时改为你部署的域名
    url: "https://your-domain.com",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#1a1410",
  },
  android: {
    backgroundColor: "#1a1410",
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1410",
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#1a1410",
      androidSplashResourceName: "splash",
    },
  },
}

export default config
