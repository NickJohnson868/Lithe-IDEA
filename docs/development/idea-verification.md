# Windows IDEA 对齐验证记录

记录日期：2026-09-30。此报告区分代码修复、自动回归与原生界面验收，不把实现存在标为外观完全一致。

## 确认修复

| 问题 | 修复与验证依据 |
| --- | --- |
| 目录只能展开、读取迟到后重新展开 | 目录控制器合并请求、取消预加载、保护项目与展开代数；空目录缓存、快速收缩及工作区切换测试 |
| 全文搜索扫描大量忽略目录 | 默认项目忽略范围，保留包含开关；复用可靠内容索引、取消旧查询；规则否定、文件变化与分页测试 |
| Java 字段和方法仍为普通标识符颜色 | Windows 适配层错误地将已有 Core semanticTokens 列为不支持；接通请求并转发刷新通知，适配器测试验证服务端 legend 与返回值 |
| 正确配色定义仍显示错误颜色 | Java TextMate 注解被归为关键字、Javadoc 被归为普通注释、运算符被归为关键字；真实语法与 Monaco 匹配器测试验证注解黄色、赋值灰白、字符串绿色及 Javadoc 绿色 |
| Maven 模块图标只有展开后出现 | 订阅已有 Maven 项目模型，未加载子级也能识别模块；保留官方 SVG 色值，验证嵌套 reactor、项目切换、移除模块及普通目录 |
| 定义跳转使用错误目标或旧编辑内容 | Monaco 保留服务端实际 URI 与范围；点击和快捷键等待文本同步，右边缘点击收敛到符号内部；受控同步与物理／反编译目标测试。尚未完成用户项目所有方法的实际点击验收 |
| 启动期间空定义结果导致同一方法反复提示未找到 | 点击重新检查空缓存，成功结果仍复用；同一文件版本先空后成功、再次点击命中缓存的受控回归 |
| 快速切换仓库、文件或提交时显示旧差异 | 差异读取校验工作区、仓库和请求代数；刷新合并、释放定时器、StrictMode 重连接及迟到结果测试 |
| 未修改的目录被未跟踪文件染红 | 真实项目该模块只有一个未跟踪的 Java 备份文件；取消未跟踪状态向祖先传播，已跟踪后代变化统一映射目录蓝色，覆盖顺序、暂存、新增、删除、重命名回归 |
| target 等忽略条目颜色被背景冲淡 | 去掉整行半透明，显式使用 Islands `git-ignored` 文字色；保留跟踪文件实际 Git 状态优先级 |
| 差异页面刷新反复创建编辑器及全局主题 | 已有内容刷新保留 Monaco，缓存恢复数据解析；相同主题连续 100 次请求只注册一次，替换主题与原对象更新仍重新注册 |
| 全量前端测试互相污染 | 固定 Bun 下按测试文件隔离进程，共享 suite 截止时间；Maven 启动保存依赖改为按需加载，保留失败阻止启动行为 |

## 自动验证

### 常用 IDEA 快捷键（2026-09-30）

