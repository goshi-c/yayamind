const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, session, utilityProcess } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const DEV_APP_URL = process.env.YAYAMIND_DESKTOP_URL || 'http://127.0.0.1:5173';
const PACKAGED_APP_URL = 'http://127.0.0.1:8787';
const BUBBLE_SIZE = 92;
const BUBBLE_WINDOW_WIDTH = 360;
const BUBBLE_WINDOW_HEIGHT = 280;
const EDGE_GAP = 14;
const YAYAMIND_DATA_HOME = process.env.YAYAMIND_DATA_HOME || 'D:\\YayaMindData';
const YAYAMIND_USER_DATA = path.join(YAYAMIND_DATA_HOME, 'userData');
const YAYAMIND_SESSION_DATA = path.join(YAYAMIND_DATA_HOME, 'sessionData');
const YAYAMIND_DATA_DIR = path.join(YAYAMIND_DATA_HOME, 'personal-assistant-data');

fs.mkdirSync(YAYAMIND_USER_DATA, { recursive: true });
fs.mkdirSync(YAYAMIND_SESSION_DATA, { recursive: true });
app.setPath('userData', YAYAMIND_USER_DATA);
app.setPath('sessionData', YAYAMIND_SESSION_DATA);

let mainWindow = null;
let bubbleWindow = null;
let tray = null;
let desktopServerProcess = null;
let desktopSpeechProcess = null;
let desktopSpeechStopRequested = false;
let desktopSpeechStopFilePath = null;
let desktopVoiceSessionId = 0;
let dictationHotkeyTimer = null;
let dictationHotkeySentForSession = null;
let dragState = null;
let bubbleMouseInteractive = null;
let bubbleTopMostTimer = null;
let isQuitting = false;
let desktopVoiceActive = false;
let settings = {
  bubbleBounds: null,
  bubbleVisible: true,
  openAtLogin: false
};

