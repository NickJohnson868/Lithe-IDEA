# Windows IDEA 对齐验证记录

记录日期：2026-09-30。此报告区分代码修复、自动回归与原生界面验收，不把实现存在标为外观完全一致。

## 确认修复

| 问题 | 修复与验证依据 |
| --- | --- |
| 目录只能展开、读取迟到后重新展开 | 目录控制器合并请求、取消预加载、保护项目与展开代数；空目录缓存、快速收缩及工作区切换测试 |
| 全文搜索扫描大量忽略目录 | 默认项目忽略范围，保留包含开关；复用可靠内容索引、取消旧查询；规则否定、文件变化与分页测试 |
| Java 字段和方法仍为普通标识符颜色 | Windows 适配层错误地将已有 Core semanticTokens 列为不支持；接通请求并转发刷新通知，适配器测试验证服务端 legend 与返回值 |
| Maven 模块目录使用普通文件夹图标 | 已加载 pom.xml 所在目录映射独立模块角色；保留官方模块 SVG 色值，嵌套模块及普通目录识别测试 |
| 快速切换仓库、文件或提交时显示旧差异 | 差异读取校验工作区、仓库和请求代数；刷新合并、释放定时器、StrictMode 重连接及迟到结果测试 |
| 全量前端测试互相污染 | 固定 Bun 下按测试文件隔离进程，共享 suite 截止时间；Maven 启动保存依赖改为按需加载，保留失败阻止启动行为 |

## 自动验证

前端使用固定 Bun 1.3.12：

`./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend -IsolateFrontendFiles -SuiteTimeoutSeconds 300`

前端 1311 项全部通过，套件耗时约 64.6 秒；新增 Java 语义请求及刷新回归 47ms，嵌套模块角色回归低于报告的毫秒精度。逐测试报告保存在本地 `.artifacts/test-stability/windows-frontend.json`、JUnit 与 `index.html`。Windows Rust 标准范围 215 项通过；Core 搜索／语言／项目重点范围 53 项通过，Git 部分提交／暂存保留／失败恢复等重点范围 16 项通过。完整 Core 运行此前出现本地提交删除测试取消，不能称全部 Core 测试通过。

资源复用测试、测试 harness 自测、Agent Notes 校验、功能矩阵生成校验、Rust fmt 与 missing_docs Rustdoc 检查通过。Windows Release 通过标准构建入口验证；linker warning 保留在本地构建日志。

## 未完成的验收

原生 UI 的同尺寸、固定 DPI 截图和端到端 P95 尚未完成，不能声称与 IDEA 完全一致。目录、输入、文件打开、Git 历史及差异还需要实际操作计时。热索引 Core 搜索稀有词／无结果 P95 为 754／755ms，无索引为 1625／1651ms；索引预热成本另计，详见 `idea-performance.md`。

模块图标识别目前沿用已加载 Maven 描述符的展示规则，未加载目录和非标准源根不能仅靠名称猜测项目模型。完整 Commit 面板、历史图与筛选和每个菜单状态的视觉对齐仍未验收。macOS Swift 及依赖当前机器缺少的 Ruby／zsh 门禁未执行；共享消费者保持兼容，但不能代替另一平台运行。

只提交与推送到用户 fork `NickJohnson868/Lithe-IDEA`，不向原项目创建提交、issue 或 PR。用户要求启动的 Release 实例保留，其余验证进程在完成后结束。
