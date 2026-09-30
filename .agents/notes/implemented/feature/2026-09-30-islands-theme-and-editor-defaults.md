# Agent 笔记：Islands 配色与编辑器默认设置

状态：已实现

## 先说结论

Windows 内置深色主题按固定的 IntelliJ Community Islands 资源映射颜色，编辑器默认使用 Ubuntu Mono 17 和连字。只有完整匹配旧默认字体组合的设置才迁移，用户改过的字体或主题继续保留。主题映射已实现，完整界面的同尺寸截图验收仍待完成。

## 问题

原主题的通用文本色会覆盖显式的标识符颜色；Java 静态成员修饰信息没有保留。仅改全局背景无法对齐编辑器词法、语义和 Git 文件状态的区别，字体仅在设置里写名字也不能保证未安装的机器可用。

## 决策

- 内置主题集中保存界面、编辑器和 Git 状态颜色。缺少颜色时才应用通用补色，不覆盖明确声明的词法角色。
- 语义着色继续由 JDTLS 提供，公共 Monaco 层保留服务端的 static 等修饰符。深色主题选择静态成员斜体；原有 readonly、deprecated 位序不变，其他平台没有默认开启这项展示。
- Windows 必须将 `lsp_get_semantic_tokens` 路由到已有 Core `semanticTokens` 操作，并转发服务器刷新通知。此前前端仍将该命令列为不支持，导致 Java 字段和方法一直退回词法颜色；后端支持并不代表产品接入已经完成。
- 公共 Java 分词器保留上游 TextMate 范围中的注解、文档注释、字符串转义与运算符角色。先识别外层注释和字符串，再处理内部标点，避免注解误入关键字、Javadoc 误入普通注释。颜色验收测试必须经过真实语法和 Monaco 匹配器，不能仅断言主题 JSON 中存在正确色值。
- 已加载 Maven 描述符的目录使用 Community 原始模块图标；普通目录不猜测为模块。源码、测试、资源、包保持现有独立图标角色，不把模块蓝色覆盖到整个目录树或 Git 状态文字上。
- Ubuntu Mono 通过固定版本的 Fontsource 包随前端发布，字体许可进入公开资源目录。既有 Bun 下载缓存负责包归档校验，node_modules 和 dist 仍各工作区独立，不新增共享缓存。
- 只迁移 lithe-dark、Geist Mono、14、关闭连字同时成立的旧默认组合。新默认值和迁移逻辑分别维护，不能覆盖其他主题、字号或字体。
- 社区来源固定提交 d763f43a424abb418492519b0968a769eff0939d，具体文件与归属写在 IDEA-NOTICE.md；字体使用独立的 Ubuntu Font Licence。该提交不等于用户安装版本的完整界面验收。

正确做法：接收 JDTLS 的成员种类和 static 修饰，按主题映射样式。不要根据名称大小写或字符串前缀猜测 Java 语义。

## 考虑过的备选方案

依赖系统安装字体会使干净机器显示不同。直接覆盖所有保存的字体设置会破坏用户定制。复制发行包的整个主题或图标目录无法逐文件确认开放授权，因此仅使用已核对的公开配色来源和独立映射。

## 后果

颜色和字体来源可重现，标识符和静态成员能表达独立状态。字体增加前端资源体积；公共样式只能建立基线，不能证明全部弹窗、面板、终端和运行界面与 IDEA 完全一致。自定义主题及字体不会被强制迁移。

## 验证

运行 `./.agents/skills/write-stable-tests/scripts/test-stability-windows.ps1 -Scope Frontend -IsolateFrontendFiles`，覆盖显式颜色保留、JDTLS 修饰符、斜体与删除线组合、默认设置迁移和定制保留。`java-color-pipeline.test.ts` 加载随产品发布的语法和 Oniguruma，再验证 Monaco 最终匹配出的颜色。运行 `node scripts/test-reuse-worktree-resources.mjs` 校验资源复用边界，以及 `./scripts/build-windows.ps1 -Configuration Release` 验证字体打包。

## 适用范围

`windows/tauri/src/extensions/themes/`、`windows/tauri/src/features/settings/`、`windows/tauri/src/styles/idea-workbench.css`、`frontend/editor/src/semantic-tokens.ts` 与 `frontend/editor/src/token-theme-roles.ts`。
