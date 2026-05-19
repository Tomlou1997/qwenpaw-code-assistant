# QwenPaw Helper

**将 QwenPaw AI 助手集成到 VSCode 的对话面板**

作者：tomlou

## ✨ 功能

### 💬 对话面板
右侧打开聊天窗口，与 QwenPaw AI 对话，支持对话记忆。

- 💡 **解释代码** — 选中代码，一键解释功能和逻辑
- ⚡ **优化代码** — 分析代码问题并提供优化方案
- 🔍 **找问题** — 审查代码，找出潜在问题
- 📋 **发送选中代码** — 将编辑器选中的代码发送到对话框

### 🖱️ 右键菜单
选中代码后右键，可使用以下功能：

- **Ask QwenPaw about selection** — 将选中代码发送给 QwenPaw 并自由提问
- **Refactor selected code** — 让 QwenPaw 重构选中的代码

## 📦 安装要求

- **VSCode 1.75+**
- **QwenPaw 1.0.2+**（运行于本地）

## 🚀 快速开始

### 1. 确保 QwenPaw 服务在运行（CLI 命令为 `copaw`）
```bash
copaw app
```

### 2. 配置 API 地址
VSCode 设置 → 搜索 `qwenpaw.endpoint` → 默认 `http://127.0.0.1:8088`

### 3. 使用
点击左侧活动栏 QwenPaw 图标，或右键菜单中选择功能。

## ⚙️ 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `qwenpaw.endpoint` | `http://127.0.0.1:8088` | QwenPaw 服务器地址 |
| `qwenpaw.agentId` | `default` | 默认 Agent ID |
| `qwenpaw.timeout` | `300000` | 请求超时（毫秒） |

## 📄 许可证

MIT
