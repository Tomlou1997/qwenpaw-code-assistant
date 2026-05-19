import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QwenPawChatPanel, QwenPawChatViewProvider } from './chatPanel';

const execAsync = promisify(exec);

/**
 * QwenPaw 集成类
 */
export class QwenPawIntegration {
  private context: vscode.ExtensionContext;
  private config: vscode.WorkspaceConfiguration;
  private outputChannel: vscode.OutputChannel;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = vscode.workspace.getConfiguration('qwenpaw');
    this.outputChannel = vscode.window.createOutputChannel('QwenPaw');
  }
  
  /**
   * 调用 QwenPaw task 命令
   */
  async callQwenPawTask(instruction: string): Promise<string> {
    try {
      this.log(`调用 QwenPaw: ${instruction.substring(0, 100)}...`);
      
      // 优先取 VS Code 打开的文件夹根路径
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspacePath = (workspaceFolders && workspaceFolders.length > 0)
        ? workspaceFolders[0].uri.fsPath
        : (vscode.workspace.rootPath || process.cwd());
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const { execFile } = require('child_process');
      const execFileAsync = promisify(execFile);
      
      const promptFile = path.join(os.tmpdir(), `qwenpaw_prompt_${Date.now()}.md`);
      fs.writeFileSync(promptFile, instruction, 'utf8');
      
      try {
        const { stdout, stderr } = await execFileAsync(
          'copaw', ['task', '-i', promptFile],
          { cwd: workspacePath, timeout: this.config.get<number>('timeout', 60000) }
        );
        
        this.log(`QwenPaw 响应: ${stdout.substring(0, 200)}...`);
        
        const realErrors = stderr?.split('\n')
          .filter((line: string) => line.includes('ERROR') || line.includes('Error'))
          .join('\n');
        
        if (realErrors && realErrors.trim()) {
          throw new Error(`QwenPaw 错误: ${realErrors}`);
        }
        
        const combinedOutput = this.filterInfoLogs(stdout);
        const result = this.parseQwenPawResponse(combinedOutput);
        this.log(`解析结果: ${result.substring(0, 200)}...`);
        
        return result;
      } finally {
        try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
      }
      
    } catch (error: any) {
      const errorMsg = `QwenPaw 调用失败: ${error.message}`;
      this.log(`错误: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
  
  private filterInfoLogs(output: string): string {
    return output
      .split('\n')
      .filter((line: string) => {
        if (line.includes('| INFO') || line.includes('| WARNING')) {
          return false;
        }
        if (line.includes('Friday')) {
          return true;
        }
        if (line.includes('{') || line.includes('}') || line.includes('"')) {
          return true;
        }
        if (!line.trim() || /^\d{4}-\d{2}-\d{2}/.test(line.trim())) {
          return false;
        }
        return true;
      })
      .join('\n');
  }
  
  private parseQwenPawResponse(response: string): string {
    try {
      const lines = response.split('\n');
      const cleanLines: string[] = [];
      let inJsonBlock = false;
      
      for (const line of lines) {
        if (line.trim() === '{' || line.trim() === '[') {
          inJsonBlock = true;
          continue;
        }
        if (line.trim() === '}' || line.trim() === ']') {
          inJsonBlock = false;
          continue;
        }
        if (!inJsonBlock) {
          cleanLines.push(line);
        }
      }
      
      let cleanResponse = cleanLines.join('\n');
      
      const fridayMatch = cleanResponse.match(/Friday\s*[\(（][^）)]*[\)）]\s*[:：]?\s*([\s\S]*?)(?=$|\n\n|\n\{)/i);
      if (fridayMatch && fridayMatch[1].trim()) {
        return fridayMatch[1].trim();
      }
      
      const fridayColonMatch = cleanResponse.match(/Friday[:：]\s*([\s\S]*?)(?=$|\n\n|\n\{)/i);
      if (fridayColonMatch && fridayColonMatch[1].trim()) {
        return fridayColonMatch[1].trim();
      }
      
      const finalResult = cleanResponse
        .replace(/^[^\n]*\| (INFO|WARNING)[^\n]*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      if (finalResult) {
        return finalResult;
      }
      
      return response.substring(0, 200) || 'QwenPaw 响应为空';
      
    } catch (error: any) {
      this.log(`解析错误: ${error.message}`);
      return `解析响应失败: ${error.message}`;
    }
  }
  
  async analyzeCode(code: string): Promise<string> {
    const prompt = `分析这段代码，指出问题并提供改进建议：\n\`\`\`\n${code}\n\`\`\``;
    return await this.callQwenPawTask(prompt);
  }
  
  async refactorCode(code: string): Promise<string> {
    const prompt = `重构这段代码，使其更清晰、高效、可维护：\n\`\`\`\n${code}\n\`\`\``;
    return await this.callQwenPawTask(prompt);
  }
  
  async explainError(errorMessage: string): Promise<string> {
    const prompt = `解释这个错误信息并提供解决方案：\n${errorMessage}`;
    return await this.callQwenPawTask(prompt);
  }
  
  private log(message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
  
  showOutput(): void {
    this.outputChannel.show();
  }
}

export function activate(context: vscode.ExtensionContext) {
  const qwenpaw = new QwenPawIntegration(context);
  
  const showOutputCommand = vscode.commands.registerCommand('qwenpaw.showOutput', () => {
    qwenpaw.showOutput();
  });
  
  const askSelectionCommand = vscode.commands.registerCommand(
    'qwenpaw.askSelection',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      
      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      if (!code.trim()) {
        vscode.window.showWarningMessage('请先选中要分析的代码');
        return;
      }
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'QwenPaw 正在分析代码...',
          cancellable: false
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: '分析中...' });
            const analysis = await qwenpaw.analyzeCode(code);
            
            qwenpaw.showOutput();
            const outputChannel = vscode.window.createOutputChannel('QwenPaw Analysis');
            outputChannel.show();
            outputChannel.appendLine('=== 代码分析 ===');
            outputChannel.appendLine(`文件: ${editor.document.fileName}`);
            outputChannel.appendLine(`行号: ${selection.start.line + 1}-${selection.end.line + 1}`);
            outputChannel.appendLine('='.repeat(50));
            outputChannel.appendLine(analysis);
            outputChannel.appendLine('='.repeat(50));
            
            progress.report({ increment: 100, message: '完成' });
            vscode.window.showInformationMessage('📊 代码分析完成！查看输出面板获取详情。');
          } catch (error: any) {
            vscode.window.showErrorMessage(`❌ 分析失败: ${error.message}`);
          }
        }
      );
    }
  );
  
  const explainErrorCommand = vscode.commands.registerCommand(
    'qwenpaw.explainError',
    async () => {
      const errorMessage = await vscode.window.showInputBox({
        prompt: '输入错误信息',
        placeHolder: '例如：SyntaxError: invalid syntax at line 10',
        value: await vscode.env.clipboard.readText()
      });
      
      if (!errorMessage) { return; }
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'QwenPaw 正在分析错误...',
          cancellable: false
        },
        async (progress) => {
          try {
            const explanation = await qwenpaw.explainError(errorMessage);
            vscode.window.showInformationMessage(explanation.substring(0, 200), { modal: true });
          } catch (error: any) {
            vscode.window.showErrorMessage(`❌ 错误分析失败: ${error.message}`);
          }
        }
      );
    }
  );
  
  const refactorCodeCommand = vscode.commands.registerCommand(
    'qwenpaw.refactorCode',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      
      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      if (!code.trim()) {
        vscode.window.showWarningMessage('请先选中要重构的代码');
        return;
      }
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'QwenPaw 正在重构代码...',
          cancellable: false
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: '重构中...' });
            const refactoredCode = await qwenpaw.refactorCode(code);
            progress.report({ increment: 50, message: '处理完成...' });
            
            const editor2 = vscode.window.activeTextEditor;
            if (editor2) {
              await editor2.edit(editBuilder => {
                editBuilder.replace(selection, refactoredCode);
              });
              vscode.window.showInformationMessage('✅ 代码重构完成！');
            }
            
            progress.report({ increment: 100, message: '完成' });
          } catch (error: any) {
            vscode.window.showErrorMessage(`❌ 重构失败: ${error.message}`);
          }
        }
      );
    }
  );
  
  const openChatCommand = vscode.commands.registerCommand('qwenpaw.openChat', () => {
    QwenPawChatPanel.createOrShow(context);
  });
  
  const chatViewProvider = new QwenPawChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('qwenpaw.chatView', chatViewProvider)
  );
  
  context.subscriptions.push(
    showOutputCommand,
    askSelectionCommand,
    explainErrorCommand,
    refactorCodeCommand,
    openChatCommand
  );
  
  console.log('QwenPaw Helper 扩展已激活');
  vscode.window.showInformationMessage('🚀 QwenPaw Helper 已激活！点击左侧 QwenPaw 图标打开聊天面板。');
}

export function deactivate() {
  console.log('QwenPaw Helper 扩展已停用');
}
