import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * QwenPaw 对话面板 - 在 VSCode 右侧显示的聊天窗口
 */

/**
 * 侧边栏视图提供器 - 点击活动栏图标时显示，点击"打开对话面板"则打开右侧面板
 */
export class QwenPawChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private _context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8">
<style>
body{font-family:"Segoe UI",sans-serif;padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center;background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground);}
.icon{font-size:40px;margin-bottom:4px;}
.title{font-size:16px;font-weight:600;margin-bottom:4px;}
.desc{font-size:12px;opacity:0.7;margin-bottom:8px;text-align:center;}
.btn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;width:100%;text-align:center;}
.btn:hover{background:var(--vscode-button-hoverBackground);}
</style></head>
<body>
<img src="data:image/png;base64,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hmXSNAnFLrvsEjraWLfRSdWOK2pnk07Y5jRt07333hsbx6u0TWhog9X/q4dtVrtUus5f7bDWIaSM9Qyr0gie1fay+eabx3a+snYStb/dcMMNg0NCitoYNWYv67jZS930d9111xXabcraQzTmSgPbNc5xhQHfA52Q1Pah9sJvfOMbyUte8pLK7Y/2bw3wrjKMpWy4RlE7lbZBHZi++c1vDrZtptdl14t6G2t8q/VALWtD8x1Efv/737fdxpg+XhovaRNWVH3pHM2bNy+58cYbk/32269yO7Kt9y1vecuQY2Pn5PHHH48dbVq53u3fkydPjh2uDj744Nj5RwP5v/zlL8dJRHScNQA/PX42r9NU+nzo2qzSu1l//9nPflbp2jnuuOMqtWHqutfxKlte3rGZOHHikM6ORduuc6p0o2wddv462ZjPw6PclKbRypqSK01TInViaVG07WuvvXbuHJzpXJOmadtyyy3j75oOSdN5aTqwIqp+1fyQmmqpzK9//etKcxWWPb1AObusnKZfrqp4lUMvmrpMufys51L69sbzzjsv3HLLLZVLZTrWeoafnuiuY59XfWNVqvrM8ccfHx9+rZKkSpS23WVtmXravEqOrTz1pYxv45Sjjjoqbpe2029/en/05Ji99947Tmp/wQUXhE9/+tNh3rx5ldpjdb+pBKoHBA9nGi47ZmeeeWZ8zJsd46xSgv/3888/H9ve1I593333tbQ+LV/X0de+9rUV2qm1X5p8XMutujwtQ9MgagpDXRMbb7xxXH6aaml0P+je07NZdY2aKtfq6aefHtvUNM9yES3rFa94RXzcnc5n0efUdKFrtyy9URV1O8+0rQ0cX63jl7/8ZewHkVcbZsdS6cXDDz9cuFx9VlNBdryxLn2plLDxxhtXytEoBydjvc1F++JnfsnLMSmnqWEaRvtz1VVXleY89VJOviy3pRKFxnpW6YVXVNL4zGc+k5srtffV01GlvLzl2HsqpVk39qxlPfLII3EmjLLl2Eulsl/84heDx6Kol6sfWmOfU6nlkksuWWGdeSUKvTSjjU20MJIlRtUEaAYlbVOVmXf8vug7mn5rvfXWq1Ri1LWnIU/33HPPsEqM/vdWrq+sknmVEqM+o9Lx1772tSHXvx2nyy+/PLd3d3p79FM9Lt/znvckTzzxRGbp0y/bv6dag3POOSdZd911K99f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" style="width:40px;height:40px;border-radius:50%;">
<div class="title">QwenPaw 助手</div>
<div class="desc">点击下方按钮打开聊天面板</div>
<button class="btn" onclick="openChat()">💬 打开对话面板</button>
<script>const vscode=acquireVsCodeApi();function openChat(){vscode.postMessage({command:"openChatPanel"});}</script>
</body></html>`;
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'openChatPanel') {
        const { QwenPawChatPanel } = await import('./chatPanel');
        QwenPawChatPanel.createOrShow(this._context);
      }
    });
  }
}
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
    
    // 允许 webview 访问整个扩展目录的资源
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri)]
    };
    
    // 把 user_avatar.png 加到 webview 可访问的资源中
    const avatarUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'user_avatar.png')
    );
    
    this._panel.webview.html = this._getHtmlContent(avatarUri.toString());
    
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
    
    this._panel.onDidDispose(() => {
      QwenPawChatPanel.currentPanel = undefined;
      this._panel.dispose();
    }, null, this._disposables);
  }

  /**
   * 创建或显示面板
   */
  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;

    if (QwenPawChatPanel.currentPanel) {
      // 检查面板是否已经销毁
      try {
        QwenPawChatPanel.currentPanel._panel.reveal(column);
        return;
      } catch {
        // 面板已销毁，重新创建
        QwenPawChatPanel.currentPanel = undefined;
      }
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
   * 处理用户消息（支持流式反馈）
   */
  public async _handleUserMessage(text: string) {
    this._conversationHistory.push({ role: 'user', content: text });
    
    this._postMessage('addMessage', {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this._postMessage('setLoading', true);

    // ★ 先发一个空的 assistant 消息占位，后面流式追加
    this._postMessage('addMessage', {
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      isStreaming: true
    });

    try {
      const contextPrompt = this._buildContextPrompt(text);
      let fullResponse = '';
      
      await this._callQwenPaw(contextPrompt, (deltaText: string) => {
        fullResponse += deltaText;
        // 每次收到一段增量文本就更新 webview 中的最后一条消息
        this._postMessage('streamUpdate', {
          content: fullResponse
        });
      });
      
      this._conversationHistory.push({ role: 'assistant', content: fullResponse });
      
      // 流式结束，标记完成
      this._postMessage('streamEnd', {
        content: fullResponse
      });
      
    } catch (error: any) {
      this._postMessage('streamEnd', {
        content: '**错误**: ' + error.message
      });
    } finally {
      this._postMessage('setLoading', false);
    }
  }

  /**
   * 构建提示（含工作区路径）
   */
  private _buildContextPrompt(userMessage: string): string {
    const editor = vscode.window.activeTextEditor;
    let context = '';
    
    // ★ 获取 VS Code 当前打开的文件夹路径（用户真正的工作区）
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath = (workspaceFolders && workspaceFolders.length > 0)
      ? workspaceFolders[0].uri.fsPath
      : (vscode.workspace.rootPath || '未知');
    context = '当前工作区路径: ' + workspacePath + '\n';
    
    if (editor) {
      const document = editor.document;
      const selection = editor.selection;
      
      context += '当前文件: ' + document.fileName + '\n';
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
    
    prompt += '\n\n重要说明：\n';
    prompt += '1. 当前工作区路径是 ' + workspacePath + '，当用户说"当前路径"、提到文件时，请优先基于此路径处理。\n';
    prompt += '2. 如果你需要读取文件或执行操作，请在此路径下进行。\n';
    
    return prompt;
  }

  /**
   * 调用 QwenPaw API - 带 session 记忆 + 流式回调
   * @param onDelta 每收到一段文本时回调，用于流式显示到 webview
   */
  private async _callQwenPaw(prompt: string, onDelta?: (text: string) => void): Promise<string> {
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
        let lastDeltaTime = Date.now();
        
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
                  // ★ 流式反馈：每次收到 delta 立即推给 webview
                  if (onDelta && data.text) {
                    onDelta(data.text);
                    lastDeltaTime = Date.now();
                  }
                }
                // ★ 收集工具调用事件（QwenPaw SSE 格式）
                // 调用: type=data, data.name=工具名, data.arguments='{"key":"val"}'
                // 结果: type=data, data.name=工具名, data.output='[{...}]'
                if (data.type === 'data' && data.data && data.data.name) {
                  const toolName = data.data.name;
                  const toolArgs = data.data.arguments;
                  const toolOutput = data.data.output;
                  
                  // 工具调用 — arguments 是合法 JSON 对象（不为空且不是 {}）
                  if (toolArgs && toolArgs !== '""' && toolArgs !== '{}' && toolArgs !== '') {
                    try {
                      const parsed = JSON.parse(toolArgs);
                      const keys = Object.keys(parsed);
                      const argsStr = keys.filter(k => k !== 'content' && k !== 'code').join(', ');
                      const toolHint = `\n> 🛠️ 正在调用: **${toolName}**${argsStr ? ' (' + argsStr + ')' : ''}\n`;
                      responseText += toolHint;
                      if (onDelta) {
                        onDelta(toolHint);
                        lastDeltaTime = Date.now();
                      }
                    } catch { /* ignore parse failures */ }
                  }
                  
                  // 工具结果 — output 存在且不为空
                  if (toolOutput && toolOutput !== '""' && toolOutput !== '[]' && toolOutput !== '') {
                    try {
                      const parsed = JSON.parse(toolOutput);
                      let summary = '';
                      if (Array.isArray(parsed) && parsed[0] && parsed[0].text) {
                        summary = parsed[0].text.substring(0, 120);
                      } else if (typeof parsed === 'string') {
                        summary = parsed.substring(0, 120);
                      }
                      const resultHint = `\n> ✅ 工具 **${toolName}** 完成${summary ? ': ' + summary.replace(/\n/g, ' ') : ''}\n`;
                      responseText += resultHint;
                      if (onDelta) {
                        onDelta(resultHint);
                        lastDeltaTime = Date.now();
                      }
                    } catch { /* ignore parse failures */ }
                  }
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
                      if (onDelta && item.text) {
                        onDelta(item.text);
                        lastDeltaTime = Date.now();
                      }
                    }
                  }
                }
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
                if (onDelta && data.text) {
                  onDelta(data.text);
                }
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
    public _getHtmlContent(avatarUri: string = ''): string {
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
      '<div class="header-title">' + (avatarUri ? '<img src="' + avatarUri + '" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:4px;">' : '<span>\u{1F916}</span>') + '<span>QwenPaw \u5bf9\u8bdd</span></div>',
      '<div class="header-actions">',
      '<button class="header-btn" onclick="clearConversation()" title="\u6e05\u7a7a\u5bf9\u8bdd">\u{1F5D1}\uFE0F</button>',
      '</div>',
      '</div>',
      '<div class="chat-container" id="chatContainer">',
      '<div class="empty-state" id="emptyState">',
      '<div class="icon">\u{1F4AC}</div>',
      '<div class="title">QwenPaw AI \u52a9\u624b</div>',
      '<div class="desc">\u5728\u4e0b\u65b9\u8f93\u5165\u95ee\u9898\uff0c\u6216\u9009\u4e2d\u4ee3\u7801\u540e\u70b9\u51fb\u201c\u53d1\u9001\u4ee3\u7801\u201d<br>\u6211\u53ef\u4ee5\u5e2e\u4f60\uff1a<br>\u2022 \u89e3\u91ca\u4ee3\u7801<br>\u2022 \u751f\u6210\u4ee3\u7801<br>\u2022 \u4f18\u5316\u4ee3\u7801<br>\u2022 \u89e3\u51b3\u9519\u8bef</div>',
      '</div>',
      '</div>',
      '<div class="input-container">',
      '<div class="input-wrapper">',
      '<textarea class="input-area" id="inputArea" placeholder="\u8f93\u5165\u95ee\u9898... (Enter \u53d1\u9001, Shift+Enter \u6362\u884c)" rows="1"></textarea>',
      '<button class="send-btn" id="sendBtn" onclick="sendMessage()">\u53d1\u9001</button>',
      '</div>',
      '<div class="quick-actions">',
      '<button class="quick-btn" onclick="quickAsk(\'\u4f18\u5316\u4ee3\u7801\')">\u26a1 \u4f18\u5316\u4ee3\u7801</button>',
      '<button class="quick-btn" onclick="sendSelectedCode()">\u{1F4CB} \u53d1\u9001\u9009\u4e2d\u4ee3\u7801</button>',
      '<button class="quick-btn" onclick="quickAsk(\'\u89e3\u91ca\u4ee3\u7801\')">\u{1F4A1} \u89e3\u91ca\u4ee3\u7801</button>',
      '</div>',
      '</div>',
      '<script>',
      'const vscode = acquireVsCodeApi();',
      'const chatContainer = document.getElementById("chatContainer");',
      'const emptyState = document.getElementById("emptyState");',
      'const inputArea = document.getElementById("inputArea");',
      'let streamMessageDiv = null;',
      'function renderContent(content) {',
      '  let html = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");',
      '  html = html.replace(/```(\\w*)\\n?([\\s\\S]*?)\\n?```/g, function(m, lang, code) {',
      '    return "<pre><code>" + code + "</code></pre>";',
      '  });',
      '  html = html.replace(/\n/g, "<br>");',
      '  return html;',
      '}',
      'function addMessage(message) {',
      '  emptyState.style.display = "none";',
      '  const msgDiv = document.createElement("div");',
      '  msgDiv.className = "message " + message.role;',
      '  msgDiv.innerHTML = renderContent(message.content) + \'<div class="timestamp">\' + message.timestamp + \'</div>\';',
      '  chatContainer.appendChild(msgDiv);',
      '  chatContainer.scrollTop = chatContainer.scrollHeight;',
      '  return msgDiv;',
      '}',
      'function streamUpdate(content) {',
      '  if (!streamMessageDiv) return;',
      '  const timestampEl = streamMessageDiv.querySelector(".timestamp");',
      '  streamMessageDiv.innerHTML = renderContent(content);',
      '  if (timestampEl) streamMessageDiv.appendChild(timestampEl);',
      '  chatContainer.scrollTop = chatContainer.scrollHeight;',
      '}',
      'function streamEnd(content) {',
      '  if (!streamMessageDiv) return;',
      '  const timestampEl = streamMessageDiv.querySelector(".timestamp");',
      '  streamMessageDiv.innerHTML = renderContent(content);',
      '  if (timestampEl) streamMessageDiv.appendChild(timestampEl);',
      '  streamMessageDiv = null;',
      '  chatContainer.scrollTop = chatContainer.scrollHeight;',
      '}',
      'function setLoading(loading) {',
      '  document.getElementById("sendBtn").disabled = loading;',
      '  inputArea.disabled = loading;',
      '}',
      'function sendMessage() {',
      '  const text = inputArea.value.trim();',
      '  if (!text) return;',
      '  inputArea.value = "";',
      '  inputArea.style.height = "auto";',
      '  vscode.postMessage({ command: "sendMessage", text: text });',
      '}',
      'function clearConversation() {',
      '  vscode.postMessage({ command: "clearConversation" });',
      '}',
      'function quickAsk(text) {',
      '  inputArea.value = text;',
      '  sendMessage();',
      '}',
      'function sendSelectedCode() {',
      '  vscode.postMessage({ command: "getSelectedCode" });',
      '}',
      'inputArea.addEventListener("keydown", function(e) {',
      '  if (e.key === "Enter" && !e.shiftKey) {',
      '    e.preventDefault();',
      '    sendMessage();',
      '  }',
      '});',
      'inputArea.addEventListener("input", function() {',
      '  this.style.height = "auto";',
      '  this.style.height = Math.min(this.scrollHeight, 120) + "px";',
      '});',
      'window.addEventListener("message", function(event) {',
      '  const message = event.data;',
      '  if (message.command === "addMessage") {',
      '    if (message.isStreaming) {',
      '      streamMessageDiv = addMessage(message);',
      '      chatContainer.scrollTop = chatContainer.scrollHeight;',
      '    } else {',
      '      addMessage(message);',
      '    }',
      '  }',
      '  if (message.command === "streamUpdate") streamUpdate(message.content);',
      '  if (message.command === "streamEnd") streamEnd(message.content);',
      '  if (message.command === "setLoading") setLoading(message.loading);',
      '  if (message.command === "updateChat") {',
      '    chatContainer.innerHTML = "";',
      '    streamMessageDiv = null;',
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

}