function logDesktopCat(eventName, detail = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[desktop-cat] ${timestamp} ${eventName}`, detail);
  try {
    fs.appendFileSync(
      path.join(YAYAMIND_USER_DATA, 'desktop-cat.log'),
      JSON.stringify({ timestamp, eventName, detail }) + '\n',
      'utf8'
    );
  } catch {
    // Logging must never break the desktop assistant.
  }
}

function createLogLine(kind, detail = {}) {
  return `${kind}:${Buffer.from(JSON.stringify(detail), 'utf8').toString('base64')}`;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  openMainWindow();
  if (bubbleWindow && !bubbleWindow.isDestroyed() && settings.bubbleVisible) {
    liftBubbleWindow('second-instance');
  }
});

function getAssetPath(...segments) {
  return path.join(__dirname, '..', ...segments);
}

function getDesktopAssetPath(fileName) {
  return getAssetPath('src', 'assets', 'desktop', fileName);
}

function getAppUrl() {
  return app.isPackaged && !process.env.YAYAMIND_DESKTOP_URL ? PACKAGED_APP_URL : DEV_APP_URL;
}

function startPackagedServer() {
  if (!app.isPackaged || desktopServerProcess) return;
  const runnerPath = path.join(app.getAppPath(), 'electron', 'server-runner.cjs');
  const staticDir = path.join(app.getAppPath(), 'dist');
  desktopServerProcess = utilityProcess.fork(runnerPath, [], {
    env: {
      ...process.env,
      YAYAMIND_DATA_HOME,
      YAYAMIND_DATA_DIR,
      DESKTOP_STATIC_DIR: staticDir
    }
  });
  desktopServerProcess.once('exit', () => {
    desktopServerProcess = null;
  });
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
    settings = { ...settings, ...parsed };
  } catch {
    settings = { ...settings };
  }
}

function saveSettings() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getWorkAreaNear(bounds) {
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
  return screen.getDisplayNearestPoint(center).workArea;
}

function normalizeBubbleBounds(bounds) {
  const workArea = getWorkAreaNear(bounds);
  return {
    x: Math.round(clamp(bounds.x, workArea.x + EDGE_GAP, workArea.x + workArea.width - BUBBLE_WINDOW_WIDTH - EDGE_GAP)),
    y: Math.round(clamp(bounds.y, workArea.y + EDGE_GAP, workArea.y + workArea.height - BUBBLE_WINDOW_HEIGHT - EDGE_GAP)),
    width: BUBBLE_WINDOW_WIDTH,
    height: BUBBLE_WINDOW_HEIGHT
  };
}

function getInitialBubbleBounds() {
  if (settings.bubbleBounds) {
    return normalizeBubbleBounds(settings.bubbleBounds);
  }
  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    width: BUBBLE_WINDOW_WIDTH,
    height: BUBBLE_WINDOW_HEIGHT,
    x: workArea.x + workArea.width - BUBBLE_WINDOW_WIDTH - 24,
    y: workArea.y + workArea.height - BUBBLE_WINDOW_HEIGHT - 56
  };
}

async function waitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 500);
      });
      request.on('error', () => resolve(false));
      request.setTimeout(1000, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

async function ensureMainWindow(options = {}) {
  const shouldShow = options.show === true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (shouldShow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1060,
    minHeight: 700,
    title: 'YayaMind',
    icon: getDesktopAssetPath('yayamind.ico'),
    show: false,
    backgroundColor: '#fff8ef',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (shouldShow) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }

  const appUrl = getAppUrl();
  await waitForUrl(appUrl);
  await mainWindow.loadURL(appUrl);
  return mainWindow;
}

async function openMainWindow() {
  logDesktopCat('open-main');
  const targetWindow = await ensureMainWindow({ show: true });
  bringWindowToFront(targetWindow);
  setTimeout(() => liftBubbleWindow('open-main-after-front'), 180);
}

async function toggleMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    logDesktopCat('toggle-main-hide');
    mainWindow.hide();
    return;
  }
  logDesktopCat('toggle-main-show');
  await openMainWindow();
}

function bringWindowToFront(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  if (targetWindow.isMinimized()) targetWindow.restore();
  targetWindow.show();
  targetWindow.focus();
  targetWindow.moveTop();
  targetWindow.setAlwaysOnTop(true, 'screen-saver');
  setTimeout(() => {
    if (!targetWindow.isDestroyed()) {
      targetWindow.setAlwaysOnTop(false);
      targetWindow.focus();
    }
  }, 600);
}

function sendBubbleState(state) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  logDesktopCat('bubble-state', { state });
  bubbleWindow.webContents.send('bubble:state', state);
}

function sendBubbleMessage(message) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const text = String(message || '');
  logDesktopCat('bubble-message', {
    length: text.length,
    preview: text.slice(0, 36)
  });
  bubbleWindow.webContents.send('bubble:message', message || '');
}

function liftBubbleWindow(reason) {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !settings.bubbleVisible) return;
  try {
    if (bubbleWindow.isMinimized()) bubbleWindow.restore();
    if (!bubbleWindow.isVisible()) bubbleWindow.showInactive();
    bubbleWindow.setAlwaysOnTop(true, 'screen-saver');
    bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    bubbleWindow.moveTop();
    logDesktopCat('bubble-lift', { reason, bounds: bubbleWindow.getBounds() });
  } catch (error) {
    logDesktopCat('bubble-lift-error', { reason, message: error.message });
  }
}

function startBubbleTopMostWatch() {
  if (bubbleTopMostTimer) return;
  bubbleTopMostTimer = setInterval(() => {
    if (!bubbleWindow || bubbleWindow.isDestroyed() || !settings.bubbleVisible) return;
    liftBubbleWindow('bubble-topmost-watch');
  }, 8000);
  if (typeof bubbleTopMostTimer.unref === 'function') bubbleTopMostTimer.unref();
}

function stopBubbleTopMostWatch() {
  if (!bubbleTopMostTimer) return;
  clearInterval(bubbleTopMostTimer);
  bubbleTopMostTimer = null;
}

function sendWindowsDictationHotkey() {
  const script = `
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class KeyboardInput {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, UIntPtr dwExtraInfo);
}
"@
$KEYEVENTF_KEYUP = 0x0002
$VK_LWIN = 0x5B
$VK_H = 0x48
[KeyboardInput]::keybd_event($VK_LWIN, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 18
[KeyboardInput]::keybd_event($VK_H, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 18
[KeyboardInput]::keybd_event($VK_H, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 18
[KeyboardInput]::keybd_event($VK_LWIN, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
`.trim();
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
  child.on('error', (error) => {
    logDesktopCat('system-dictation-hotkey-error', { message: error.message, stack: error.stack });
  });
  child.on('exit', (code) => {
    logDesktopCat('system-dictation-hotkey-exit', { code });
  });
}

function clearDictationHotkeyTimer() {
  if (!dictationHotkeyTimer) return;
  clearTimeout(dictationHotkeyTimer);
  dictationHotkeyTimer = null;
}

function requestWindowsDictationHotkey(voiceSessionId, reason) {
  if (!desktopVoiceActive || voiceSessionId !== desktopVoiceSessionId) {
    logDesktopCat('system-dictation-hotkey-skipped', { voiceSessionId, currentVoiceSessionId: desktopVoiceSessionId, reason });
    return;
  }
  if (dictationHotkeySentForSession === voiceSessionId) {
    logDesktopCat('system-dictation-hotkey-duplicate-skipped', { voiceSessionId, reason });
    return;
  }
  clearDictationHotkeyTimer();
  dictationHotkeySentForSession = voiceSessionId;
  logDesktopCat('system-dictation-hotkey-request', { voiceSessionId, reason });
  sendWindowsDictationHotkey();
}

async function startDesktopVoiceInput() {
  if (desktopVoiceActive) {
    stopDesktopVoiceInput();
    return;
  }
  const voiceSessionId = desktopVoiceSessionId + 1;
  desktopVoiceSessionId = voiceSessionId;
  logDesktopCat('main-start-voice', { voiceSessionId });
  desktopVoiceActive = true;
  desktopSpeechStopRequested = false;
  dictationHotkeySentForSession = null;
  clearDictationHotkeyTimer();
  sendBubbleState('listening');
  liftBubbleWindow('voice-start');
  const targetWindow = await ensureMainWindow({ show: true });
  bringWindowToFront(targetWindow);
  liftBubbleWindow('voice-start-after-main-front');

  logDesktopCat('stt-engine-selected', {
    engine: 'windows-system-dictation',
    api: 'Win+H',
    voiceSessionId
  });
  targetWindow.webContents.send('desktop-cat:native-voice-start', { voiceSessionId });
  dictationHotkeyTimer = setTimeout(() => {
    dictationHotkeyTimer = null;
    requestWindowsDictationHotkey(voiceSessionId, 'renderer-ready-timeout');
  }, 650);
}

async function stopDesktopVoiceInput() {
  logDesktopCat('voice-stop-request');
  desktopSpeechStopRequested = true;
  clearDictationHotkeyTimer();
  const targetWindow = await ensureMainWindow({ show: false });
  targetWindow.webContents.send('desktop-cat:prepare-native-voice-stop');
  logDesktopCat('system-dictation-submit-without-hotkey', { voiceSessionId: desktopVoiceSessionId });
  setTimeout(() => {
    targetWindow.webContents.send('desktop-cat:native-voice-stop');
    desktopVoiceActive = false;
    desktopSpeechStopRequested = false;
    liftBubbleWindow('voice-stop');
    updateTrayMenu();
  }, 220);
}

async function cancelDesktopVoiceInput() {
  logDesktopCat('voice-cancel-request', { voiceSessionId: desktopVoiceSessionId });
  desktopSpeechStopRequested = true;
  desktopVoiceActive = false;
  clearDictationHotkeyTimer();
  const targetWindow = await ensureMainWindow({ show: false });
  targetWindow.webContents.send('desktop-cat:cancel-voice');
  sendBubbleMessage('');
  sendBubbleState('sleeping');
  sendWindowsDictationHotkey();
  setTimeout(() => {
    desktopSpeechStopRequested = false;
    updateTrayMenu();
  }, 220);
}

function recognizeWithWindowsSpeech(onPartial, timeoutMs = 10 * 60_000) {
  return new Promise((resolve, reject) => {
    const stopFilePath = path.join(YAYAMIND_USER_DATA, `windows-speech-stop-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
    const script = `
param([string]$StopFile)
$encode = { param($text) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text)) }
$emitLog = {
  param([string]$Name, [hashtable]$Detail)
  $payload = @{ event = $Name; detail = $Detail } | ConvertTo-Json -Compress -Depth 5
  [Console]::Out.WriteLine('LOG:' + (& $encode $payload))
  [Console]::Out.Flush()
}
$exitCode = 0
$recognizer = $null
try {
  $ErrorActionPreference = "Stop"
  Add-Type -AssemblyName System.Speech
  Add-Type -AssemblyName System.Core
  $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine([Globalization.CultureInfo]"zh-CN")
  & $emitLog 'stt-start-success' @{ stage = 'recognizer-created'; culture = $recognizer.RecognizerInfo.Culture.Name; name = $recognizer.RecognizerInfo.Name }
  $recognizer.SetInputToDefaultAudioDevice()
  & $emitLog 'stt-audio-start' @{ stage = 'default-audio-device-bound' }
  $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $done = New-Object Threading.ManualResetEventSlim($false)
  $script:finalText = ""
  $script:lastPartialText = ""
  $script:segments = New-Object System.Collections.Generic.List[string]
  $recognizer.add_SpeechHypothesized({
    param($sender, $eventArgs)
    $text = $eventArgs.Result.Text
    if ($text -and $text -ne $script:lastPartialText) {
      $script:lastPartialText = $text
      $displayText = (($script:segments + @($text)) -join ' ')
      [Console]::Out.WriteLine('PARTIAL:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($displayText)))
      [Console]::Out.Flush()
    }
  })
  $recognizer.add_SpeechRecognized({
    param($sender, $eventArgs)
    if ($eventArgs.Result -and $eventArgs.Result.Text) {
      $script:segments.Add($eventArgs.Result.Text)
      $script:finalText = ($script:segments -join ' ')
      [Console]::Out.WriteLine('PARTIAL:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script:finalText)))
      [Console]::Out.Flush()
    }
  })
  $recognizer.add_RecognizeCompleted({
    param($sender, $eventArgs)
    if ($eventArgs.Error) {
      & $emitLog 'stt-error' @{ stage = 'recognize-completed'; error = $eventArgs.Error.ToString(); cancelled = $eventArgs.Cancelled }
    } else {
      & $emitLog 'stt-recognize-completed' @{ cancelled = $eventArgs.Cancelled }
    }
    $done.Set()
  })
  $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
  & $emitLog 'stt-start-success' @{ stage = 'recognize-async-started'; mode = 'Multiple' }
  $startedAt = [DateTime]::UtcNow
  while (-not (Test-Path -LiteralPath $StopFile)) {
    Start-Sleep -Milliseconds 160
    if (([DateTime]::UtcNow - $startedAt).TotalMinutes -ge 10) { break }
  }
  $recognizer.RecognizeAsyncStop()
  $done.Wait(2500) | Out-Null
  if (-not $script:finalText -and $script:lastPartialText) { $script:finalText = $script:lastPartialText }
  Write-Output ('FINAL:' + (& $encode $script:finalText))
} catch {
  $errorText = ($_ | Out-String)
  Write-Output ('ERROR:' + (& $encode $errorText))
  $exitCode = 1
} finally {
  if ($recognizer) {
    try { $recognizer.RecognizeAsyncCancel() } catch {}
    try { $recognizer.Dispose() } catch {}
  }
}
[Environment]::Exit($exitCode)
`.trim();
    fs.mkdirSync(YAYAMIND_USER_DATA, { recursive: true });
    const scriptPath = path.join(YAYAMIND_USER_DATA, `windows-speech-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`);
    fs.writeFileSync(scriptPath, `\uFEFF${script}`, 'utf8');
    desktopSpeechStopFilePath = stopFilePath;
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-StopFile', stopFilePath],
      { windowsHide: true }
    );
    let finalText = '';
    let lastPartialText = '';
    let stderr = '';
    let speechError = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      desktopSpeechProcess = null;
      desktopSpeechStopFilePath = null;
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(stopFilePath); } catch {}
      reject(new Error(JSON.stringify({ message: 'Windows speech timed out', exitCode: null, stderr, speechError })));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      for (const rawLine of chunk.toString('utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const sep = line.indexOf(':');
        if (sep < 0) continue;
        const kind = line.slice(0, sep);
        const encoded = line.slice(sep + 1);
        const text = encoded ? Buffer.from(encoded, 'base64').toString('utf8').trim() : '';
        if (kind === 'PARTIAL' && text) {
          lastPartialText = text;
          onPartial?.(text);
        } else if (kind === 'FINAL') {
          finalText = text;
        } else if (kind === 'ERROR') {
          speechError = text;
        } else if (kind === 'LOG' && text) {
          try {
            const payload = JSON.parse(text);
            if (payload?.event) logDesktopCat(payload.event, payload.detail ?? {});
          } catch (error) {
            logDesktopCat('stt-error', {
              stage: 'parse-child-log',
              raw: text,
              message: error instanceof Error ? error.message : String(error)
            });
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
      clearTimeout(timeout);
      desktopSpeechProcess = null;
      desktopSpeechStopFilePath = null;
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(stopFilePath); } catch {}
      logDesktopCat('stt-error', {
        stage: 'child-process-error',
        message: error.message,
        stack: error.stack,
        stderr,
        speechError
      });
      reject(error);
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      desktopSpeechProcess = null;
      desktopSpeechStopFilePath = null;
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(stopFilePath); } catch {}
      if (speechError) {
        const detail = { message: speechError, exitCode: code, stderr, finalTextLength: finalText.length, lastPartialLength: lastPartialText.length };
        logDesktopCat('stt-error', detail);
        reject(new Error(JSON.stringify(detail)));
        return;
      }
      if (code && code !== 0) {
        const detail = {
          message: `Windows speech exited with ${code}`,
          exitCode: code,
          stderr: stderr.trim(),
          finalTextLength: finalText.length,
          lastPartialLength: lastPartialText.length
        };
        logDesktopCat('stt-error', detail);
        reject(new Error(JSON.stringify(detail)));
        return;
      }
      resolve(finalText || lastPartialText);
    });
    desktopSpeechProcess = child;
  });
}

function createBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return;
  logDesktopCat('bubble-create');
  const initialBounds = getInitialBubbleBounds();
  settings.bubbleBounds = initialBounds;
  saveSettings();
  bubbleWindow = new BrowserWindow({
    ...initialBounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  setBubbleMouseInteractive(false, 'create');
  bubbleWindow.loadFile(path.join(__dirname, 'bubble.html'));
  bubbleWindow.once('ready-to-show', () => {
    liftBubbleWindow('bubble-ready');
    startBubbleTopMostWatch();
  });
  setTimeout(() => {
    liftBubbleWindow('bubble-create-timeout');
  }, 900);
  bubbleWindow.on('show', () => {
    logDesktopCat('bubble-show');
    settings.bubbleVisible = true;
    saveSettings();
    updateTrayMenu();
    liftBubbleWindow('bubble-show');
    startBubbleTopMostWatch();
  });
  bubbleWindow.on('hide', () => {
    logDesktopCat('bubble-hide');
    settings.bubbleVisible = false;
    saveSettings();
    updateTrayMenu();
    stopBubbleTopMostWatch();
  });
  bubbleWindow.on('closed', () => {
    logDesktopCat('bubble-close');
    stopBubbleTopMostWatch();
    bubbleWindow = null;
    bubbleMouseInteractive = null;
    if (!isQuitting && settings.bubbleVisible) {
      setTimeout(createBubbleWindow, 500);
    }
  });
  bubbleWindow.webContents.on('render-process-gone', (_event, details) => {
    logDesktopCat('bubble-render-process-gone', details);
    if (!isQuitting) {
      const currentWindow = bubbleWindow;
      bubbleWindow = null;
      currentWindow?.destroy();
      setTimeout(createBubbleWindow, 500);
    }
  });
  if (!settings.bubbleVisible) {
    bubbleWindow.hide();
  }
}

function setBubbleMouseInteractive(interactive, reason) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const nextInteractive = Boolean(interactive);
  if (bubbleMouseInteractive === nextInteractive) return;
  bubbleMouseInteractive = nextInteractive;
  bubbleWindow.setIgnoreMouseEvents(!nextInteractive, { forward: true });
  logDesktopCat('bubble-mouse-interactive', { interactive: nextInteractive, reason });
}

