# Agent 笔记：前端模块 mock 的文件进程隔离

状态：已实现

## 先说结论

Windows 前端全量测试可使用独立进程运行每个文件，避免一个文件的模块替换污染另一个文件。默认单进程入口保留，隔离入口仍记录每项测试耗时、失败和资源清理。隔离不能掩盖单个文件内的真实失败。

## 问题

固定 Bun 版本下，多处 mock.module 会改变后续测试看到的模块。全量单进程运行出现 Store 方法缺失、翻译替换和 Git 请求未调用；独立运行相同文件不再出现这些问题。另有 Maven 状态初始化提前加载编辑器与 SVG 展示资源的问题，必须修复真实依赖边界，不能只靠其他测试留下的 mock 让它通过。

## 决策

- 标准 Windows 脚本提供 IsolateFrontendFiles 开关。每个文件启动单独的 Bun，复用原有有界进程工具和 JUnit 解析，不改变断言或过滤失败用例。
- 所有文件共用一次套件期限；每项测试继续采用原有本地期限，每个文件进程也有本地期限。超时或缺失 JUnit 结果进入聚合报告，不能记为通过。
- 报告保留文件归属、单测试耗时和失败；合成原有 HTML、JSON、JUnit 三种输出，不引入新报告或缓存目录。
- Maven 构造状态时只保留保存工作区接口的类型，真正启动任务时再加载编辑器保存流程；保存失败继续阻止启动。测试使用既有依赖注入，独立运行不需要伪造 UI 资源。

正确做法：完整隔离运行后仍失败的用例，定位产品或用例本身。不要忽略失败文件，或让另一个测试的 mock 隐式提供其依赖。

## 考虑过的备选方案

调整测试顺序无法保证模块替换的所有组合。统一替换全部 Store 或图标会使依赖真实生产实现的测试失去意义。升级 Bun 需要独立确认工具链兼容，因此本轮保留固定版本，增加显式的进程隔离入口。

## 后果

独立文件不会共享模块状态，单个文件失败也不会改变其他文件结果。代价是重复启动 Bun，运行时间比单进程更长；单进程入口仍可用于不依赖模块 mock 的小范围回归。套件期限没有按文件重置。

## 验证

运行 `node .agents/skills/write-stable-tests/scripts/test-verify-test-stability.mjs`，验证文件顺序、结果聚合、清理和共享期限。运行 `./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend -IsolateFrontendFiles` 完整回归。Maven 原有用例继续覆盖启动前保存等待及保存失败阻止任务。

## 适用范围

`.agents/skills/write-stable-tests/` 与 `windows/tauri/src/features/maven/stores/maven.store.ts`。Rust 和 macOS 测试流程不变。
