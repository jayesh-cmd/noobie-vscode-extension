import * as vscode from 'vscode';
import * as path from 'path';

// State machine for blob faces
type BlobState = 'happy' | 'focus' | 'error' | 'many_errors' | 'sleep';

let panel: vscode.WebviewPanel | undefined;
let currentState: BlobState = 'happy';
let idleTimer: NodeJS.Timeout | undefined;
let typingDebounce: NodeJS.Timeout | undefined;
let isTyping = false;
let statusBarItem: vscode.StatusBarItem;

const IDLE_TIMEOUT_MS = 50_000;  // 50 seconds
const TYPING_DEBOUNCE_MS = 1_500; // wait 1.5s after last keystroke before checking errors

export function activate(context: vscode.ExtensionContext) {
  // Create status bar button
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'blobBuddy.showPanel';
  statusBarItem.tooltip = 'noobie';
  statusBarItem.text = 'noobie';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register show panel command
  const showPanelCommand = vscode.commands.registerCommand('blobBuddy.showPanel', () => {
    openOrRevealPanel(context);
  });
  context.subscriptions.push(showPanelCommand);

  // Listen to diagnostics changes (errors/warnings)
  const diagListener = vscode.languages.onDidChangeDiagnostics(() => {
    updateBlobState(context);
  });
  context.subscriptions.push(diagListener);

  // Listen to text document changes (typing)
  const typeListener = vscode.workspace.onDidChangeTextDocument(() => {
    onUserActivity(context, true);
  });
  context.subscriptions.push(typeListener);

  // Listen to cursor movement / selection changes (general activity, not typing)
  const selectionListener = vscode.window.onDidChangeTextEditorSelection(() => {
    onUserActivity(context, false);
  });
  context.subscriptions.push(selectionListener);

  // Open the blob panel automatically on activation
  openOrRevealPanel(context);

  // Start idle timer
  resetIdleTimer(context);
}

function openOrRevealPanel(context: vscode.ExtensionContext) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'blobBuddy',
    'noobie',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'faces')),
      ],
    }
  );

  panel.webview.html = getWebviewHtml(panel.webview, context);

  panel.onDidDispose(() => {
    panel = undefined;
  });

  // Send initial state
  sendStateToWebview(context);
}

function onUserActivity(context: vscode.ExtensionContext, typing: boolean) {
  resetIdleTimer(context);

  if (typing) {
    // Mark as typing and show focus face immediately
    isTyping = true;
    setAndSendState('focus', context);

    // Reset the debounce — only check errors after typing fully stops
    if (typingDebounce) {
      clearTimeout(typingDebounce);
    }
    typingDebounce = setTimeout(() => {
      isTyping = false;
      // Now that typing stopped, check actual error state
      updateBlobState(context);
    }, TYPING_DEBOUNCE_MS);
  }
}

function resetIdleTimer(context: vscode.ExtensionContext) {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    setAndSendState('sleep', context);
  }, IDLE_TIMEOUT_MS);
}

function updateBlobState(context: vscode.ExtensionContext) {
  // Don't interrupt the focus face while the user is still typing
  if (isTyping) {
    return;
  }

  const totalErrors = getTotalErrorCount();

  let newState: BlobState;
  if (totalErrors === 0) {
    newState = 'happy';
  } else if (totalErrors <= 2) {
    newState = 'error';
  } else {
    newState = 'many_errors';
  }

  setAndSendState(newState, context);
}

function getTotalErrorCount(): number {
  let count = 0;
  for (const [, diags] of vscode.languages.getDiagnostics()) {
    count += diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
  }
  return count;
}

function setAndSendState(state: BlobState, context: vscode.ExtensionContext) {
  currentState = state;
  sendStateToWebview(context);
  updateStatusBarLabel(state);
}

function updateStatusBarLabel(state: BlobState) {
  const labels: Record<BlobState, string> = {
    happy: 'noobie',
    focus: 'noobie',
    error: 'noobie',
    many_errors: 'noobie',
    sleep: 'noobie',
  };
  statusBarItem.text = labels[state];
}

