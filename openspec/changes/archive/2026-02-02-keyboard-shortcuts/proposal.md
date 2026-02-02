## Why

目前 MetaCubeXD 仪表盘只能通过鼠标点击进行操作，对于高级用户来说效率较低。添加键盘快捷键支持可以显著提升操作效率，让用户无需离开键盘即可完成常见操作。

## What Changes

- 添加全局键盘快捷键系统，支持页面导航和常用操作
- 实现快捷键帮助面板（按 `?` 显示）
- 支持用户自定义快捷键配置
- 添加快捷键冲突检测机制

## Capabilities

### New Capabilities

- `keyboard-shortcuts`: 全局键盘快捷键系统，包括页面导航快捷键（G+P 跳转代理页等）、操作快捷键（R 刷新、Esc 关闭弹窗等）、快捷键帮助面板、自定义配置

### Modified Capabilities

（无）

## Impact

- **组件**: 需要在 App 根组件添加全局键盘事件监听
- **Store**: 新增 `stores/shortcuts.ts` 管理快捷键配置
- **Composable**: 新增 `composables/useKeyboardShortcuts.ts`
- **UI**: 新增快捷键帮助弹窗组件
- **设置页**: 在 Config 页面添加快捷键配置区域
