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
        webviewView.webview.html = this._getHtml(webviewView.webview);

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

    private _getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kubeseal</title>
<style nonce="${nonce}">
* { box-sizing: border-box; }
body {
  padding: 0;
  margin: 0;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  background: var(--vscode-sideBar-background);
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--vscode-panel-border);
  position: sticky;
  top: 0;
  background: var(--vscode-sideBar-background);
  z-index: 1;
}
.tab {
  flex: 1;
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  font-size: 11px;
  color: var(--vscode-tab-inactiveForeground);
  border-bottom: 2px solid transparent;
  user-select: none;
}
.tab.active {
  color: var(--vscode-tab-activeForeground);
  border-bottom-color: var(--vscode-focusBorder);
}
.tab-content { display: none; padding: 10px; }
.tab-content.active { display: block; }
.section { margin-bottom: 14px; }
label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
textarea, input, select {
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  padding: 5px 6px;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  outline: none;
  resize: vertical;
}
textarea:focus, input:focus, select:focus {
  border-color: var(--vscode-focusBorder);
}
select { resize: none; cursor: pointer; }
.btn-row { display: flex; gap: 6px; margin: 6px 0; }
button {
  flex: 1;
  padding: 5px 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--vscode-font-family);
}
button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
button.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
.output-wrap { position: relative; }
.copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  flex: none;
  padding: 2px 8px;
  font-size: 10px;
}
.error {
  display: none;
  color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
  font-size: 11px;
  margin-top: 4px;
  padding: 4px 6px;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
}
.folder-row { display: flex; gap: 4px; }
.folder-row input { flex: 1; }
.browse-btn { flex: none; padding: 5px 10px; }
.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-size: 11px;
  margin-bottom: 14px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot.green { background: #4ec94e; }
.dot.red { background: #f14c4c; }
.hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
</style>
</head>
<body>

<div class="tabs">
  <div class="tab active" data-tab="base64">Base64</div>
  <div class="tab" data-tab="settings">Settings</div>
  <div class="tab" data-tab="actions">Actions</div>
</div>

<div id="tab-base64" class="tab-content active">
  <div class="section">
    <label>Input</label>
    <textarea id="b64-input" rows="5" placeholder="Paste value to encode or decode..."></textarea>
  </div>
  <div class="btn-row">
    <button id="btn-encode">Encode</button>
    <button id="btn-decode">Decode</button>
  </div>
  <div id="b64-error" class="error"></div>
  <div id="b64-output-section" class="section" style="display:none">
    <label>Output</label>
    <div class="output-wrap">
      <textarea id="b64-output" rows="5" readonly></textarea>
      <button id="btn-copy" class="secondary copy-btn">Copy</button>
    </div>
  </div>
</div>

<div id="tab-settings" class="tab-content">
  <div class="section">
    <label>Certs Folder</label>
    <div class="folder-row">
      <input type="text" id="certs-folder" readonly placeholder="Not configured">
      <button id="btn-browse" class="secondary browse-btn">Browse</button>
    </div>
  </div>
  <div class="section">
    <label>Active Certificate</label>
    <select id="active-cert">
      <option value="">Set a certs folder first</option>
    </select>
  </div>
</div>

<div id="tab-actions" class="tab-content">
  <div class="badge">
    <div class="dot red" id="cert-dot"></div>
    <span id="cert-label">No certificate configured</span>
  </div>
  <div class="section">
    <label>Active Editor</label>
    <div class="btn-row">
      <button id="btn-encrypt" disabled>Encrypt File</button>
      <button id="btn-decrypt" disabled>Decrypt File</button>
    </div>
    <div id="yaml-hint" class="hint">Open a YAML file in the editor to enable.</div>
  </div>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Base64 tab
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
    navigator.clipboard.writeText(val).catch(() => {
      document.getElementById('b64-output').select();
    });
  });

  // Settings tab
  document.getElementById('btn-browse').addEventListener('click', () => {
    vscode.postMessage({ command: 'browseCertsFolder' });
  });

  document.getElementById('active-cert').addEventListener('change', (e) => {
    const value = e.target.value;
    if (value) vscode.postMessage({ command: 'setActiveCert', value });
  });

  // Actions tab
  document.getElementById('btn-encrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'encryptFile' });
  });

  document.getElementById('btn-decrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'decryptFile' });
  });

  function clearError() {
    const el = document.getElementById('b64-error');
    el.style.display = 'none';
    el.textContent = '';
  }

  function showError(msg) {
    const el = document.getElementById('b64-error');
    el.textContent = msg.replace(/^Error: /, '');
    el.style.display = '';
  }

  function showOutput(value) {
    document.getElementById('b64-output-section').style.display = '';
    document.getElementById('b64-output').value = value;
  }

  function updateState(state) {
    // Settings tab
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

    // Actions tab
    const dot = document.getElementById('cert-dot');
    const certLabel = document.getElementById('cert-label');
    if (state.activeCertFile) {
      dot.className = 'dot green';
      certLabel.textContent = state.activeCertFile;
    } else {
      dot.className = 'dot red';
      certLabel.textContent = 'No certificate configured';
    }

    const encBtn = document.getElementById('btn-encrypt');
    const decBtn = document.getElementById('btn-decrypt');
    const hint = document.getElementById('yaml-hint');
    encBtn.disabled = !state.activeEditorIsYaml;
    decBtn.disabled = !state.activeEditorIsYaml;
    hint.style.display = state.activeEditorIsYaml ? 'none' : '';
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.command) {
      case 'encodeResult': showOutput(msg.value); break;
      case 'decodeResult': showOutput(msg.value); break;
      case 'error': showError(msg.message); break;
      case 'stateUpdate': updateState(msg); break;
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
