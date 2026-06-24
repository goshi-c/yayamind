const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Windows 现代语音识别 helper
 * 使用 PowerShell 5 + C# Add-Type 调用 Windows.Media.SpeechRecognition (WinRT)
 * 这条链路和 Win+H 使用的是同一套现代听写引擎
 */

function logStt(eventName, detail = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[stt-helper] ${timestamp} ${eventName}`, detail);
}

/**
 * 启动 Windows 现代语音识别
 * @param {Object} options
 * @param {string} options.userDataDir - 日志和临时文件目录
 * @param {string} options.lang - 语言标签，默认 zh-CN
 * @param {function(string): void} options.onPartial - 实时 partial 回调
 * @param {function(string): void} options.onStopFile - 停止信号文件路径回调
 * @param {number} [options.timeoutMs=600000] - 超时时间
 * @returns {Promise<string>} - 最终识别文本
 */
function recognizeWithWindowsModernSTT(options) {
  const { userDataDir, lang = 'zh-CN', onPartial, onStopFile, timeoutMs = 10 * 60_000 } = options;

  return new Promise((resolve, reject) => {
    const stopFilePath = path.join(userDataDir, `modern-stt-stop-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
    const resultFilePath = path.join(userDataDir, `modern-stt-result-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);

    onStopFile?.(stopFilePath);

    // 用 C# + Add-Type 封装 WinRT SpeechRecognizer，通过 stdout 回传结果。
    const script = `
param(
  [string]$StopFile,
  [string]$ResultFile,
  [string]$Lang = "zh-CN"
)
$ErrorActionPreference = "Stop"

# C# 代码封装 WinRT 调用
$csSource = @"
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.SpeechRecognition;
using Windows.Foundation;

public class ModernSTT
{
    private string _accumulatedText = "";
    private bool _hasResult = false;
    private SpeechRecognizer _recognizer;

    public async Task<bool> StartAsync(string langTag)
    {
        try
        {
            var language = new Windows.Globalization.Language(langTag);
            _recognizer = new SpeechRecognizer(language);

            var constraint = new SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.Dictation, "dictation");
            _recognizer.Constraints.Add(constraint);
            var compileResult = await _recognizer.CompileConstraintsAsync();
            if (compileResult.Status != SpeechRecognitionResultStatus.Success)
            {
                Console.WriteLine("EVT:{\\"type\\":\\"error\\",\\"error\\":\\"Compile failed: " + compileResult.Status + "\\"}");
                return false;
            }

            _recognizer.ContinuousRecognitionSession.ResultGenerated += (s, e) =>
            {
                if (e.Result.Confidence != SpeechRecognitionConfidence.Rejected)
                {
                    var text = e.Result.Text;
                    if (!string.IsNullOrEmpty(text))
                    {
                        _accumulatedText = string.IsNullOrEmpty(_accumulatedText) ? text : _accumulatedText + " " + text;
                        _hasResult = true;
                        Console.WriteLine("EVT:{\\"type\\":\\"partial\\",\\"text\\":\\"" + _accumulatedText.Replace("\\"", "\\\"").Replace("\\n", " ").Replace("\\r", "") + "\\"}");
                        Console.Out.Flush();
                    }
                }
            };

            await _recognizer.ContinuousRecognitionSession.StartAsync();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine("EVT:{\\"type\\":\\"error\\",\\"error\\":\\"" + ex.ToString().Replace("\\"", "\\\"").Replace("\\n", " ").Replace("\\r", "") + "\\"}");
            return false;
        }
    }

    public void WaitForStop(string stopFile)
    {
        while (!File.Exists(stopFile))
        {
            Thread.Sleep(200);
        }
    }

    public async Task StopAsync()
    {
        if (_recognizer != null)
        {
            await _recognizer.ContinuousRecognitionSession.StopAsync();
        }
    }

    public string GetText() { return _accumulatedText; }
    public bool HasResult() { return _hasResult; }
}
"@

