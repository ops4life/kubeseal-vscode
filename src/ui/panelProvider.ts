import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { encodeWithBase64, decodeWithBase64 } from '../utils/shell';

interface PanelState {
    command: string;
    certsFolder: string;
    activeCertFile: string;
    certFiles: string[];
    activeEditorIsYaml: boolean;
}

export class KubesealPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kubeseal.panel';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg, webviewView.webview);
        });

        this._sendState(webviewView.webview);
    }

    public refresh(): void {
        if (this._view) {
            this._sendState(this._view.webview);
        }
    }

    private async _handleMessage(
        message: { command: string; value?: string },
        webview: vscode.Webview
    ): Promise<void> {
        switch (message.command) {
            case 'encode': {
                if (!message.value) return;
                try {
                    const result = await encodeWithBase64(message.value);
                    webview.postMessage({ command: 'encodeResult', value: result });
                } catch (e) {
                    webview.postMessage({ command: 'error', message: String(e) });
                }
                break;
            }
            case 'decode': {
                if (!message.value) return;
                try {
                    const result = await decodeWithBase64(message.value);
                    webview.postMessage({ command: 'decodeResult', value: result });
                } catch (e) {
                    webview.postMessage({ command: 'error', message: String(e) });
                }
                break;
            }
            case 'browseCertsFolder': {
                await vscode.commands.executeCommand('kubeseal.setCertFolder');
                this._sendState(webview);
                break;
            }
            case 'setActiveCert': {
                if (!message.value) return;
                const config = vscode.workspace.getConfiguration('kubeseal');
                await config.update(
                    'activeCertFile',
                    message.value,
                    vscode.ConfigurationTarget.Workspace
                );
                this._sendState(webview);
                break;
            }
            case 'encryptFile': {
                await vscode.commands.executeCommand('kubeseal.encrypt');
                break;
            }
            case 'decryptFile': {
                await vscode.commands.executeCommand('kubeseal.decrypt');
                break;
            }
            case 'getState': {
                this._sendState(webview);
                break;
            }
        }
    }

    private async _sendState(webview: vscode.Webview): Promise<void> {
        const config = vscode.workspace.getConfiguration('kubeseal');
        const certsFolder = config.get<string>('certsFolder', '');
        const activeCertFile = config.get<string>('activeCertFile', '');

        let certFiles: string[] = [];
        if (certsFolder) {
            try {
                const entries = await fs.readdir(certsFolder);
                certFiles = entries.filter((f) => /\.(pem|crt|cert)$/i.test(f)).sort();
            } catch {
                // folder not accessible
            }
        }

        const activeEditor = vscode.window.activeTextEditor;
        const activeEditorIsYaml = activeEditor
            ? /\.(yaml|yml)$/i.test(activeEditor.document.fileName)
            : false;

        const state: PanelState = {
            command: 'stateUpdate',
            certsFolder,
            activeCertFile,
            certFiles,
            activeEditorIsYaml,
        };

        webview.postMessage(state);
    }

    private _getHtml(): string {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kubeseal</title>
<style nonce="${nonce}">
/* ── Reset & Base ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --transition-fast: 120ms ease;
  --transition-med: 200ms ease;
  --shadow-inset: inset 0 1px 3px rgba(0,0,0,.2);
}

body {
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  background: var(--vscode-sideBar-background);
  overflow-x: hidden;
  padding-bottom: 16px;
}

/* ── Tab Nav ──────────────────────────────────────────────────── */
.tab-nav {
  display: flex;
  gap: 2px;
  padding: 8px 10px 0;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  padding-bottom: 0;
}

.tab {
  position: relative;
  flex: 1;
  padding: 6px 4px 8px;
  text-align: center;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--vscode-tab-inactiveForeground);
  border: none;
  background: none;
  user-select: none;
  transition: color var(--transition-fast);
  letter-spacing: 0.02em;
}