function setBubbleVisible(visible) {
  settings.bubbleVisible = visible;
  saveSettings();
  if (!bubbleWindow || bubbleWindow.isDestroyed()) {
    if (visible) createBubbleWindow();
    return;
  }
  if (visible) bubbleWindow.show();
  else bubbleWindow.hide();
  updateTrayMenu();
}

function toggleLoginItem() {
  settings.openAtLogin = !settings.openAtLogin;
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  saveSettings();
  updateTrayMenu();
}

function createTrayImage() {
  const source = nativeImage.createFromPath(getDesktopAssetPath('app-icon.png'));
  if (source.isEmpty()) {
    return nativeImage.createEmpty();
  }
  return source.resize({ width: 18, height: 18 });
}

function updateTrayMenu() {
  if (!tray) return;
  const isBubbleVisible = !bubbleWindow || bubbleWindow.isDestroyed() ? settings.bubbleVisible : bubbleWindow.isVisible();
  const menu = Menu.buildFromTemplate([
    { label: '打开工作台', click: openMainWindow },
    {
      label: desktopVoiceActive ? '暂停听写' : '开始听写',
      click: () => {
        if (desktopVoiceActive) stopDesktopVoiceInput();
        else startDesktopVoiceInput();
      }
    },
    {
      label: isBubbleVisible ? '隐藏小猫' : '显示小猫',
      click: () => setBubbleVisible(!isBubbleVisible)
    },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: toggleLoginItem
    },
    {
      label: '设置',
      click: openMainWindow
    },
    { type: 'separator' },
    {
      label: '退出 YayaMind',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}
function createTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip('YayaMind');
  tray.on('click', openMainWindow);
  updateTrayMenu();
}

function configureMediaPermissions() {
  const allowedOrigins = new Set([DEV_APP_URL, PACKAGED_APP_URL]);
  const isYayaMindOrigin = (origin) => {
    try {
      return allowedOrigins.has(new URL(origin).origin);
    } catch {
      return false;
    }
  };
  const isMediaPermission = (permission) => permission === 'media' || permission === 'microphone';
  const isTrustedAppWebContents = (webContents) =>
    Boolean(webContents && (webContents === mainWindow?.webContents || webContents === bubbleWindow?.webContents));
  const shouldAllowMediaPermission = (webContents, ...origins) =>
    isTrustedAppWebContents(webContents) || origins.some((origin) => origin && isYayaMindOrigin(origin));

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const pageUrl = webContents.getURL();
    const requestOrigin = details.requestingOrigin || details.securityOrigin || '';
    const shouldAllow = isMediaPermission(permission) && shouldAllowMediaPermission(webContents, pageUrl, requestOrigin);
    logDesktopCat('permission-request', { permission, pageUrl, requestOrigin, allowed: shouldAllow });
    callback(shouldAllow);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) => {
    const pageUrl = webContents.getURL();
    const shouldAllow = isMediaPermission(permission) && shouldAllowMediaPermission(webContents, pageUrl, origin);
    logDesktopCat('permission-check', { permission, origin: origin || '', pageUrl, allowed: shouldAllow });
    return shouldAllow;
  });
}

