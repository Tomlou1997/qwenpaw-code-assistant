# 更新日志

## v1.0.1

### 🚀 新特性
- ⚡ **流式输出** — 回答内容逐段实时显示，无需等待全部完成
- 🔧 **工具调用可视化** — 实时显示 AI 正在调用的工具（如 `read_file`、`execute_shell_command` 等）
- 📍 **自动感知工作区** — AI 自动识别 VS Code 当前打开的文件夹路径

### 🐛 修复
- 修复工作区路径获取：废弃的 `vscode.workspace.rootPath` → 改用 `workspaceFolders[0].uri.fsPath`
- 修正 SSE 事件解析：按 QwenPaw API 实际返回格式（`type: "data"`）解析工具调用，而非错误的 `tool_use`/`tool_result` 假设
- 修复 `.vscodeignore` 中 `.map` 文件被误排除的问题

### 🔧 技术优化
- `_callQwenPaw` 新增 `onDelta` 回调参数，支持流式逐段推送到 webview
- `_buildContextPrompt` 注入当前工作区路径，AI 可直接根据路径操作文件

## v1.0.0

### ✨ 功能
- 💬 右侧对话面板，支持对话记忆
- 💡 解释代码：解释选中代码的功能和逻辑
- ⚡ 优化代码：分析问题并提供优化方案
- 🔍 找问题：审查代码，找出潜在隐患
- 📋 发送选中代码到对话框
- 🗑️ 清空对话

### 🔧 技术
- 基于 QwenPaw HTTP API（SSE 流式响应）
- 支持 session_id 会话记忆
- VSIX 双击安装