function sendStateToWebview(context: vscode.ExtensionContext) {
  if (!panel) {
    return;
  }

  const faceUris = getFaceUris(panel.webview, context);
  panel.webview.postMessage({
    type: 'setState',
    state: currentState,
    faceUris,
  });
}

function getFaceUris(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Record<BlobState, string> {
  const facesDir = path.join(context.extensionPath, 'faces');
  const toUri = (filename: string) =>
    webview.asWebviewUri(vscode.Uri.file(path.join(facesDir, filename))).toString();

  return {
    happy: toUri('happy_blush_face.PNG'),
    focus: toUri('focus_face.PNG'),
    error: toUri('error_face.PNG'),
    many_errors: toUri('many_errors_face.PNG'),
    sleep: toUri('sleep_face.PNG'),
  };
}

function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const nonce = getNonce();
  const faceUris = getFaceUris(webview, context);

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${webview.cspSource} data:;
             style-src 'nonce-${nonce}';
             script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>noobie</title>
  <style nonce="${nonce}">
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
    }

    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }

    .wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    /* Face image — big, filling the panel */
    .face-img {
      width: min(80vw, 80vh);
      height: min(80vw, 80vh);
      object-fit: contain;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .face-img.fade-out {
      opacity: 0;
      transform: scale(0.9);
    }

    /* Animations by state */
    .state-happy .face-img {
      animation: blob-bounce 2.5s ease-in-out infinite;
    }
    .state-focus .face-img {
      animation: blob-wiggle 0.6s ease-in-out infinite;
    }
    .state-error .face-img {
      animation: blob-shake 0.8s ease-in-out infinite;
    }
    .state-many-errors .face-img {
      animation: blob-panic 0.4s ease-in-out infinite;
    }
    .state-sleep .face-img {
      animation: blob-breathe 3s ease-in-out infinite;
    }

    @keyframes blob-bounce {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-10px) scale(1.03); }
    }
    @keyframes blob-wiggle {
      0%, 100% { transform: rotate(-3deg); }
      50% { transform: rotate(3deg); }
    }
    @keyframes blob-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }
    @keyframes blob-panic {
      0%, 100% { transform: translateX(-5px) rotate(-2deg); }
      50% { transform: translateX(5px) rotate(2deg); }
    }
    @keyframes blob-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(0.94); }
    }

    /* Tiny state label below the blob */
    .state-label {
      font-size: 11px;
      font-family: monospace;
      opacity: 0.45;
      color: var(--vscode-foreground, #ccc);
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="wrapper" id="root">
    <img
      id="blobFace"
      class="face-img"
      src=""
      alt="blob"
    />
    <span class="state-label" id="stateLabel"></span>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const root       = document.getElementById('root');
    const faceImg    = document.getElementById('blobFace');
    const stateLabel = document.getElementById('stateLabel');

    const STATE_CONFIG = {
      happy:       { label: 'happy',       cssClass: 'state-happy' },
      focus:       { label: 'focus',       cssClass: 'state-focus' },
      error:       { label: 'error',       cssClass: 'state-error' },
      many_errors: { label: 'many errors', cssClass: 'state-many-errors' },
      sleep:       { label: 'zzz',         cssClass: 'state-sleep' },
    };

    const allClasses = Object.values(STATE_CONFIG).map(c => c.cssClass);
    let currentFaceUri = '';

    function setState(state, faceUris) {
      const cfg = STATE_CONFIG[state];
      if (!cfg) { return; }

      // Swap face with fade
      const newUri = faceUris[state];
      if (newUri && newUri !== currentFaceUri) {
        faceImg.classList.add('fade-out');
        setTimeout(() => {
          faceImg.src = newUri;
          currentFaceUri = newUri;
          faceImg.classList.remove('fade-out');
        }, 250);
      }

      // Swap state class on root for animations
      allClasses.forEach(c => root.classList.remove(c));
      root.classList.add(cfg.cssClass);

      // Update tiny label
      stateLabel.textContent = cfg.label;
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'setState') {
        setState(msg.state, msg.faceUris);
      }
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  if (typingDebounce) {
    clearTimeout(typingDebounce);
  }
  panel?.dispose();
}