.tab::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 10%;
  right: 10%;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--vscode-focusBorder);
  transform: scaleX(0);
  transition: transform var(--transition-med);
}

.tab:hover { color: var(--vscode-foreground); }

.tab.active {
  color: var(--vscode-tab-activeForeground);
}

.tab.active::after {
  transform: scaleX(1);
}

/* ── Tab Icon ─────────────────────────────────────────────────── */
.tab-icon {
  display: block;
  font-size: 14px;
  margin-bottom: 2px;
  opacity: .75;
}
.tab.active .tab-icon { opacity: 1; }

/* ── Tab Content ──────────────────────────────────────────────── */
.tab-content {
  display: none;
  padding: 14px 10px 0;
  animation: fadeSlideIn var(--transition-med) both;
}
.tab-content.active { display: block; }

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Card ─────────────────────────────────────────────────────── */
.card {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-md);
  padding: 10px 10px 12px;
  margin-bottom: 10px;
}

/* ── Field Label ──────────────────────────────────────────────── */
.field-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.field-label .lbl-icon { font-size: 12px; opacity: .8; }

/* ── Inputs ───────────────────────────────────────────────────── */
textarea, input[type="text"], select {
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, rgba(128,128,128,.35));
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

textarea { resize: vertical; min-height: 80px; line-height: 1.5; }

textarea:focus,
input[type="text"]:focus,
select:focus {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}

select { cursor: pointer; }
select option { background: var(--vscode-dropdown-background); }

/* ── Buttons ──────────────────────────────────────────────────── */
.btn-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--vscode-font-family);
  font-weight: 500;
  transition: background var(--transition-fast), opacity var(--transition-fast), transform 80ms ease;
}

button:active:not(:disabled) { transform: scale(.97); }
button:disabled { opacity: .45; cursor: not-allowed; }

button.primary {
  flex: 1;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
button.primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }

button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
button.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }

button.icon-btn {
  flex: none;
  padding: 5px 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  font-size: 14px;
}
button.icon-btn:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }

/* ── Output area ──────────────────────────────────────────────── */
.output-wrap {
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  letter-spacing: .02em;
}
.copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
.copy-btn.copied {
  background: #2d6a2d;
  color: #9de09d;
}

/* ── Error banner ─────────────────────────────────────────────── */
.error-banner {
  display: none;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
  font-size: 11px;
  line-height: 1.4;
}
.error-banner.visible { display: flex; }
.error-icon { font-size: 14px; flex-shrink: 0; }

/* ── Folder row ───────────────────────────────────────────────── */
.folder-row {
  display: flex;
  gap: 5px;
  align-items: stretch;
}
.folder-row input { flex: 1; }

/* ── Status badge ─────────────────────────────────────────────── */
.status-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--vscode-panel-border);
  margin-bottom: 10px;
  background: var(--vscode-input-background);
  transition: border-color var(--transition-med);
}

.status-badge.ok   { border-color: rgba(78, 201, 78, .4); background: rgba(78,201,78,.05); }
.status-badge.err  { border-color: rgba(241, 76, 76, .35); background: rgba(241,76,76,.05); }

.status-dot-wrap {
  position: relative;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.green { background: #4ec94e; }
.status-dot.red   { background: #f14c4c; }

/* pulse ring for active status */
.pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid #4ec94e;
  opacity: 0;
  animation: none;
}

.status-badge.ok .pulse-ring {
  animation: pulse 2.4s ease-out infinite;
}

@keyframes pulse {
  0%   { transform: scale(.7); opacity: .7; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { opacity: 0; }
}

.status-text-wrap {
  flex: 1;
  min-width: 0;
}

.status-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 2px;
}

.status-label {
  font-size: 11px;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

/* ── Action card ──────────────────────────────────────────────── */
.action-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 10px;
}

.action-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  background: var(--vscode-sideBarSectionHeader-background, rgba(128,128,128,.1));
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--vscode-descriptionForeground);
}

