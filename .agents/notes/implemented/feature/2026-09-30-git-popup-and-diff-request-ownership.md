# Agent 笔记：Git 分支弹层与差异请求归属

状态：已实现

## 先说结论

Windows 分支入口复用现有 Git 引用快照，显示最近、本地、远程分组及跟踪信息。Commit 动作打开既有提交工具窗口，差异刷新绑定到发起请求的工作区和文件。这里记录已接入的交互和竞态修复，不代表整个 Git 工作流已通过 IDEA 外观验收。

## 问题

旧分支菜单缺少远程跟踪和最近分支信息。打开提交面板的瞬时事件可能早于组件挂载；异步差异刷新仍可能使用后来激活的工作区状态，或在快速切换文件后关闭新页面。

## 决策

- 分支弹层锚定到按钮，复用现有 Popover 的焦点、外部关闭和键盘机制。已有仓库和 worktree 标签保留；新分组使用 Core 的 GitReferenceSnapshot，不再独立解析 Git 输出。
- 分支加载拥有请求编号和取消标识，关闭、切换仓库后拒绝旧结果。搜索覆盖动作、分支及跟踪名称；收缩全部分组后仍保留分组标题，以便重新展开。
- Update、Push、Checkout 和创建分支分别复用已有产品流程。创建分支采用已有 createAndCheckout 命令；操作错误显示给用户。JetBrains 快捷键预设新增对应命令，用户绑定继续优先。
- Commit 入口把持久的聚焦请求写到现有工作区 UI 状态，组件挂载后仍能消费。保留原有勾选文件、部分暂存和 Commit and Push 语义，打开面板不执行提交。
- 差异控制器持有取消资格、刷新合并计时器和代次。切换文件或卸载会清理计时器并拒绝迟到结果；不能物理取消的共用读取仍受既有后端期限限制。视图从暂存区转到工作区时使用已经加载的结果，不再重复读取第三次。
- 单次提交、提交范围、多次提交、stash、tag、分支与工作区比较共用最新选择资格；工作区和仓库变更后旧结果与旧错误都不能打开新项目页面。buffer 和编辑器面板操作捕获所属工作区，卸载时撤销旧资格。
- React 的开发严格模式会断开并重新连接副作用；重新连接生成新的资格，不能接收旧读取。差异导航继续使用 Monaco 的上一处、下一处修改 API，历史差异不套用工作区版本标题。

正确做法：读取请求绑定原仓库与原 buffer，返回后检查资格，再更新捕获的 Store。不要在 await 后读取全局当前 Store 并无条件关闭当前文件。

## 考虑过的备选方案

单独重写分支、提交和差异后端会破坏已有部分提交正确性。延时发出 Commit 事件仍不能保证组件挂载。每个文件变化立即刷新会增加 Git 子进程争用，因此合并刷新，并在读取期间收到更新时补一次刷新。

## 后果

现有 Git 后端与公共契约不变，快速切换时不再让旧结果修改新视图。差异共用请求只能撤销消费资格，不能中断其他消费者正在使用的读取。分支子菜单、完整提交与历史视觉、连接线和同尺寸截图仍按验收文档逐项核对。

## 验证

运行 `./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend`，覆盖分组与跟踪搜索、快捷键用户覆盖、迟到差异、刷新合并、卸载和重新连接，以及暂存区与工作区两次读取切换。继续回归既有部分提交与差异操作测试，并运行 `./scripts/build-windows.ps1 -Configuration Release`。

## 适用范围

`windows/tauri/src/features/git/`、`windows/tauri/src/features/keymaps/`、`windows/tauri/src/features/command-palette/constants/git-actions.tsx` 和 `windows/tauri/src/features/window/stores/ui-state/view-slice.ts`。
