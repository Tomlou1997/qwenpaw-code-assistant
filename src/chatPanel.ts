import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * QwenPaw 对话面板 - 在 VSCode 右侧显示的聊天窗口
 */
export class QwenPawChatPanel {
  public static currentPanel: QwenPawChatPanel | undefined;
  public readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  public _conversationHistory: { role: string; content: string }[] = [];
  private _config: vscode.WorkspaceConfiguration;
  private _sessionId: string | undefined;

  constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._config = vscode.workspace.getConfiguration('qwenpaw');
    
    this._panel.webview.html = this._getHtmlContent();
    
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this._handleUserMessage(message.text);
            break;
          case 'sendCodeToEditor':
            await this._insertCodeToEditor(message.code);
            break;
          case 'getSelectedCode':
            await this._sendSelectedCodeToChat();
            break;
          case 'clearConversation':
            this._conversationHistory = [];
            this._sessionId = `vscode_panel_${Date.now()}`;
            this._postMessage('updateChat', { messages: [] });
            break;
        }
      },
      null,
      this._disposables
    );
    
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * 创建或显示面板
   */
  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;

    if (QwenPawChatPanel.currentPanel) {
      QwenPawChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'copowChat',
      'QwenPaw 对话',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    QwenPawChatPanel.currentPanel = new QwenPawChatPanel(panel, context);
  }

  /**
   * 处理用户消息
   */
  public async _handleUserMessage(text: string) {
    this._conversationHistory.push({ role: 'user', content: text });
    
    this._postMessage('addMessage', {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this._postMessage('setLoading', true);

    try {
      const contextPrompt = this._buildContextPrompt(text);
      const response = await this._callQwenPaw(contextPrompt);
      
      this._conversationHistory.push({ role: 'assistant', content: response });
      
      this._postMessage('addMessage', {
        role: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString()
      });
      
    } catch (error: any) {
      this._postMessage('addMessage', {
        role: 'assistant',
        content: '**错误**: ' + error.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      this._postMessage('setLoading', false);
    }
  }

  /**
   * 构建提示
   */
  private _buildContextPrompt(userMessage: string): string {
    const editor = vscode.window.activeTextEditor;
    let context = '';
    
    if (editor) {
      const document = editor.document;
      const selection = editor.selection;
      
      context = '当前文件: ' + document.fileName + '\n';
      context += '语言: ' + document.languageId + '\n';
      
      if (!selection.isEmpty) {
        const selectedCode = document.getText(selection);
        context += '\n选中的代码:\n```\n' + selectedCode + '\n```\n';
      } else {
        const startLine = Math.max(0, selection.start.line - 10);
        const endLine = Math.min(document.lineCount - 1, selection.start.line + 10);
        const nearbyCode = document.getText(
          new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
        );
        context += '\n当前代码上下文:\n```\n' + nearbyCode + '\n```\n';
      }
    }
    
    // 根据用户指令区分回答模式
    const msg = userMessage.trim();
    let instruction = '';
    if (/^找出.*问题/.test(msg) || /^找.*问题/.test(msg) || /^有什么问题/.test(msg)) {
      instruction = '【系统指令】你是一个代码审查助手。你的唯一任务：找出代码中的问题、隐患、不合理的地方。\n【严禁】不要提供修改后的代码，不要给出优化版本。只指出问题，不改代码。\n【语言】请务必使用中文回答。';
    } else if (/^优化/.test(msg) || /^改进/.test(msg) || /^重构/.test(msg)) {
      instruction = '【系统指令】你是一个代码优化助手。找出代码中不合理的地方，并提供优化后的完整代码（包含改进点说明）。\n【语言】请务必使用中文回答。';
    }
    
    let prompt = instruction ? instruction + '\n\n' : '';
    prompt += '你是一个编程助手。\n\n';
    prompt += '重要：请务必使用中文回答，除非用户明确要求用英文。\n\n';
    prompt += '当前上下文:\n' + context + '\n\n';
    
    const recentHistory = this._conversationHistory.slice(-10);
    if (recentHistory.length > 0) {
      prompt += '对话历史:\n';
      for (const msg of recentHistory) {
        prompt += (msg.role === 'user' ? '用户' : '助手') + ': ' + msg.content + '\n';
      }
      prompt += '\n';
    }
    
    prompt += '用户: ' + userMessage + '\n\n';
    prompt += '请用中文回答，如果涉及代码，请用代码块标注。';
    
    return prompt;
  }

  /**
   * 调用 QwenPaw API - 带 session 记忆（直接调 /api/agent/process SSE 接口）
   */
  private async _callQwenPaw(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const http = require('http');
      
      const endpoint = this._config.get<string>('endpoint', 'http://127.0.0.1:8088');
      
      // 每个对话面板实例用同一个 session_id
      if (!this._sessionId) {
        this._sessionId = `vscode_panel_${Date.now()}`;
      }
      
      // 构建符合 API 格式的请求体
      const body = {
        session_id: this._sessionId,
        user_id: 'default',
        input: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt }
            ]
          }
        ]
      };
      
      const postData = JSON.stringify(body);
      
      const parsedUrl = new URL(`${endpoint}/api/agent/process`);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this._config.get<number>('timeout', 300000)
      };
      
      const req = http.request(options, (res: any) => {
        let responseText = '';
        let buffer = '';
        let lastCompleteText = '';  // 兜底：记录最后一条 completed 事件的完整文本
        
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          
          // 逐行处理缓冲区
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                // 收集所有 delta 文本事件
                if (data.type === 'text' && data.delta === true && data.text) {
                  responseText += data.text;
                }
                // 兜底：status=completed 时 text 字段包含完整内容
                if (data.type === 'text' && data.status === 'completed' && data.text) {
                  lastCompleteText = data.text;
                }
                // 也收集 output 字段中的文本
                if (data.output && Array.isArray(data.output)) {
                  for (const item of data.output) {
                    if (item.type === 'text' && item.text) {
                      responseText += item.text;
                    }
                  }
                }
                // 日志调试: 记录收到的数据类型
                console.log(`[QwenPaw Chat] SSE event: type=${data.type}, status=${data.status}, hasText=${!!data.text}, hasOutput=${!!data.output}`);
              } catch { /* ignore */ }
            }
          }
        });
        
        res.on('end', () => {
          // 处理缓冲区剩余内容
          if (buffer.startsWith('data: ')) {
            try {
              const data = JSON.parse(buffer.slice(6));
              if (data.type === 'text' && data.delta === true && data.text) {
                responseText += data.text;
              }
              if (data.type === 'text' && data.status === 'completed' && data.text) {
                lastCompleteText = data.text;
              }
            } catch { /* ignore */ }
          }
          // 优先用 delta 收集的文本，如果为空则用兜底的 completed 文本
          const finalText = responseText || lastCompleteText || '需要稍等一下，正在处理中...';
          resolve(finalText);
        });
      });
      
      req.on('error', (err: Error) => {
        reject(new Error(`QwenPaw 调用失败: ${err.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('QwenPaw API 请求超时'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * 解析响应
   */
  private _parseQwenPawResponse(response: string): string {
    try {
      // 过滤掉 INFO 日志
      const cleanResponse = response
        .split('\n')
        .filter((line: string) => !line.includes('| INFO') && !line.includes('| WARNING'))
        .join('\n');
      
      const textMatch = cleanResponse.match(/Friday:\s*([\s\S]*?)(?=\n\{|$)/);
      if (textMatch) {
        return textMatch[1].trim();
      }
      
      const writeFileMatch = cleanResponse.match(/"content":\s*"([^"]+)"/);
      if (writeFileMatch) {
        return writeFileMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
      
      return cleanResponse
        .replace(/\{[\s\S]*?"type":\s*"tool_use"[\s\S]*?\}/g, '')
        .replace(/\{[\s\S]*?"type":\s*"tool_result"[\s\S]*?\}/g, '')
        .replace(/Friday:\s*/g, '')
        .replace(/system:\s*/g, '')
        .trim();
    } catch {
      return response;
    }
  }

  /**
   * 插入代码
   */
  public async _insertCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('没有活动的编辑器');
      return;
    }
    
    await editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.end, '\n\n' + code);
    });
    
    vscode.window.showInformationMessage('代码已插入');
  }

  /**
   * 发送选中代码
   */
  public async _sendSelectedCodeToChat() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._postMessage('addMessage', {
        role: 'assistant',
        content: '请先打开一个文件并选中代码',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
      this._postMessage('addMessage', {
        role: 'assistant',
        content: '请先选中要发送的代码',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }
    
    const code = editor.document.getText(selection);
    const language = editor.document.languageId;
    
    this._postMessage('addMessage', {
      role: 'user',
      content: '这是我要问的代码:\n```' + language + '\n' + code + '\n```',
      timestamp: new Date().toLocaleTimeString()
    });
    
    this._postMessage('setLoading', true);
    try {
      const prompt = '分析这段 ' + language + ' 代码，指出问题并提供改进建议：\n```\n' + code + '\n```';
      const response = await this._callQwenPaw(prompt);
      
      this._postMessage('addMessage', {
        role: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (error: any) {
      this._postMessage('addMessage', {
        role: 'assistant',
        content: '**错误**: ' + error.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      this._postMessage('setLoading', false);
    }
  }

  /**
   * 发送消息到 WebView
   */
  private _postMessage(command: string, data: any) {
    this._panel.webview.postMessage({ command: command, ...data });
  }

  /**
   * 获取 HTML 内容
   */
  public _getHtmlContent(): string {
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="UTF-8">',
      '<style>',
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body {',
      '  font-family: "Segoe UI", -apple-system, sans-serif;',
      '  background: var(--vscode-editor-background);',
      '  color: var(--vscode-editor-foreground);',
      '  height: 100vh;',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '}',
      '.header { padding: 12px 16px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); display: flex; align-items: center; justify-content: space-between; }',
      '.header-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }',
      '.header-actions { display: flex; gap: 4px; }',
      '.header-btn { background: none; border: 1px solid transparent; color: var(--vscode-editor-foreground); padding: 4px 8px; cursor: pointer; border-radius: 4px; font-size: 12px; }',
      '.header-btn:hover { background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); }',
      '.chat-container { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }',
      '.message { max-width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; word-wrap: break-word; animation: fadeIn 0.2s ease; }',
      '@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }',
      '.message.user { background: var(--vscode-textBlockQuote-background); align-self: flex-end; border-bottom-right-radius: 4px; }',
      '.message.assistant { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); align-self: flex-start; border-bottom-left-radius: 4px; }',
      '.message .timestamp { font-size: 11px; opacity: 0.6; margin-top: 4px; }',
      '.message pre { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; font-family: "Consolas", "Courier New", monospace; font-size: 12px; }',
      '.message code { font-family: "Consolas", "Courier New", monospace; font-size: 12px; background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }',
      '.input-container { padding: 10px 12px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); }',
      '.input-wrapper { display: flex; gap: 8px; align-items: flex-end; }',
      '.input-area { flex: 1; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); color: var(--vscode-input-foreground); padding: 8px 12px; border-radius: 6px; font-size: 13px; resize: none; min-height: 36px; max-height: 120px; outline: none; }',
      '.input-area:focus { border-color: var(--vscode-focusBorder); }',
      '.send-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; height: 36px; }',
      '.send-btn:hover { background: var(--vscode-button-hoverBackground); }',
      '.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.quick-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }',
      '.quick-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; }',
      '.quick-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }',
      '.loading { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12px; color: var(--vscode-descriptionForeground); }',
      '.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--vscode-descriptionForeground); text-align: center; padding: 20px; }',
      '.empty-state .icon { font-size: 48px; opacity: 0.3; }',
      '.empty-state .title { font-size: 16px; font-weight: 600; }',
      '.empty-state .desc { font-size: 13px; opacity: 0.8; }',
      '::-webkit-scrollbar { width: 6px; }',
      '::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="header">',
      '<div class="header-title"><span>🤖</span><span>QwenPaw 对话</span></div>',
      '<div class="header-actions">',
      '<button class="header-btn" onclick="clearConversation()" title="清空对话">🗑️</button>',
      '</div>',
      '</div>',
      '<div class="chat-container" id="chatContainer">',
      '<div class="empty-state" id="emptyState">',
      '<div class="icon">💬</div>',
      '<div class="title">QwenPaw AI 助手</div>',
      '<div class="desc">在下方输入问题，或选中代码后点击"发送代码"<br>我可以帮你：<br>• 解释代码<br>• 生成代码<br>• 优化代码<br>• 解决错误</div>',
      '</div>',
      '</div>',
      '<div class="input-container">',
      '<div class="input-wrapper">',
      '<textarea class="input-area" id="inputArea" placeholder="输入问题... (Enter 发送, Shift+Enter 换行)" rows="1"></textarea>',
      '<button class="send-btn" id="sendBtn" onclick="sendMessage()">发送</button>',
      '</div>',
      '<div class="quick-actions">',
      '<button class="quick-btn" onclick="sendSelectedCode()">📋 发送选中代码</button>',
      '<button class="quick-btn" onclick="quickPrompt(\'解释这段代码\')">💡 解释代码</button>',
      '<button class="quick-btn" onclick="quickPrompt(\'优化这段代码\')">⚡ 优化代码</button>',
      '<button class="quick-btn" onclick="quickPrompt(\'找出这段代码的问题\')">🔍 找问题</button>',
      '</div>',
      '</div>',
      '<script>',
      'const vscode = acquireVsCodeApi();',
      'const chatContainer = document.getElementById("chatContainer");',
      'const inputArea = document.getElementById("inputArea");',
      'const sendBtn = document.getElementById("sendBtn");',
      'const emptyState = document.getElementById("emptyState");',
      'let isLoading = false;',
      'inputArea.addEventListener("input", () => {',
      '  inputArea.style.height = "auto";',
      '  inputArea.style.height = Math.min(inputArea.scrollHeight, 120) + "px";',
      '});',
      'inputArea.addEventListener("keydown", (e) => {',
      '  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }',
      '});',
      'function sendMessage() {',
      '  const text = inputArea.value.trim();',
      '  if (!text || isLoading) return;',
      '  inputArea.value = "";',
      '  inputArea.style.height = "auto";',
      '  sendBtn.disabled = true;',
      '  vscode.postMessage({ command: "sendMessage", text: text });',
      '}',
      'function quickPrompt(prompt) {',
      '  vscode.postMessage({ command: "sendMessage", text: prompt });',
      '}',
      'function sendSelectedCode() {',
      '  vscode.postMessage({ command: "getSelectedCode" });',
      '}',
      'function clearConversation() {',
      '  if (confirm("确定清空所有对话？")) {',
      '    vscode.postMessage({ command: "clearConversation" });',
      '  }',
      '}',
      'function addMessage(message) {',
      '  emptyState.style.display = "none";',
      '  const msgDiv = document.createElement("div");',
      '  msgDiv.className = "message " + message.role;',
      '  let content = message.content;',
      '  content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");',
      '  content = content.replace(/```(\\w*)\\n?([\\s\\S]*?)\\n?```/g, function(m, lang, code) {',
      '    return "<pre><code>" + code + "</code></pre>";',
      '  });',
      '  content = content.replace(/\\n/g, "<br>");',
      '  msgDiv.innerHTML = content + \'<div class="timestamp">\' + message.timestamp + \'</div>\';',
      '  chatContainer.appendChild(msgDiv);',
      '  chatContainer.scrollTop = chatContainer.scrollHeight;',
      '}',
      'function setLoading(loading) {',
      '  isLoading = loading;',
      '  sendBtn.disabled = loading;',
      '  sendBtn.textContent = loading ? "..." : "发送";',
      '  if (loading) {',
      '    const loadingDiv = document.createElement("div");',
      '    loadingDiv.className = "loading";',
      '    loadingDiv.id = "loadingIndicator";',
      '    loadingDiv.innerHTML = "QwenPaw 正在思考...";',
      '    chatContainer.appendChild(loadingDiv);',
      '    chatContainer.scrollTop = chatContainer.scrollHeight;',
      '  } else {',
      '    const ld = document.getElementById("loadingIndicator");',
      '    if (ld) ld.remove();',
      '  }',
      '}',
      'window.addEventListener("message", event => {',
      '  const message = event.data;',
      '  if (message.command === "addMessage") addMessage(message);',
      '  if (message.command === "setLoading") setLoading(message.loading);',
      '  if (message.command === "updateChat") {',
      '    chatContainer.innerHTML = "";',
      '    if (message.messages && message.messages.length > 0) {',
      '      emptyState.style.display = "none";',
      '      message.messages.forEach(msg => addMessage(msg));',
      '    } else {',
      '      emptyState.style.display = "flex";',
      '    }',
      '  }',
      '});',
      'inputArea.focus();',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  /**
   * 清理资源
   */
  public dispose() {
    QwenPawChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

/**
 * 侧边栏视图提供器
 */
export class QwenPawChatViewProvider implements vscode.WebviewViewProvider {
  private _chatPanel: QwenPawChatPanel | undefined;

  constructor(private _context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true
    };

    // 设置 HTML
    const html = this._getSidebarHtml();
    webviewView.webview.html = html;

    // 监听消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'openChatPanel':
          QwenPawChatPanel.createOrShow(this._context);
          break;
        case 'askQuestion':
          QwenPawChatPanel.createOrShow(this._context);
          // 延迟一点再发送消息，确保面板已创建
          setTimeout(() => {
            if (QwenPawChatPanel.currentPanel) {
              QwenPawChatPanel.currentPanel._handleUserMessage(message.text);
            }
          }, 500);
          break;
      }
    });
  }

  /**
   * 侧边栏 HTML（简化的快捷入口）
   */
  private _getSidebarHtml(): string {
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="UTF-8">',
      '<style>',
      'body {',
      '  font-family: "Segoe UI", -apple-system, sans-serif;',
      '  background: var(--vscode-sideBar-background);',
      '  color: var(--vscode-sideBar-foreground);',
      '  padding: 16px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '}',
      '.welcome { text-align: center; margin-bottom: 8px; }',
      '.welcome .icon { font-size: 36px; }',
      '.welcome .title { font-size: 16px; font-weight: 600; margin-top: 8px; }',
      '.welcome .desc { font-size: 12px; opacity: 0.7; margin-top: 4px; }',
      '.main-btn {',
      '  background: var(--vscode-button-background);',
      '  color: var(--vscode-button-foreground);',
      '  border: none;',
      '  padding: 12px 16px;',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  font-size: 14px;',
      '  font-weight: 500;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 8px;',
      '}',
      '.main-btn:hover { background: var(--vscode-button-hoverBackground); }',
      '.quick-btns { display: flex; flex-direction: column; gap: 8px; }',
      '.quick-btn {',
      '  background: var(--vscode-button-secondaryBackground);',
      '  color: var(--vscode-button-secondaryForeground);',
      '  border: 1px solid var(--vscode-panel-border);',
      '  padding: 10px 14px;',
      '  border-radius: 6px;',
      '  cursor: pointer;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '}',
      '.quick-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }',
      '.quick-btn .label { font-size: 11px; opacity: 0.7; margin-top: 2px; }',
      '.divider { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 8px 0; }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="welcome">',
      '<div class="icon">🤖</div>',
      '<div class="title">QwenPaw 助手</div>',
      '<div class="desc">点击按钮打开聊天面板</div>',
      '</div>',
      '<button class="main-btn" onclick="openChat()">💬 打开对话面板</button>',
      '<hr class="divider">',
      '<div class="quick-btns">',
      '<button class="quick-btn" onclick="quickAsk(\'解释一下我当前选中的代码\')">',
      '💡 解释代码',
      '<div class="label">理解选中代码的功能</div>',
      '</button>',
      '<button class="quick-btn" onclick="quickAsk(\'帮我优化一下我当前选中的代码\')">',
      '⚡ 优化代码',
      '<div class="label">改进代码性能和可读性</div>',
      '</button>',
      '<button class="quick-btn" onclick="quickAsk(\'找出我当前选中代码的问题\')">',
      '🔍 检查代码',
      '<div class="label">发现潜在问题和错误</div>',
      '</button>',
      '<button class="quick-btn" onclick="quickAsk(\'帮我生成我当前选中代码的单元测试\')">',
      '🧪 生成测试',
      '<div class="label">自动生成单元测试</div>',
      '</button>',
      '</div>',
      '<script>',
      'const vscode = acquireVsCodeApi();',
      'function openChat() {',
      '  vscode.postMessage({ command: "openChatPanel" });',
      '}',
      'function quickAsk(text) {',
      '  vscode.postMessage({ command: "askQuestion", text: text });',
      '}',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n');
  }
}