.action-card-body {
  padding: 10px;
  background: var(--vscode-input-background);
}

/* ── Hint text ────────────────────────────────────────────────── */
.hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.4;
}
.hint-icon { font-size: 13px; flex-shrink: 0; }

/* ── Divider ──────────────────────────────────────────────────── */
.divider {
  height: 1px;
  background: var(--vscode-panel-border);
  margin: 4px 0 10px;
}
</style>
</head>
<body>

<!-- ── Tab Navigation ────────────────────────────────────────── -->
<nav class="tab-nav">
  <div class="tab active" data-tab="base64" role="tab" aria-selected="true">
    <span class="tab-icon">⇌</span>Base64
  </div>
  <div class="tab" data-tab="settings" role="tab" aria-selected="false">
    <span class="tab-icon">⚙</span>Settings
  </div>
  <div class="tab" data-tab="actions" role="tab" aria-selected="false">
    <span class="tab-icon">⚡</span>Actions
  </div>
</nav>

<!-- ── Base64 Tab ─────────────────────────────────────────────── -->
<div id="tab-base64" class="tab-content active" role="tabpanel">

  <div class="card">
    <div class="field-label">
      <span class="lbl-icon">✎</span> Input
    </div>
    <textarea id="b64-input" rows="5" placeholder="Paste a value to encode or decode…"></textarea>
    <div class="btn-row">
      <button class="primary" id="btn-encode">↑ Encode</button>
      <button class="primary" id="btn-decode">↓ Decode</button>
    </div>
  </div>

  <div id="b64-error" class="error-banner">
    <span class="error-icon">⚠</span>
    <span id="b64-error-text"></span>
  </div>

  <div id="b64-output-section" style="display:none">
    <div class="card">
      <div class="field-label">
        <span class="lbl-icon">≡</span> Output
      </div>
      <div class="output-wrap">
        <textarea id="b64-output" rows="5" readonly></textarea>
        <button id="btn-copy" class="copy-btn">Copy</button>
      </div>
    </div>
  </div>

</div>

<!-- ── Settings Tab ───────────────────────────────────────────── -->
<div id="tab-settings" class="tab-content" role="tabpanel">

  <div class="card">
    <div class="field-label">
      <span class="lbl-icon">📁</span> Certs Folder
    </div>
    <div class="folder-row">
      <input type="text" id="certs-folder" readonly placeholder="Not configured">
      <button class="icon-btn" id="btn-browse" title="Browse for folder">…</button>
    </div>
  </div>

  <div class="card">
    <div class="field-label">
      <span class="lbl-icon">🔑</span> Active Certificate
    </div>
    <select id="active-cert">
      <option value="">Set a certs folder first</option>
    </select>
  </div>

</div>

<!-- ── Actions Tab ────────────────────────────────────────────── -->
<div id="tab-actions" class="tab-content" role="tabpanel">

  <div class="status-badge err" id="status-badge">
    <div class="status-dot-wrap">
      <div class="status-dot red" id="cert-dot"></div>
      <div class="pulse-ring"></div>
    </div>
    <div class="status-text-wrap">
      <div class="status-title">Certificate</div>
      <div class="status-label" id="cert-label">No certificate configured</div>
    </div>
  </div>

  <div class="action-card">
    <div class="action-card-header">
      <span>⚡</span> Active Editor
    </div>
    <div class="action-card-body">
      <div class="btn-row">
        <button class="primary" id="btn-encrypt" disabled>🔒 Encrypt File</button>
        <button class="primary" id="btn-decrypt" disabled>🔓 Decrypt File</button>
      </div>
      <div id="yaml-hint" class="hint">
        <span class="hint-icon">ℹ</span>
        Open a YAML file in the editor to enable.
      </div>
    </div>
  </div>