Windows 新配置默认选用 IntelliJ IDEA 预设，已有配置保留选择；本机已切换到该预设。
键位依据 [IDEA Windows 默认快捷键](https://www.jetbrains.com/help/idea/reference-keymap-win-default.html)，复用已有命令。用户自定义绑定仍优先。

| 操作 | 快捷键 |
| --- | --- |
| 格式化文件 | Ctrl+Alt+L |
| 后退／前进 | Ctrl+Alt+←／→ |
| 定义／实现 | Ctrl+B／Ctrl+Alt+B |
| 查找引用／重命名 | Alt+F7／Shift+F6 |
| 复制行／删除行 | Ctrl+D／Ctrl+Y |
| 扩大／缩小选区 | Ctrl+W／Ctrl+Shift+W |
| 行注释 | Ctrl+/ |
| 参数提示／快速修复 | Ctrl+P／Alt+Enter |
| 文件搜索／最近文件入口 | Ctrl+Shift+N／Ctrl+E |
| 当前文件替换 | Ctrl+R |
| 项目／终端 | Alt+1／Alt+F12 |
| Commit／Push／Update | Ctrl+K／Ctrl+Shift+K／Ctrl+T |
| 关闭文件 | Ctrl+F4 |

最近文件入口使用现有文件选择器；未新增全项目替换等未实现能力。自动测试验证
常用键只触发一次、别名保留、Ctrl+W 不再关闭文件、普通输入框编辑键不被劫持。
本次前端 1326 项通过，类型检查通过；Windows Release 构建通过，构建后
WindowsRust 161 项通过。原生逐键人工验收未执行。

前端使用固定 Bun 1.3.12：

`./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend -IsolateFrontendFiles -SuiteTimeoutSeconds 300`

前端最新回归 1324 项全部通过，公共编辑器此前另有 14 项通过；Java 语义请求、真实语法着色、模块模型与定义跳转均有逐测试报告。逐测试报告保存在本地 `.artifacts/test-stability/windows-frontend.json`、JUnit 与 `index.html`。本次真实 JDTLS 物理与反编译导航 smoke 通过，耗时约 19.8 秒，使用独立临时项目和 120 秒进程截止时间，未改动用户项目。本次标准 WindowsRust timing 范围 161 项全部通过，最慢用例 706ms；报告为 `windows-rust.json`。Core 此前搜索／语言／项目重点范围 53 项通过，Git 部分提交／暂存保留／失败恢复等重点范围 16 项通过。完整 Core 运行此前出现本地提交删除测试取消，不能称全部 Core 测试通过。

资源复用测试、测试 harness 自测、Agent Notes 校验、功能矩阵生成校验、Rust fmt 与 missing_docs Rustdoc 检查通过。Windows Release 通过标准构建入口验证；linker warning 保留在本地构建日志。

## 未完成的验收

### 当前 Java 索引恢复（18:46 补充）

针对截图中 `ApiSystemO2oDataCoreImageController.java` 第 42 行的调用，使用
软件实际的启动资源、workspace fingerprint 与缓存目录复现了空定义结果。
JDTLS 此时报告 ServiceReady，但 `java.project.getAll` 返回空 Java 项目列表，
`java.project.listSourcePaths` 也为空；包含非 Java 项目时仅有根项目。
缓存磁盘上虽然留有模块元数据，运行中的服务并没有加载这些 Java 模块。
独立缓存能解析同一文件、同一位置，因此此前独立 smoke 漏掉了这个故障状态。

已停止应用和所属 JVM，保留旧索引备份后重新导入本机项目。重新导入识别到
46 个项目、258 个源码根，同一调用返回服务方法第 35 行；首次完整导入及
查询、停止合计 316.40 秒。随后使用同一缓存重新启动并重复查询，通过，
全流程 22.96 秒。这些耗时包含语言服务启停，不能当作点击跳转延迟。
本地原始证据为 `.artifacts/adapter-actual-cache-probe.log`（修复前失败）、
`.artifacts/adapter-rebuilt-cache.log` 和 `.artifacts/adapter-rebuilt-cache-restart.log`
（修复后通过）。未修改用户 Java 源码或程序实现，未据此宣称其他方法或原生
点击流程全部验收。旧索引为何进入该状态尚未确定，保留备份供后续定位。
诊断进程已退出，重新启动一个原有 Release 实例供使用。

应用重新启动后的真实会话进一步确认：18:47 的 Maven Profiles 日志包含
`projectCount=46`；原调用位置（零基 line 41、character 55）的
`definition-link resolve:end` 返回 `location_count=1`，后续其他位置也返回
非空定义。该证据来自运行中的 Release，而非独立测试进程；尚未进行全部
Java 方法与原生跳转落点的系统验收。

2026-09-30 此前验证：前端 1324 项通过，类型检查通过；Windows Release 构建通过，构建后 WindowsRust 161 项通过。独立 Core 查询以及 Windows 产品的 `invokeLsp` 适配层查询均返回服务方法第 35 行；Lombok getter 查询返回字段第 20 行。后者本地集成检查耗时 17.265 秒（含会话启停），使用的是另一个 Controller 与独立缓存，不能作为用户当前会话已恢复的证据。前期桥接脚本编码故障和超时实例已单独清理，不计作通过。

原生 UI 的同尺寸、固定 DPI 截图和端到端 P95 尚未完成，不能声称与 IDEA 完全一致。目录、输入、文件打开、Git 历史及差异还需要实际操作计时。热索引 Core 搜索稀有词／无结果 P95 为 754／755ms，无索引为 1625／1651ms；索引预热成本另计，详见 `idea-performance.md`。

模块图标现在使用当前 Maven 项目模型；模型准备完成后无需展开目录。非标准源根的展示仍不能仅靠名称猜测。用户 Java 项目实际点击后的结果尚待原生 UI 验收，服务 ready 或独立 smoke 成功不代表全部方法都能解析。完整 Commit 面板、历史图与筛选和每个菜单状态的视觉对齐仍未验收。macOS Swift 及依赖当前机器缺少的 Ruby／zsh 门禁未执行；共享消费者保持兼容，但不能代替另一平台运行。

只提交与推送到用户 fork `NickJohnson868/Lithe-IDEA`，不向原项目创建提交、issue 或 PR。用户要求启动的 Release 实例保留，其余验证进程在完成后结束。
