const { contextBridge, ipcRenderer } = require('electron');

let startVoiceCallback = null;
let stopVoiceCallback = null;
let recognizedTextCallback = null;
let voiceErrorCallback = null;
let nativeVoiceStartCallback = null;
let nativeVoiceStopCallback = null;
let prepareNativeVoiceStopCallback = null;
let cancelVoiceCallback = null;
let voicePartialCallback = null;
let bubbleOptionCallback = null;
let pendingStartVoice = false;
let pendingStopVoice = false;

ipcRenderer.on('desktop-cat:start-voice', () => {
  if (startVoiceCallback) {
    startVoiceCallback();
    return;
  }
  pendingStartVoice = true;
});

ipcRenderer.on('desktop-cat:stop-voice', () => {
  if (stopVoiceCallback) {
    stopVoiceCallback();
    return;
  }
  pendingStopVoice = true;
});

ipcRenderer.on('desktop-cat:recognized-text', (_event, text) => {
  recognizedTextCallback?.(text);
});

ipcRenderer.on('desktop-cat:voice-error', (_event, detail) => {
  voiceErrorCallback?.(detail);
});

ipcRenderer.on('desktop-cat:native-voice-start', (_event, detail) => {
  nativeVoiceStartCallback?.(detail);
});

ipcRenderer.on('desktop-cat:native-voice-stop', () => {
  nativeVoiceStopCallback?.();
});

ipcRenderer.on('desktop-cat:prepare-native-voice-stop', () => {
  prepareNativeVoiceStopCallback?.();
});

ipcRenderer.on('desktop-cat:cancel-voice', () => {
  cancelVoiceCallback?.();
});

ipcRenderer.on('desktop-cat:voice-partial', (_event, text) => {
  voicePartialCallback?.(text);
});

ipcRenderer.on('desktop-cat:bubble-option', (_event, optionId) => {
  bubbleOptionCallback?.(String(optionId || ''));
});

contextBridge.exposeInMainWorld('yayaBubble', {
  dragStart: (pointer) => ipcRenderer.send('bubble:drag-start', pointer),
  dragMove: (pointer) => ipcRenderer.send('bubble:drag-move', pointer),
  dragEnd: () => ipcRenderer.send('bubble:drag-end'),
  openMain: () => ipcRenderer.send('bubble:open-main'),
  startVoice: () => ipcRenderer.send('bubble:start-voice'),
  cancelVoice: () => ipcRenderer.send('bubble:cancel-voice'),
  selectOption: (optionId) => ipcRenderer.send('bubble:select-option', optionId),
  setInteractive: (interactive) => ipcRenderer.send('bubble:set-interactive', Boolean(interactive)),
  log: (type, detail) => ipcRenderer.send('bubble:log', { type, detail }),
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('bubble:state', handler);
    return () => ipcRenderer.removeListener('bubble:state', handler);
  },
  onMessage: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('bubble:message', handler);
    return () => ipcRenderer.removeListener('bubble:message', handler);
  }
});

contextBridge.exposeInMainWorld('yayaDesktop', {
  isDesktopShell: true,
  onStartVoice: (callback) => {
    startVoiceCallback = callback;
    if (pendingStartVoice) {
      pendingStartVoice = false;
      window.setTimeout(() => startVoiceCallback?.(), 0);
    }
    return () => {
      if (startVoiceCallback === callback) startVoiceCallback = null;
    };
  },
  onStopVoice: (callback) => {
    stopVoiceCallback = callback;
    if (pendingStopVoice) {
      pendingStopVoice = false;
      window.setTimeout(() => stopVoiceCallback?.(), 0);
    }
    return () => {
      if (stopVoiceCallback === callback) stopVoiceCallback = null;
    };
  },
  onRecognizedText: (callback) => {
    recognizedTextCallback = callback;
    return () => {
      if (recognizedTextCallback === callback) recognizedTextCallback = null;
    };
  },
  onVoiceError: (callback) => {
    voiceErrorCallback = callback;
    return () => {
      if (voiceErrorCallback === callback) voiceErrorCallback = null;
    };
  },
  onNativeVoiceStart: (callback) => {
    nativeVoiceStartCallback = callback;
    return () => {
      if (nativeVoiceStartCallback === callback) nativeVoiceStartCallback = null;
    };
  },
  onNativeVoiceStop: (callback) => {
    nativeVoiceStopCallback = callback;
    return () => {
      if (nativeVoiceStopCallback === callback) nativeVoiceStopCallback = null;
    };
  },
  onPrepareNativeVoiceStop: (callback) => {
    prepareNativeVoiceStopCallback = callback;
    return () => {
      if (prepareNativeVoiceStopCallback === callback) prepareNativeVoiceStopCallback = null;
    };
  },
  onCancelVoice: (callback) => {
    cancelVoiceCallback = callback;
    return () => {
      if (cancelVoiceCallback === callback) cancelVoiceCallback = null;
    };
  },
  onVoicePartial: (callback) => {
    voicePartialCallback = callback;
    return () => {
      if (voicePartialCallback === callback) voicePartialCallback = null;
    };
  },
  onBubbleOption: (callback) => {
    bubbleOptionCallback = callback;
    return () => {
      if (bubbleOptionCallback === callback) bubbleOptionCallback = null;
    };
  },
  requestVoiceInput: () => ipcRenderer.send('desktop-cat:request-voice'),
  setCatState: (state) => ipcRenderer.send('desktop-cat:state', state),
  setCatMessage: (message) => ipcRenderer.send('desktop-cat:message', message),
  logVoiceEvent: (detail) => ipcRenderer.send('desktop-cat:voice-log', detail),
  notifyDictationTargetReady: (detail) => ipcRenderer.send('desktop-cat:dictation-target-ready', detail)
});
