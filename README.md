# AinoldMarkdown

Typora 风格 Markdown 编辑器（Vue 界面重构进行中）。

## 当前实现

- 单窗口编辑（TipTap）
- Typora 风格三段布局：菜单栏 + Outline 侧栏 + 内容区
- 原生 Electron 菜单栏：`File / Edit / Paragraph / Format / View / Help`
- `File > Recent Files` 支持快速重开
- `Edit` 菜单支持系统剪贴板动作：`Cut / Copy / Paste / Select All`
- `File` 菜单支持 `Save As...`、`Export HTML`、`Export PDF`
- `Export PDF` 含页脚页码，并优化代码块/表格/图片分页
- 查找栏支持 `Prev/Next` 循环定位（`Ctrl/Cmd + F` 打开）
- Outline 跟随光标高亮当前标题
- 基础输入规则：`# `、`- `、`> `
- 打开 `.md` 文件
- 保存 `.md` 文件
- 新建文档
- 任务列表节点支持（TaskList/TaskItem）
- 代码块高亮（lowlight）
- 表格插入与编辑（TipTap Table）
- 表格 `Tab/Shift+Tab` 单元格导航，末格 `Tab` 自动补新行
- 粘贴 Markdown 表格文本时自动转换为表格块
- 图片粘贴/拖拽导入到同目录 `assets/`
- 快捷保存（`Ctrl/Cmd + S`）
- 自动保存（打开已有文件后，编辑停止约 1.6 秒自动写盘）
- 关闭窗口未保存保护（保存并关闭 / 不保存关闭 / 取消）
- 新建/打开文件前未保存保护（保存 / 不保存 / 取消）
- 最近文件列表（保存或打开后自动记录）

## 技术栈

- Electron
- Vue 3 + Vite + TypeScript
- TipTap
- `marked` + `turndown`（Markdown 和 HTML 互转）

## 快速开始

```bash
npm install
npm run dev --workspace=apps/desktop
```

## 生产部署

```bash
npm run dist:desktop
npm.cmd run dist --workspace=apps/desktop

```

产物目录：

- `apps/desktop/release/AinoldMarkdown Setup 0.1.0.exe`（安装包）
- `apps/desktop/release/AinoldMarkdown 0.1.0.exe`（便携版）

安装后首次启动会出现引导设置：

- 是否开机启动（可勾选）
- 打开系统默认应用设置（用于将 `.md/.markdown` 默认打开方式设为 AinoldMarkdown）
- 引导为强制一次性选择：需完成开机启动与默认打开选项后才能结束
- 引导内可“检查 `.md` 关联状态”（已关联 / 未关联 / 未知）

安装包已声明文件关联：`.md`、`.markdown`。

## 后续路线

见 `docs/implementation-plan.md`。