ipcMain.on('bubble:drag-start', (event, pointer) => {
  if (!bubbleWindow || event.sender !== bubbleWindow.webContents) return;
  setBubbleMouseInteractive(true, 'drag-start');
  logDesktopCat('drag-start', pointer);
  const bounds = bubbleWindow.getBounds();
  dragState = {
    offsetX: pointer.screenX - bounds.x,
    offsetY: pointer.screenY - bounds.y
  };
});

ipcMain.on('bubble:drag-move', (event, pointer) => {
  if (!bubbleWindow || event.sender !== bubbleWindow.webContents || !dragState) return;
  const workArea = screen.getDisplayNearestPoint({ x: pointer.screenX, y: pointer.screenY }).workArea;
  const nextX = clamp(pointer.screenX - dragState.offsetX, workArea.x + EDGE_GAP, workArea.x + workArea.width - BUBBLE_WINDOW_WIDTH - EDGE_GAP);
  const nextY = clamp(pointer.screenY - dragState.offsetY, workArea.y + EDGE_GAP, workArea.y + workArea.height - BUBBLE_WINDOW_HEIGHT - EDGE_GAP);
  bubbleWindow.setPosition(Math.round(nextX), Math.round(nextY));
});

ipcMain.on('bubble:drag-end', (event) => {
  if (!bubbleWindow || event.sender !== bubbleWindow.webContents) return;
  logDesktopCat('drag-end', bubbleWindow.getBounds());
  dragState = null;
  settings.bubbleBounds = bubbleWindow.getBounds();
  saveSettings();
});

