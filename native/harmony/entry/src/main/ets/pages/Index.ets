import webview from '@ohos.web.webview'

/**
 * 鸿蒙首页：用 Web 组件加载部署好的 PWA。
 *
 * 部署 PWA 后把 PWA_URL 改成你的 https 域名即可。
 * 鸿蒙 Web 组件支持 Service Worker、Web Push（API 12+）、IndexedDB，
 * 所以 PWA 的离线能力与通知在鸿蒙原生壳里也能用。
 */
const PWA_URL: string = 'https://your-domain.com'

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController()
  @State loading: boolean = true

  build() {
    Stack() {
      Web({ src: PWA_URL, controller: this.controller })
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(true)
        .geolocationAccess(true)
        .javaScriptAccess(true)
        .mixedMode(MixedMode.None)
        .cacheMode(CacheMode.Default)
        .darkMode(WebDarkMode.On)
        .onPageBegin(() => { this.loading = true })
        .onPageEnd(() => { this.loading = false })
        .width('100%')
        .height('100%')

      if (this.loading) {
        Column() {
          LoadingProgress()
            .width(48)
            .height(48)
            .color('#c97f3f')
          Text('正在连接 Open Claw…')
            .fontSize(13)
            .fontColor('#a39a8e')
            .margin({ top: 16 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#1a1410')
      }
    }
    .width('100%')
    .height('100%')
  }
}