try {
    # 编译 C# 代码
    Add-Type -TypeDefinition $csSource -Language CSharp -ReferencedAssemblies @(
        "System.Runtime.WindowsRuntime",
        "C:\\Windows\\System32\\WinMetadata\\Windows.Media.winmd",
        "C:\\Windows\\System32\\WinMetadata\\Windows.Foundation.winmd",
        "C:\\Windows\\System32\\WinMetadata\\Windows.Globalization.winmd"
    ) -ErrorAction Stop

    $stt = New-Object ModernSTT
    $startTask = $stt.StartAsync($Lang)
    $startTask.Wait(5000)

    if (-not $startTask.Result) {
        exit 1
    }

    # 等待停止信号
    $stt.WaitForStop($StopFile)

    # 停止识别
    $stopTask = $stt.StopAsync()
    $stopTask.Wait(3000)

    # 写入结果
    $output = @{
        success = $true
        text = $stt.GetText()
        hasResult = $stt.HasResult()
        language = $Lang
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($ResultFile, $output, [System.Text.Encoding]::UTF8)

    $finalPayload = @{ type = "final"; text = $stt.GetText(); hasResult = $stt.HasResult() } | ConvertTo-Json -Compress
    Console.WriteLine("EVT:" + $finalPayload)
}
catch {
    $errorText = ($_ | Out-String)
    $output = @{
        success = $false
        error = $errorText
        language = $Lang
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($ResultFile, $output, [System.Text.Encoding]::UTF8)
    $errPayload = @{ type = "error"; error = $errorText } | ConvertTo-Json -Compress
    [Console]::WriteLine("EVT:" + $errPayload)
    exit 1
}
`.trim();

    fs.mkdirSync(userDataDir, { recursive: true });
    const scriptPath = path.join(userDataDir, `modern-stt-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`);
    fs.writeFileSync(scriptPath, `﻿${script}`, 'utf8');

    logStt('modern-stt-start', { lang, scriptPath, stopFilePath, resultFilePath });

    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        `& { try { & '${scriptPath.replace(/'/g, "''")}' -StopFile '${stopFilePath.replace(/'/g, "''")}' -ResultFile '${resultFilePath.replace(/'/g, "''")}' -Lang '${lang.replace(/'/g, "''")}' } catch { $e = $_ | Out-String; Write-Output ('EVT:' + (@{ type='error'; error=$e } | ConvertTo-Json -Compress)); exit 1 } }`
      ],
      { windowsHide: true }
    );

    let settled = false;
    let lastPartial = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      cleanup();
      reject(new Error(JSON.stringify({ message: 'Modern STT timed out', exitCode: null, stderr })));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(stopFilePath); } catch {}
    }

    function readResultFile() {
      try {
        if (fs.existsSync(resultFilePath)) {
          const content = fs.readFileSync(resultFilePath, 'utf8').replace(/^\uFEFF/, '');
          try { fs.unlinkSync(resultFilePath); } catch {}
          return JSON.parse(content);
        }
      } catch (e) {
        logStt('read-result-error', { message: e.message });
      }
      return null;
    }

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString('utf8').split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('EVT:')) {
          try {
            const payload = JSON.parse(line.slice(4));
            if (payload.type === 'partial' && payload.text) {
              lastPartial = payload.text;
              onPartial?.(payload.text);
            } else if (payload.type === 'final') {
              lastPartial = payload.text || lastPartial;
            } else if (payload.type === 'error') {
              logStt('modern-stt-script-error', { error: payload.error });
            }
          } catch (e) {
            logStt('parse-evt-error', { raw: line, message: e.message });
          }
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      logStt('modern-stt-child-error', { message: error.message, stderr });
      reject(error);
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      cleanup();

      const result = readResultFile();
      if (result && result.success) {
        const finalText = result.text || lastPartial || '';
        logStt('modern-stt-success', { textLength: finalText.length, hasResult: result.hasResult, language: result.language });
        resolve(finalText);
      } else if (result && result.error) {
        logStt('modern-stt-failed', { error: result.error, exitCode: code, stderr });
        reject(new Error(JSON.stringify({ message: result.error, exitCode: code, stderr })));
      } else if (lastPartial) {
        logStt('modern-stt-fallback-partial', { textLength: lastPartial.length, exitCode: code, stderr });
        resolve(lastPartial);
      } else {
        logStt('modern-stt-no-result', { exitCode: code, stderr });
        reject(new Error(JSON.stringify({ message: 'No speech result', exitCode: code, stderr })));
      }
    });
  });
}

module.exports = { recognizeWithWindowsModernSTT };