</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  // ── Tab switching ───────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab-' + tab.dataset.tab);
      panel.classList.remove('active');
      // Force reflow to restart animation
      void panel.offsetWidth;
      panel.classList.add('active');
    });
  });

  // ── Base64 tab ──────────────────────────────────────────────
  document.getElementById('btn-encode').addEventListener('click', () => {
    const value = document.getElementById('b64-input').value;
    if (!value) return;
    clearError();
    vscode.postMessage({ command: 'encode', value });
  });

  document.getElementById('btn-decode').addEventListener('click', () => {
    const value = document.getElementById('b64-input').value;
    if (!value) return;
    clearError();
    vscode.postMessage({ command: 'decode', value });
  });

  document.getElementById('btn-copy').addEventListener('click', () => {
    const val = document.getElementById('b64-output').value;
    const btn = document.getElementById('btn-copy');
    navigator.clipboard.writeText(val).catch(() => {
      document.getElementById('b64-output').select();
    });
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1800);
  });

  // ── Settings tab ────────────────────────────────────────────
  document.getElementById('btn-browse').addEventListener('click', () => {
    vscode.postMessage({ command: 'browseCertsFolder' });
  });

  document.getElementById('active-cert').addEventListener('change', (e) => {
    const value = e.target.value;
    if (value) vscode.postMessage({ command: 'setActiveCert', value });
  });

  // ── Actions tab ─────────────────────────────────────────────
  document.getElementById('btn-encrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'encryptFile' });
  });

  document.getElementById('btn-decrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'decryptFile' });
  });

  // ── Helpers ─────────────────────────────────────────────────
  function clearError() {
    const banner = document.getElementById('b64-error');
    banner.classList.remove('visible');
    document.getElementById('b64-error-text').textContent = '';
  }

  function showError(msg) {
    document.getElementById('b64-error-text').textContent = msg.replace(/^Error: /, '');
    document.getElementById('b64-error').classList.add('visible');
  }

  function showOutput(value) {
    document.getElementById('b64-output-section').style.display = '';
    document.getElementById('b64-output').value = value;
    // Reset copy button
    const btn = document.getElementById('btn-copy');
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }

  function updateState(state) {
    // ── Settings tab ─────────────────────────────────────────
    document.getElementById('certs-folder').value = state.certsFolder || '';
    const sel = document.getElementById('active-cert');
    sel.innerHTML = '';
    if (!state.certsFolder || !state.certFiles || state.certFiles.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.certsFolder ? 'No cert files found' : 'Set a certs folder first';
      opt.disabled = true;
      sel.appendChild(opt);
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— select —';
      sel.appendChild(placeholder);
      state.certFiles.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (f === state.activeCertFile) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!state.activeCertFile) sel.value = '';
    }

    // ── Actions tab ───────────────────────────────────────────
    const badge  = document.getElementById('status-badge');
    const dot    = document.getElementById('cert-dot');
    const label  = document.getElementById('cert-label');

    if (state.activeCertFile) {
      badge.className = 'status-badge ok';
      dot.className   = 'status-dot green';
      label.textContent = state.activeCertFile;
    } else {
      badge.className = 'status-badge err';
      dot.className   = 'status-dot red';
      label.textContent = 'No certificate configured';
    }

    const encBtn = document.getElementById('btn-encrypt');
    const decBtn = document.getElementById('btn-decrypt');
    const hint   = document.getElementById('yaml-hint');
    encBtn.disabled = !state.activeEditorIsYaml;
    decBtn.disabled = !state.activeEditorIsYaml;
    hint.style.display = state.activeEditorIsYaml ? 'none' : '';
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.command) {
      case 'encodeResult': showOutput(msg.value); break;
      case 'decodeResult': showOutput(msg.value); break;
      case 'error':        showError(msg.message); break;
      case 'stateUpdate':  updateState(msg); break;
    }
  });

  vscode.postMessage({ command: 'getState' });
</script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
