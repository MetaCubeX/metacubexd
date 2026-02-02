## 1. 基础设施

- [x] 1.1 创建 `stores/shortcuts.ts` Pinia store 管理快捷键配置
- [x] 1.2 创建 `composables/useKeyboardShortcuts.ts` 封装键盘监听逻辑
- [x] 1.3 定义默认快捷键配置常量 `constants/shortcuts.ts`

## 2. 核心功能实现

- [x] 2.1 使用 VueUse `useMagicKeys` 实现全局键盘监听
- [x] 2.2 实现页面导航快捷键 (g+p, g+c, g+o, g+r, g+l, g+s)
- [x] 2.3 实现操作快捷键 (r 刷新, Escape 关闭弹窗)
- [x] 2.4 实现输入框焦点检测，禁用输入时的快捷键

## 3. 快捷键帮助面板

- [x] 3.1 创建 `components/ShortcutsHelpModal.vue` 帮助弹窗组件
- [x] 3.2 实现按 `?` 键显示帮助面板
- [x] 3.3 按分类展示所有可用快捷键

## 4. 自定义配置

- [x] 4.1 在 Config 页面添加快捷键设置区域
- [x] 4.2 实现快捷键绑定编辑器组件
- [x] 4.3 实现快捷键冲突检测逻辑
- [x] 4.4 实现重置为默认配置功能
- [x] 4.5 使用 localStorage 持久化自定义配置

## 5. 集成与测试

- [x] 5.1 在 `app.vue` 或 `layouts/default.vue` 集成全局快捷键监听
- [x] 5.2 添加移动端检测，隐藏快捷键相关 UI
- [x] 5.3 添加国际化文本 (快捷键名称、帮助面板)
- [x] 5.4 编写单元测试验证快捷键逻辑