ipcMain.on('bubble:set-interactive', (event, interactive) => {
  if (!bubbleWindow || event.sender !== bubbleWindow.webContents) return;
  if (dragState) return;
  setBubbleMouseInteractive(interactive, 'renderer-hit-test');
});

ipcMain.on('bubble:open-main', (event) => {
  if (bubbleWindow && event.sender === bubbleWindow.webContents) {
    logDesktopCat('double-click-toggle-main');
    toggleMainWindow();
  }
});

ipcMain.on('bubble:start-voice', (event) => {
  if (bubbleWindow && event.sender === bubbleWindow.webContents) {
    logDesktopCat('main-start-voice-received');
    startDesktopVoiceInput();
  }
});

ipcMain.on('bubble:cancel-voice', (event) => {
  if (bubbleWindow && event.sender === bubbleWindow.webContents) {
    logDesktopCat('bubble-cancel-voice');
    cancelDesktopVoiceInput();
  }
});

ipcMain.on('bubble:select-option', (event, optionId) => {
  if (!bubbleWindow || event.sender !== bubbleWindow.webContents) return;
  const selectedOptionId = typeof optionId === 'string' ? optionId : '';
  if (!selectedOptionId) return;
  logDesktopCat('bubble-select-option', { optionId: selectedOptionId });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-cat:bubble-option', selectedOptionId);
    liftBubbleWindow('bubble-select-option');
  }
});

