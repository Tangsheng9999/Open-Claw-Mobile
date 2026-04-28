import UIAbility from '@ohos.app.ability.UIAbility'
import hilog from '@ohos.hilog'
import window from '@ohos.window'

const TAG = 'ClawMonitor'

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    hilog.info(0x0000, TAG, 'Ability onCreate')
  }

  onDestroy(): void {
    hilog.info(0x0000, TAG, 'Ability onDestroy')
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(0x0000, TAG, 'WindowStageCreate')

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, TAG, 'loadContent failed: %{public}s', JSON.stringify(err))
        return
      }
      // 沉浸式：扩展到状态栏
      windowStage.getMainWindow().then((win) => {
        win.setWindowLayoutFullScreen(true).catch(() => {})
        win.setWindowSystemBarProperties({
          statusBarColor: '#1a1410',
          statusBarContentColor: '#f5f1ec',
          navigationBarColor: '#1a1410',
          navigationBarContentColor: '#f5f1ec',
        }).catch(() => {})
      })
    })
  }
}
