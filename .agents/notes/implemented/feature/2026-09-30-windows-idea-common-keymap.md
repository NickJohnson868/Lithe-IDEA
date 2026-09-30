# Agent 笔记：Windows 常用 IDEA 快捷键

状态：已实现

## 先说结论

Windows 新配置默认使用 IDEA 常用快捷键，已有配置保留用户选择。快捷键复用现有命令和编辑器能力，用户自定义覆盖仍优先；本次不补造尚不存在的重构功能。

## 问题

旧预设把 Ctrl+B 绑定到引用，且统一入口提前将 Ctrl+W 解释成关闭文件。按命令建立单值映射还会丢失同一命令的多个快捷键。

## 决策

预设显式绑定先于继承绑定，按命令替换整组绑定，同时保留组内别名和焦点条件。IDEA 预设的 Ctrl+W 和 Ctrl+Shift+W 通过命令路由处理，不经过旧关闭快捷路径。

例如 Ctrl+E 和 Ctrl+Shift+N 都能打开现有文件选择器；不要把它们放进单值映射后仅保留最后一项。编辑动作只处理编辑器焦点，普通设置输入框继续由浏览器处理。

## 考虑过的备选方案

逐个组件新增键盘监听会绕开用户覆盖并造成重复执行，因此沿用现有注册表。全面复制 IDEA 动作超出已有功能范围，因此只绑定常用且已有的能力，不把项目搜索冒充项目替换。

## 后果

常用操作保持一致并支持别名；冲突的旧默认绑定在此预设中停用，功能仍可从原入口使用。文件选择器和运行上下文沿用 Lithe 的现有语义，不能宣称所有 IDEA 界面和动作完全相同。

## 验证

运行 `./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend -IsolateFrontendFiles -SuiteTimeoutSeconds 300`，检查常用动作只执行一次、选区快捷键不关闭文件、设置输入框不被劫持。随后运行 `./scripts/build-windows.ps1 -Configuration Release`。

## 适用范围

`windows/tauri/src/features/keymaps/` 和 `windows/tauri/src/features/settings/config/default-settings.ts`；不改变 macOS 键位或共享 Rust 契约。