ipcMain.on('bubble:log', (event, payload) => {
  if (bubbleWindow && event.sender === bubbleWindow.webContents) {
    logDesktopCat(payload?.type ?? 'bubble-log', payload?.detail ?? {});
  }
});

ipcMain.on('desktop-cat:state', (_event, state) => {
  if (state === 'sleeping' && desktopSpeechStopRequested && desktopSpeechProcess) {
    sendBubbleState('sleeping');
    return;
  }
  desktopVoiceActive = state === 'listening';
  updateTrayMenu();
  if (state === 'listening' || state === 'thinking' || state === 'error') {
    sendBubbleState(state);
    return;
  }
  sendBubbleState('sleeping');
});

ipcMain.on('desktop-cat:message', (_event, message) => {
  sendBubbleMessage(typeof message === 'string' ? message : '');
});

ipcMain.on('desktop-cat:voice-log', (_event, detail) => {
  if (detail?.type === 'renderer-partial-received') {
    logDesktopCat('renderer-partial-received', detail);
    return;
  }
  logDesktopCat('voice-renderer', detail);
});

ipcMain.on('desktop-cat:dictation-target-ready', (event, detail) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  const voiceSessionId = Number(detail?.voiceSessionId || desktopVoiceSessionId);
  const focused = Boolean(detail?.focused);
  logDesktopCat('system-dictation-target-ready', { voiceSessionId, focused });
  if (focused) {
    requestWindowsDictationHotkey(voiceSessionId, 'renderer-target-focused');
    return;
  }
  clearDictationHotkeyTimer();
  dictationHotkeyTimer = setTimeout(() => {
    dictationHotkeyTimer = null;
    requestWindowsDictationHotkey(voiceSessionId, 'renderer-target-focus-fallback');
  }, 360);
});

ipcMain.on('desktop-cat:request-voice', (event) => {
  if (mainWindow && event.sender === mainWindow.webContents) {
    logDesktopCat('renderer-request-voice');
    startDesktopVoiceInput();
  }
});

app.whenReady().then(() => {
  loadSettings();
  configureMediaPermissions();
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  startPackagedServer();
  createBubbleWindow();
  createTray();

  app.on('activate', () => {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) {
      createBubbleWindow();
    } else {
      liftBubbleWindow('app-activate');
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBubbleTopMostWatch();
  if (desktopServerProcess) {
    desktopServerProcess.kill();
    desktopServerProcess = null;
  }
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
